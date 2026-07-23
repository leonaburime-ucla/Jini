import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createAgentExecutor } from '@jini/daemon';
import { createLocalNodeDaemon } from '@jini/node-host';
import type { RunAgentPayload } from '@jini/protocol';

const PLAYGROUND_PREFIX = 'playground:';
const PLAYGROUND_PORT = 4317;
const PROJECTS = new Set(['starter-site', 'bug-hunt']);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = resolve(repoRoot, '.jini/playground');

interface PlaygroundRunRequest {
  prompt: string;
  project: string;
}

function decodeRunRequest(contextRef: string): PlaygroundRunRequest {
  if (!contextRef.startsWith(PLAYGROUND_PREFIX)) {
    throw new Error('Jini Playground received an unsupported run context');
  }
  const parsed = JSON.parse(Buffer.from(contextRef.slice(PLAYGROUND_PREFIX.length), 'base64url').toString('utf8')) as Partial<PlaygroundRunRequest>;
  if (typeof parsed.prompt !== 'string' || parsed.prompt.trim().length === 0) {
    throw new Error('Jini Playground requires a non-empty prompt');
  }
  if (typeof parsed.project !== 'string' || !PROJECTS.has(parsed.project)) {
    throw new Error('Jini Playground received an unknown sample project');
  }
  return { prompt: parsed.prompt, project: parsed.project };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function runDemo(
  runId: string,
  prompt: string,
  project: string,
  lifecycle: Parameters<NonNullable<Parameters<typeof createLocalNodeDaemon>[0]['onRunStarted']>>[0]['lifecycle'],
): Promise<void> {
  let canceled = false;
  lifecycle.onCancelRequested(runId, () => {
    canceled = true;
  });

  const emitAgent = (data: RunAgentPayload) => lifecycle.emit(runId, { event: 'agent', data });
  const stopIfCanceled = async (): Promise<boolean> => {
    if (!canceled) return false;
    await lifecycle.finish({ runId, status: 'cancelled', code: null, signal: null, resumable: false });
    return true;
  };

  await emitAgent({ type: 'status', label: 'Inspecting workspace', detail: `examples/sample-projects/${project}` });
  await delay(260);
  if (await stopIfCanceled()) return;

  await emitAgent({ type: 'tool_use', id: `${runId}-inspect`, name: 'workspace.inspect', input: { project } });
  await delay(320);
  if (await stopIfCanceled()) return;

  const inspectedFiles =
    project === 'starter-site'
      ? ['index.html', 'styles.css', 'app.js', 'README.md']
      : ['src/cart.js', 'test/cart.test.js', 'README.md'];
  await emitAgent({
    type: 'tool_result',
    toolUseId: `${runId}-inspect`,
    content: `Found ${inspectedFiles.length} files: ${inspectedFiles.join(', ')}`,
    isError: false,
  });

  const response = [
    `I inspected **${project}** through the Jini daemon and received your request:\n\n> ${prompt.trim()}\n\n`,
    project === 'bug-hunt'
      ? 'The sample has an intentional cart-total defect and a focused Node test that exposes it. A good first live-agent task is: **“run the tests, explain the failure, and fix only the bug.”**'
      : 'This is a zero-dependency browser project. A good first live-agent task is: **“add a filter for completed items while preserving the existing visual style.”**',
    '\n\nThis response used a durable run, replayable SSE events, and the shared `@jini/chat-react` renderer.',
  ];

  for (const chunk of response) {
    await delay(220);
    if (await stopIfCanceled()) return;
    await emitAgent({ type: 'text_delta', delta: chunk });
  }
  await emitAgent({ type: 'usage', usage: { input_tokens: 34, output_tokens: 118 }, durationMs: 1_230 });
  await lifecycle.finish({ runId, status: 'succeeded', code: 0, signal: null, resumable: false });
}

async function main(): Promise<void> {
  mkdirSync(dataDir, { recursive: true });
  process.env.JINI_DISABLE_API_AUTH = '1';
  process.env.JINI_ALLOWED_ORIGINS = 'http://127.0.0.1:4173,http://localhost:4173';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  const daemon = await createLocalNodeDaemon({
    dataDir,
    port: PLAYGROUND_PORT,
    packs: [],
    env,
    resolveWorkspaceRoot: ({ resourceRef }) =>
      PROJECTS.has(resourceRef) ? resolve(repoRoot, 'examples/sample-projects', resourceRef) : undefined,
    onRunStarted: ({ request, run, lifecycle }) => {
      const decoded = decodeRunRequest(request.contextRef);
      if (request.agentId === undefined || request.agentId === 'playground-demo') {
        void runDemo(run.id, decoded.prompt, decoded.project, lifecycle).catch((error: unknown) => {
          console.error('[Jini Playground] demo run failed', error);
        });
        return;
      }

      const executor = createAgentExecutor({ lifecycle });
      void executor
        .run({
          runId: run.id,
          agentId: request.agentId,
          prompt: decoded.prompt,
          cwd: resolve(repoRoot, 'examples/sample-projects', decoded.project),
        })
        .catch((error: unknown) => {
          console.error(`[Jini Playground] ${request.agentId} run failed`, error);
        });
    },
  });

  console.log(`[Jini Playground] daemon ready at ${daemon.url}`);
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void daemon.stop().finally(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

void main().catch((error: unknown) => {
  console.error('[Jini Playground] daemon failed to start', error);
  process.exitCode = 1;
});
