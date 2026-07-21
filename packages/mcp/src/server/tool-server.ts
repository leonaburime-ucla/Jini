/**
 * @module @jini/mcp/server/tool-server
 *
 * `createMcpToolServer` — the generic stdio MCP server hosting mechanism.
 * Ported from the *mechanism* of OD's `apps/daemon/src/mcp.ts` `runMcpStdio`
 * (idle-exit lifecycle, `Server` + `StdioServerTransport` wiring, holding the
 * process open until stdin closes) with the OD-specific parts — the
 * hardcoded 18-tool `TOOL_DEFS`, the `od://` resource scheme, the
 * project/skill/plugin `instructions` prose — replaced by a caller-supplied,
 * bounded, explicit `tools: readonly McpToolDef[]` list. A caller is the
 * *first* user of this mechanism, not the only one it will ever support (see
 * `source-map.md`'s 2026-07-21 addition for the full design-decision note).
 *
 * Only `tools` capability is advertised (`capabilities: {tools: {}}`) — no
 * `resources`, unlike the OD origin. OD's resource surface (`od://focus/active`,
 * `od://skills/...`, `od://design-systems/...`) is entirely product content
 * (skills/design-systems don't exist in the kernel); nothing in this port's
 * tool set needs a resource, so the capability isn't advertised rather than
 * built speculatively against no consumer.
 */
import type { Readable, Writable } from 'node:stream';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, Implementation, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpIdleExitController } from '../client/client.js';
import { buildToolIndex, handleToolCall, toolsToList, type McpToolContext, type McpToolDef } from './tool-protocol.js';

/** Auto-exit an idle server after this long with no tool activity — same ceiling the OD origin used for its own stdio MCP server. */
const DEFAULT_IDLE_MS = 30 * 60 * 1000;

/**
 * The minimal surface this module needs from an MCP `Server` instance. A real
 * `@modelcontextprotocol/sdk` `Server` satisfies this structurally (its own `setRequestHandler`
 * is more general — one generic method covering every request schema — and TS accepts the
 * narrowing); a test can substitute a lightweight fake without spinning up a real transport.
 * Method-shorthand syntax (not arrow-typed properties) is deliberate: it keeps parameter checking
 * bivariant, so a handler typed against a *specific* request shape (as the two internal handlers
 * below are) is still assignable here even under `strict`.
 */
export interface McpServerLike {
  setRequestHandler(schema: typeof ListToolsRequestSchema, handler: () => Promise<ListToolsResult>): void;
  setRequestHandler(
    schema: typeof CallToolRequestSchema,
    handler: (request: { params: { name: string; arguments?: Record<string, unknown> } }) => Promise<CallToolResult>,
  ): void;
  connect(transport: McpTransportLike): Promise<void>;
}

/** The minimal surface this module needs from an MCP transport. A real `StdioServerTransport` satisfies this structurally. */
export interface McpTransportLike {
  onmessage?: ((message: unknown) => void) | undefined;
  onclose?: (() => void) | undefined;
  close(): Promise<void>;
}

export interface McpToolServerOptions {
  /** Advertised to the MCP client during initialization. */
  readonly name: string;
  readonly version: string;
  /** The bounded, explicit tool list this server hosts. Duplicate names throw at construction time. */
  readonly tools: readonly McpToolDef[];
  /** Resolves the daemon HTTP base URL once, at the start of {@link McpToolServerHandle.run}. May be sync or async (e.g. wraps `@jini/cli`'s `resolveDaemonUrl`). */
  readonly resolveBaseUrl: () => Promise<string> | string;
  /** Free-text guidance surfaced to the MCP client alongside the tool list. Optional — omit for a caller with nothing to add beyond each tool's own `description`. */
  readonly instructions?: string;
  /** Idle-exit window in ms. Defaults to {@link DEFAULT_IDLE_MS}. */
  readonly idleMs?: number;
  /** Defaults to the global `fetch`; threaded into every tool call's {@link McpToolContext}. */
  readonly fetchImpl?: typeof fetch;
  /** Defaults to `process.stdin`; inject for tests (or an alternate stdio pair). */
  readonly stdin?: Readable;
  /** Defaults to `process.stdout`; inject for tests. */
  readonly stdout?: Writable;
  /** Test/embedding seam: builds the underlying `Server`. Defaults to the real `@modelcontextprotocol/sdk` `Server`. */
  readonly createServer?: (info: Implementation, options: ServerOptions) => McpServerLike;
  /** Test/embedding seam: builds the underlying transport. Defaults to the real `StdioServerTransport`. */
  readonly createTransport?: (stdin?: Readable, stdout?: Writable) => McpTransportLike;
}

export interface McpToolServerHandle {
  /**
   * Resolves the daemon base URL, connects the MCP server to its transport, and holds the process
   * open until the client disconnects (stdin EOF) or the idle-exit window elapses. Resolves once
   * the transport has closed.
   */
  run(): Promise<void>;
}

function defaultCreateServer(info: Implementation, options: ServerOptions): McpServerLike {
  return new Server(info, options) as unknown as McpServerLike;
}

function defaultCreateTransport(stdin?: Readable, stdout?: Writable): McpTransportLike {
  return new StdioServerTransport(stdin, stdout) as unknown as McpTransportLike;
}

/**
 * Builds a stdio MCP server hosting `options.tools`. Construction is synchronous and cheap
 * (validates tool-name uniqueness via {@link buildToolIndex}); all I/O — resolving the daemon URL,
 * connecting the transport, serving requests — happens in the returned handle's `run()`.
 */
export function createMcpToolServer(options: McpToolServerOptions): McpToolServerHandle {
  const toolIndex = buildToolIndex(options.tools);
  const createServer = options.createServer ?? defaultCreateServer;
  const createTransport = options.createTransport ?? defaultCreateTransport;

  return {
    async run(): Promise<void> {
      const resolvedBaseUrl = await options.resolveBaseUrl();
      const ctx: McpToolContext = {
        baseUrl: String(resolvedBaseUrl).replace(/\/$/, ''),
        fetchImpl: options.fetchImpl ?? fetch,
      };

      let closeTransportForIdle: (() => void) | null = null;
      const idleExit = createMcpIdleExitController({
        idleMs: options.idleMs ?? DEFAULT_IDLE_MS,
        onIdle: () => closeTransportForIdle?.(),
      });
      const withActivity =
        <Args extends unknown[], Result>(handler: (...args: Args) => Result | Promise<Result>) =>
          (...args: Args) =>
            idleExit.trackRequest(() => handler(...args));

      const server = createServer(
        { name: options.name, version: options.version },
        {
          capabilities: { tools: {} },
          ...(options.instructions !== undefined ? { instructions: options.instructions } : {}),
        },
      );

      server.setRequestHandler(
        ListToolsRequestSchema,
        withActivity(async () => ({ tools: toolsToList(options.tools) })),
      );

      server.setRequestHandler(
        CallToolRequestSchema,
        withActivity(async (request) => handleToolCall(request.params.name, request.params.arguments, toolIndex, ctx)),
      );

      const transport = createTransport(options.stdin, options.stdout);
      try {
        closeTransportForIdle = () => {
          void transport.close().catch(() => {});
        };
        await server.connect(transport);

        // `connect()` sets `transport.onmessage` to its own protocol-dispatch handler; wrap it so
        // every inbound message also counts as activity for the idle-exit timer, without losing
        // the SDK's own routing.
        const sdkOnMessage = transport.onmessage;
        transport.onmessage = (message) => {
          idleExit.noteActivity();
          sdkOnMessage?.(message);
        };

        const stdin = options.stdin ?? process.stdin;
        await new Promise<void>((resolve) => {
          const sdkOnClose = transport.onclose;
          let finished = false;
          const done = () => {
            if (finished) return;
            finished = true;
            idleExit.dispose();
            resolve();
          };
          transport.onclose = () => {
            sdkOnClose?.();
            done();
          };
          const closeTransportForStdin = () => {
            void transport.close().catch(() => done());
          };
          // Hold the process open until the client disconnects (stdin EOF) — `connect()` only
          // starts the transport, it doesn't wait for the stream to close.
          stdin.once('end', closeTransportForStdin);
          stdin.once('close', closeTransportForStdin);
        });
      } finally {
        idleExit.dispose();
        closeTransportForIdle = null;
      }
    },
  };
}
