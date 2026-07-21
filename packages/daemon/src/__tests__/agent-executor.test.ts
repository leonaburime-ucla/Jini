import { EventEmitter } from 'node:events';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { RunAgentPayload, RunErrorPayload, RunProtocolEvent } from '@jini/protocol';
import { attachAcpSession, type AcpSessionController, type AgentLaunchResolution, type RuntimeAgentDef } from '@jini/agent-runtime';
import { createInMemoryEventLog } from '../event-log.js';
import { createRunLifecycle, type RunLifecycle } from '../run-lifecycle.js';
import {
  AgentExecutorError,
  createAgentExecutor,
  isSupportedStreamFormat,
  translateAgentRuntimeEvent,
  type AgentExecutor,
} from '../agent-executor.js';

// ---------------------------------------------------------------------------
// Fake child-process harness — extends the .stdout/.stderr sub-EventEmitter +
// .kill(signal)-emitting-'close' shape from
// packages/agent-runtime/src/__tests__/terminal-launch.test.ts's
// vi.mock('node:child_process', ...) pattern, but wired via AgentExecutor's
// own injectable `spawn` seam instead of a module mock — no real subprocess,
// no real filesystem access, matching this package's established
// dependency-injection convention (see tool-executor.ts/run-lifecycle.ts).
// ---------------------------------------------------------------------------

interface FakeWritable extends EventEmitter {
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  writes: string[];
  ended: boolean;
}

function createFakeStdin(): FakeWritable {
  const stdin = new EventEmitter() as FakeWritable;
  stdin.writes = [];
  stdin.ended = false;
  stdin.write = vi.fn((chunk: string) => {
    stdin.writes.push(String(chunk));
    return true;
  });
  stdin.end = vi.fn(() => {
    stdin.ended = true;
  });
  return stdin;
}

interface FakeChild extends EventEmitter {
  pid: number | undefined;
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: FakeWritable | undefined;
}

// No default parameter here on purpose: `createFakeChild(undefined)` (the
// harness's explicit "no pid assigned yet" test case) must actually leave
// `child.pid` as `undefined`, which a JS default parameter would silently
// override back to a fallback since default parameters trigger on an
// `undefined` argument, not just an omitted one.
function createFakeChild(pid: number | undefined, options: { omitStdin?: boolean } = {}): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = options.omitStdin ? undefined : createFakeStdin();
  return child;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createFakeDef(overrides: Partial<RuntimeAgentDef> = {}): RuntimeAgentDef {
  return {
    id: 'fake-agent',
    name: 'Fake Agent',
    bin: 'fake-bin',
    versionArgs: ['--version'],
    fallbackModels: [],
    buildArgs: () => ['--flag'],
    streamFormat: 'json-event-stream',
    eventParser: 'codex',
    promptViaStdin: true,
    ...overrides,
  };
}

interface SpawnCall {
  command: string;
  args: string[];
  options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: unknown };
}

interface HarnessOptions {
  def?: RuntimeAgentDef | null;
  launchPath?: string | null;
  spawnThrows?: unknown;
  spawnErrorEvent?: unknown;
  childPid?: number | undefined;
  omitStdin?: boolean;
}

interface Harness {
  lifecycle: RunLifecycle;
  executor: AgentExecutor;
  child: FakeChild;
  spawnCalls: SpawnCall[];
  stopProcessesCalls: Array<Array<number | null | undefined>>;
}

/** Builds a real in-memory `RunLifecycle` (matching run-lifecycle.test.ts's precedent) plus an `AgentExecutor` wired entirely to injected fakes — no real subprocess, filesystem, or PATH lookup. */
function createHarness(options: HarnessOptions = {}): Harness {
  const eventLog = createInMemoryEventLog();
  const lifecycle = createRunLifecycle({ eventLog });
  const child = createFakeChild('childPid' in options ? options.childPid : 4242, {
    ...(options.omitStdin !== undefined ? { omitStdin: options.omitStdin } : {}),
  });
  const spawnCalls: SpawnCall[] = [];
  const stopProcessesCalls: Array<Array<number | null | undefined>> = [];

  const def = options.def === undefined ? createFakeDef() : options.def;
  const launchPath = options.launchPath === undefined ? '/fake/bin' : options.launchPath;

  const fakeSpawn = ((command: string, args: readonly string[], spawnOptions: unknown) => {
    spawnCalls.push({ command, args: [...args], options: spawnOptions as SpawnCall['options'] });
    if (options.spawnThrows) {
      throw options.spawnThrows;
    }
    if (options.spawnErrorEvent) {
      queueMicrotask(() => child.emit('error', options.spawnErrorEvent));
    } else {
      queueMicrotask(() => child.emit('spawn'));
    }
    return child as unknown as ChildProcess;
  }) as unknown as typeof nodeSpawn;

  const executor = createAgentExecutor({
    lifecycle,
    getAgentDef: (id: string) => (def && def.id === id ? def : null),
    resolveAgentLaunch: () =>
      ({
        selectedPath: launchPath,
        pathResolvedPath: launchPath,
        configuredOverridePath: null,
        launchPath,
        launchKind: 'selected',
        childPathPrepend: [],
        diagnostic: null,
      }) as AgentLaunchResolution,
    applyAgentLaunchEnv: (env) => env,
    spawn: fakeSpawn,
    listProcessSnapshots: async () => {
      const pid = child.pid ?? 0;
      return [
        { pid, ppid: 1, command: 'fake-bin' },
        { pid: pid + 1, ppid: pid, command: 'fake-bin --mcp-helper' },
      ];
    },
    stopProcesses: async (pids) => {
      stopProcessesCalls.push(pids);
      const numericPids = pids.filter((pid): pid is number => typeof pid === 'number');
      return { alreadyStopped: false, forcedPids: [], matchedPids: numericPids, remainingPids: [], stoppedPids: numericPids };
    },
  });

  return { lifecycle, executor, child, spawnCalls, stopProcessesCalls };
}

async function collectEvents(lifecycle: RunLifecycle, runId: string): Promise<RunProtocolEvent[]> {
  const events: RunProtocolEvent[] = [];
  await lifecycle.stream(runId, (event) => events.push(event));
  return events;
}

function agentPayloadTypes(events: RunProtocolEvent[]): string[] {
  return events.filter((event) => event.kind === 'agent').map((event) => (event.payload as RunAgentPayload).type);
}

describe('AgentExecutor — successful run end-to-end', () => {
  it('spawns the resolved binary, streams a realistic codex-shaped turn, and finishes succeeded', async () => {
    const { lifecycle, executor, child, spawnCalls } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'do the thing', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0]?.command).toBe('/fake/bin');
    expect(spawnCalls[0]?.args).toEqual(['--flag']);
    expect(spawnCalls[0]?.options.cwd).toBe('/work');
    expect(spawnCalls[0]?.options.stdio).toEqual(['pipe', 'pipe', 'pipe']);

    // status (thread.started) — a line deliberately split mid-object across
    // two 'data' events to prove the parser's own buffering (and this
    // driver's chunk-by-chunk forwarding) survives a split-chunk delivery.
    child.stdout.emit('data', Buffer.from('{"type":"thread.started",'));
    child.stdout.emit('data', '"thread_id":"sess-abc"}\n');
    // status (turn.started -> "thinking")
    child.stdout.emit('data', '{"type":"turn.started"}\n');
    // tool_use (Bash)
    child.stdout.emit(
      'data',
      '{"type":"item.started","item":{"id":"call-1","type":"command_execution","command":"echo hi"}}\n',
    );
    // tool_result for the same call id (tool_use already emitted, guarded against re-emission)
    child.stdout.emit(
      'data',
      '{"type":"item.completed","item":{"id":"call-1","type":"command_execution","command":"echo hi","aggregated_output":"hi\\n","exit_code":0}}\n',
    );
    // text_delta
    child.stdout.emit('data', '{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}\n');
    // usage
    child.stdout.emit('data', '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}\n');
    // raw stderr forwarding
    child.stderr.emit('data', 'warning: low disk space\n');

    child.emit('close', 0, null);
    const finished = await lifecycle.waitForTerminal(run.id);
    expect(finished.state).toBe('succeeded');

    const events = await collectEvents(lifecycle, run.id);
    expect(agentPayloadTypes(events)).toEqual(['status', 'status', 'tool_use', 'tool_result', 'text_delta', 'usage']);

    const stdoutChunks = events.filter((e) => e.kind === 'stdout').map((e) => (e.payload as { chunk: string }).chunk);
    expect(stdoutChunks.join('')).toContain('"thread_id":"sess-abc"');
    expect(stdoutChunks.some((chunk) => chunk === '{"type":"thread.started",')).toBe(true);

    const stderrEvents = events.filter((e) => e.kind === 'stderr');
    expect(stderrEvents).toHaveLength(1);
    expect((stderrEvents[0]?.payload as { chunk: string }).chunk).toBe('warning: low disk space\n');

    const toolUseEvent = events.find((e) => e.kind === 'agent' && (e.payload as RunAgentPayload).type === 'tool_use');
    expect(toolUseEvent?.payload).toMatchObject({ id: 'call-1', name: 'Bash', input: { command: 'echo hi' } });

    const endEvent = events[events.length - 1];
    expect(endEvent).toMatchObject({ kind: 'end', payload: { status: 'succeeded', code: 0, signal: null } });
  });
});

describe('AgentExecutor — pre-spawn failure paths never bare-throw', () => {
  it('rejects with AGENT_NOT_FOUND for an unknown agentId and finishes the run failed', async () => {
    const { lifecycle, executor } = createHarness({ def: null });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'nope', prompt: 'x', cwd: '/work' })).rejects.toThrow(
      AgentExecutorError,
    );
    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('failed');

    try {
      await executor.run({ runId: run.id, agentId: 'nope', prompt: 'x', cwd: '/work' });
    } catch (err) {
      expect(err).toBeInstanceOf(AgentExecutorError);
      expect((err as AgentExecutorError).code).toBe('AGENT_NOT_FOUND');
    }
  });

  it('rejects with AGENT_RUNTIME_UNSUPPORTED for a def whose streamFormat has no implemented driver', async () => {
    const { lifecycle, executor } = createHarness({ def: createFakeDef({ streamFormat: 'pi-rpc' }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_RUNTIME_UNSUPPORTED',
    });
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });

  it('rejects with AGENT_RUNTIME_UNSUPPORTED for a def that does not deliver its prompt via stdin', async () => {
    const { lifecycle, executor } = createHarness({ def: createFakeDef({ promptViaStdin: false }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_RUNTIME_UNSUPPORTED',
    });
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });

  it('rejects with AGENT_BINARY_NOT_RESOLVED when the launch resolver finds no executable', async () => {
    const { lifecycle, executor } = createHarness({ launchPath: null });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_BINARY_NOT_RESOLVED',
    });
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });
});

describe('AgentExecutor — spawn failure paths never bare-throw', () => {
  it('rejects with AGENT_SPAWN_FAILED when spawn() throws synchronously', async () => {
    const { lifecycle, executor } = createHarness({ spawnThrows: new Error('EACCES') });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_SPAWN_FAILED',
    });
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });

  it('stringifies a non-Error synchronous spawn throw', async () => {
    const { lifecycle, executor } = createHarness({ spawnThrows: 'plain string failure' });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_SPAWN_FAILED',
      message: expect.stringContaining('plain string failure'),
    });
  });

  it('rejects with AGENT_SPAWN_FAILED when the child emits "error" before "spawn"', async () => {
    const { lifecycle, executor } = createHarness({ spawnErrorEvent: new Error('ENOENT') });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).rejects.toMatchObject({
      code: 'AGENT_SPAWN_FAILED',
    });
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });
});

describe('AgentExecutor — prompt delivery over stdin', () => {
  it('a text-format def writes the raw prompt and closes stdin immediately at spawn', async () => {
    const { lifecycle, executor, child } = createHarness({ def: createFakeDef({ promptInputFormat: 'text' }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'hello there', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(child.stdin!.writes).toEqual(['hello there']);
    expect(child.stdin!.end).toHaveBeenCalledTimes(1);
  });

  it('a stream-json def writes one wrapped JSONL user-message line and does NOT close stdin until turn_end', async () => {
    const { lifecycle, executor, child } = createHarness({ def: createFakeDef({ promptInputFormat: 'stream-json' }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'hello there', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(child.stdin!.writes).toHaveLength(1);
    expect(JSON.parse(child.stdin!.writes[0]!.trim())).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hello there' }] },
    });
    expect(child.stdin!.end).not.toHaveBeenCalled();

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });

  it('a def whose child.stdin is unexpectedly absent no-ops instead of throwing', async () => {
    const { lifecycle, executor, child } = createHarness({ omitStdin: true });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await expect(executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' })).resolves.toBeUndefined();

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });
});

describe('AgentExecutor — turn_end closes stdin exactly once', () => {
  it('closes stdin on the first turn_end and is idempotent against a second one', async () => {
    const def = createFakeDef({ streamFormat: 'claude-stream-json', promptInputFormat: 'stream-json' });
    const { lifecycle, executor, child } = createHarness({ def });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'hi', cwd: '/work' });
    await flushAsync();
    await runPromise;
    expect(child.stdin!.end).not.toHaveBeenCalled();

    const assistantTurnEnd =
      '{"type":"assistant","message":{"id":"m1","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn"}}\n';
    child.stdout.emit('data', assistantTurnEnd);
    await flushAsync();
    expect(child.stdin!.end).toHaveBeenCalledTimes(1);

    // A buggy/duplicate second turn_end must not double-close.
    child.stdout.emit('data', assistantTurnEnd.replace('"id":"m1"', '"id":"m2"'));
    await flushAsync();
    expect(child.stdin!.end).toHaveBeenCalledTimes(1);

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });
});

describe('AgentExecutor — stream-format dispatch covers every supported parser', () => {
  it('dispatches copilot-stream-json to the copilot parser', async () => {
    const { lifecycle, executor, child } = createHarness({ def: createFakeDef({ streamFormat: 'copilot-stream-json' }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.stdout.emit('data', '{"type":"assistant.message_delta","data":{"deltaContent":"hi"}}\n');
    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    expect(agentPayloadTypes(events)).toEqual(['text_delta']);
  });

  it('dispatches qoder-stream-json to the qoder parser', async () => {
    const { lifecycle, executor, child } = createHarness({ def: createFakeDef({ streamFormat: 'qoder-stream-json' }) });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.stdout.emit(
      'data',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n',
    );
    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    expect(agentPayloadTypes(events)).toEqual(['text_delta']);
  });

  it('a json-event-stream def with no eventParser degrades to that parser\'s own raw fallback rather than throwing', async () => {
    const { eventParser: _omitted, ...rest } = createFakeDef();
    const { lifecycle, executor, child } = createHarness({ def: rest as RuntimeAgentDef });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.stdout.emit('data', '{"type":"thread.started","thread_id":"sess-abc"}\n');
    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    expect(agentPayloadTypes(events)).toEqual(['raw']);
  });
});

describe('AgentExecutor — a parsed error-typed stream event routes to the error run-event, not agent', () => {
  it('does not forward the error event as an "agent" run event', async () => {
    const { lifecycle, executor, child } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.stdout.emit('data', '{"type":"error","message":"boom"}\n');
    child.emit('close', 1, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    const errorEvent = events.find((e) => e.kind === 'error');
    expect(errorEvent?.payload).toEqual({ message: 'boom' });
    expect(events.some((e) => e.kind === 'agent')).toBe(false);
  });
});

describe('AgentExecutor — a single failed queued emit does not block the run from reaching a terminal state', () => {
  it('swallows an emit() race against an already-terminal run instead of leaving an unhandled rejection', async () => {
    const { lifecycle, executor, child } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    // Artificially finish the run out-of-band (simulating a real race
    // where 'close' already ran and called finish() before a straggling
    // 'data' event is delivered) so the next emit() call is guaranteed to
    // throw ("cannot emit on terminal run") — proves enqueueEmit's
    // per-task try/catch isolates that failure rather than propagating an
    // unhandled rejection.
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    expect(() => child.stdout.emit('data', '{"type":"turn.started"}\n')).not.toThrow();
    await flushAsync();

    // A second 'close' (the real one, arriving after our synthetic early
    // finish()) must still complete without throwing — finish() is
    // idempotent, matching RunLifecycle's own contract.
    expect(() => child.emit('close', 0, null)).not.toThrow();
    await flushAsync();

    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('succeeded');
  });
});

describe('AgentExecutor — cancellation', () => {
  it('escalates to the full descendant process tree via stopProcesses and finishes cancelled', async () => {
    const { lifecycle, executor, child, stopProcessesCalls } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    await lifecycle.cancel({ runId: run.id, reason: 'user requested' });
    await flushAsync();

    expect(stopProcessesCalls).toHaveLength(1);
    expect(stopProcessesCalls[0]).toEqual(expect.arrayContaining([4242, 4243]));

    child.emit('close', null, 'SIGTERM');
    const finished = await lifecycle.waitForTerminal(run.id);
    expect(finished.state).toBe('cancelled');
  });

  it('is a no-op when the child has no pid yet (cancelled before spawn ever assigned one)', async () => {
    const { lifecycle, executor, stopProcessesCalls } = createHarness({ childPid: undefined });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await lifecycle.cancel({ runId: run.id });
    await flushAsync();

    expect(stopProcessesCalls).toHaveLength(0);
    await runPromise.catch(() => {});
  });

  it('a cancellation requested before run() is even called is still observed via onCancelRequested replay', async () => {
    const { lifecycle, executor, stopProcessesCalls } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await lifecycle.cancel({ runId: run.id });
    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(stopProcessesCalls).toHaveLength(1);
  });
});

describe('AgentExecutor — defensive listeners never crash the host process', () => {
  it('tolerates a late child-level "error" event after spawn confirmed', async () => {
    const { lifecycle, executor, child } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(() => child.emit('error', new Error('late, unrelated error'))).not.toThrow();

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });

  it('tolerates an EPIPE-shaped stdin "error" event', async () => {
    const { lifecycle, executor, child } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(() => child.stdin!.emit('error', Object.assign(new Error('EPIPE'), { code: 'EPIPE' }))).not.toThrow();

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });

  it('a malformed JSON stdout line is forwarded as a raw agent event instead of crashing the parser', async () => {
    const { lifecycle, executor, child } = createHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.stdout.emit('data', 'not json at all\n');
    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    const rawEvent = events.find((e) => e.kind === 'agent' && (e.payload as RunAgentPayload).type === 'raw');
    expect(rawEvent?.payload).toEqual({ type: 'raw', line: 'not json at all' });
  });
});

describe('isSupportedStreamFormat', () => {
  it('accepts the JSON-stream and ACP formats with real drivers, and rejects the remaining formats', () => {
    expect(isSupportedStreamFormat('claude-stream-json')).toBe(true);
    expect(isSupportedStreamFormat('json-event-stream')).toBe(true);
    expect(isSupportedStreamFormat('copilot-stream-json')).toBe(true);
    expect(isSupportedStreamFormat('qoder-stream-json')).toBe(true);
    expect(isSupportedStreamFormat('acp-json-rpc')).toBe(true);
    expect(isSupportedStreamFormat('pi-rpc')).toBe(false);
    expect(isSupportedStreamFormat('plain')).toBe(false);
  });
});

describe('createAgentExecutor — real default collaborators', () => {
  it('constructs cleanly with only { lifecycle } — every collaborator falls back to its real @jini/agent-runtime / @jini/platform / node:child_process default', () => {
    const lifecycle = createRunLifecycle({ eventLog: createInMemoryEventLog() });
    const executor = createAgentExecutor({ lifecycle });
    expect(typeof executor.run).toBe('function');
  });
});

describe('AgentExecutorError', () => {
  it('carries a machine-readable code alongside the human-readable message', () => {
    const err = new AgentExecutorError('AGENT_NOT_FOUND', 'unknown agentId "x"');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AgentExecutorError');
    expect(err.code).toBe('AGENT_NOT_FOUND');
    expect(err.message).toBe('unknown agentId "x"');
  });
});

describe('translateAgentRuntimeEvent', () => {
  it('ignores non-record input and records with a missing/non-string type', () => {
    expect(translateAgentRuntimeEvent(null)).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent(undefined)).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent('a string')).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent(42)).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent([])).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent({})).toEqual({ kind: 'ignored' });
    expect(translateAgentRuntimeEvent({ type: 123 })).toEqual({ kind: 'ignored' });
  });

  it('ignores an unrecognized type value', () => {
    expect(translateAgentRuntimeEvent({ type: 'some_future_event' })).toEqual({ kind: 'ignored' });
  });

  it('translates status with every optional field present', () => {
    expect(translateAgentRuntimeEvent({ type: 'status', label: 'streaming', model: 'gpt-5', ttftMs: 120, detail: 'note' })).toEqual({
      kind: 'agent',
      payload: { type: 'status', label: 'streaming', model: 'gpt-5', ttftMs: 120, detail: 'note' },
    });
  });

  it('translates status with only the required label, and defaults a missing label to "unknown"', () => {
    expect(translateAgentRuntimeEvent({ type: 'status', label: 'thinking' })).toEqual({
      kind: 'agent',
      payload: { type: 'status', label: 'thinking' },
    });
    expect(translateAgentRuntimeEvent({ type: 'status' })).toEqual({
      kind: 'agent',
      payload: { type: 'status', label: 'unknown' },
    });
  });

  it('translates status carrying only sessionId (dropped — no RunAgentPayload field for it)', () => {
    expect(translateAgentRuntimeEvent({ type: 'status', label: 'initializing', sessionId: 'sess-1' })).toEqual({
      kind: 'agent',
      payload: { type: 'status', label: 'initializing' },
    });
  });

  it('translates text_delta, defaulting a non-string delta to an empty string', () => {
    expect(translateAgentRuntimeEvent({ type: 'text_delta', delta: 'hi' })).toEqual({
      kind: 'agent',
      payload: { type: 'text_delta', delta: 'hi' },
    });
    expect(translateAgentRuntimeEvent({ type: 'text_delta' })).toEqual({
      kind: 'agent',
      payload: { type: 'text_delta', delta: '' },
    });
  });

  it('translates thinking_start with no fields', () => {
    expect(translateAgentRuntimeEvent({ type: 'thinking_start' })).toEqual({ kind: 'agent', payload: { type: 'thinking_start' } });
  });

  it('translates thinking_delta', () => {
    expect(translateAgentRuntimeEvent({ type: 'thinking_delta', delta: 'pondering' })).toEqual({
      kind: 'agent',
      payload: { type: 'thinking_delta', delta: 'pondering' },
    });
  });

  it('translates tool_use normally', () => {
    expect(translateAgentRuntimeEvent({ type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'ls' } })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'ls' } },
    });
  });

  it('adversarial: coerces a null id/name (copilot\'s tool.execution_start shape) instead of crashing or propagating null', () => {
    expect(translateAgentRuntimeEvent({ type: 'tool_use', id: null, name: null, input: null })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_use', id: '', name: '', input: null },
    });
  });

  it('defaults a missing tool_use input to null', () => {
    expect(translateAgentRuntimeEvent({ type: 'tool_use', id: 'c1', name: 'Bash' })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_use', id: 'c1', name: 'Bash', input: null },
    });
  });

  it('translates tool_input_delta', () => {
    expect(translateAgentRuntimeEvent({ type: 'tool_input_delta', id: 'c1', name: 'Bash', delta: '{"cmd":' })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_input_delta', id: 'c1', name: 'Bash', delta: '{"cmd":' },
    });
  });

  it('translates tool_result with isError true/false/absent, and coerces a non-string toolUseId', () => {
    expect(translateAgentRuntimeEvent({ type: 'tool_result', toolUseId: 'c1', content: 'ok', isError: false })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_result', toolUseId: 'c1', content: 'ok', isError: false },
    });
    expect(translateAgentRuntimeEvent({ type: 'tool_result', toolUseId: 'c1', content: 'boom', isError: true })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_result', toolUseId: 'c1', content: 'boom', isError: true },
    });
    expect(translateAgentRuntimeEvent({ type: 'tool_result', toolUseId: null, content: 'ok' })).toEqual({
      kind: 'agent',
      payload: { type: 'tool_result', toolUseId: '', content: 'ok' },
    });
  });

  it('translates usage with only input/output tokens carried through — other sub-fields are documented drops', () => {
    expect(
      translateAgentRuntimeEvent({
        type: 'usage',
        usage: { input_tokens: 10, output_tokens: 5, thought_tokens: 3, cached_read_tokens: 2 },
        costUsd: 0.01,
        durationMs: 500,
      }),
    ).toEqual({
      kind: 'agent',
      payload: { type: 'usage', usage: { input_tokens: 10, output_tokens: 5 }, costUsd: 0.01, durationMs: 500 },
    });
  });

  it('translates usage with only input_tokens present (output_tokens independently absent)', () => {
    expect(translateAgentRuntimeEvent({ type: 'usage', usage: { input_tokens: 7 } })).toEqual({
      kind: 'agent',
      payload: { type: 'usage', usage: { input_tokens: 7 } },
    });
  });

  it('translates usage with only output_tokens present (input_tokens independently absent)', () => {
    expect(translateAgentRuntimeEvent({ type: 'usage', usage: { output_tokens: 4 } })).toEqual({
      kind: 'agent',
      payload: { type: 'usage', usage: { output_tokens: 4 } },
    });
  });

  it('translates usage with a null/absent usage object as an omitted usage field', () => {
    expect(translateAgentRuntimeEvent({ type: 'usage', usage: null, costUsd: 1 })).toEqual({
      kind: 'agent',
      payload: { type: 'usage', costUsd: 1 },
    });
    expect(translateAgentRuntimeEvent({ type: 'usage' })).toEqual({ kind: 'agent', payload: { type: 'usage' } });
  });

  it('translates raw', () => {
    expect(translateAgentRuntimeEvent({ type: 'raw', line: 'not json' })).toEqual({
      kind: 'agent',
      payload: { type: 'raw', line: 'not json' },
    });
  });

  it('routes error to the error kind, defaulting a missing message and attaching code when present', () => {
    expect(translateAgentRuntimeEvent({ type: 'error', message: 'boom' })).toEqual({
      kind: 'error',
      payload: { message: 'boom' },
    });
    expect(translateAgentRuntimeEvent({ type: 'error' })).toEqual({
      kind: 'error',
      payload: { message: 'Unknown agent error' },
    });
    expect(translateAgentRuntimeEvent({ type: 'error', message: 'auth failed', code: 'AUTH_REQUIRED' })).toEqual({
      kind: 'error',
      payload: { message: 'auth failed', error: { code: 'AUTH_REQUIRED', message: 'auth failed' } },
    });
  });

  it('routes turn_end to the turn-end kind with no payload', () => {
    expect(translateAgentRuntimeEvent({ type: 'turn_end', stopReason: 'end_turn' })).toEqual({ kind: 'turn-end' });
  });
});

// ---------------------------------------------------------------------------
// ACP dispatch — a fake `attachAcpSession` (this driver's own injectable seam
// for `@jini/agent-runtime`'s real ACP transport, matching the `spawn`/
// `getAgentDef`/`resolveAgentLaunch` fakes above) drives `wireAcpLifecycle`'s
// internal branches without a real ACP subprocess. The real handshake is
// covered separately by agent-executor-acp.integration.test.ts's actual
// subprocess fixture; these tests isolate this driver's own event
// translation, cancellation, and error-mapping logic instead.
// ---------------------------------------------------------------------------

interface FakeAcpAttachCall {
  readonly prompt: string;
  readonly cwd: string;
  readonly envFormat: 'array' | 'map' | undefined;
  readonly onPermissionRequest: unknown;
  readonly send: (event: string, payload: unknown) => void;
}

interface AcpHarnessOptions {
  def?: Partial<RuntimeAgentDef>;
  completedSuccessfully?: boolean;
  acpPermissionHandler?: unknown;
  attachThrows?: unknown;
}

interface AcpHarness {
  lifecycle: RunLifecycle;
  executor: AgentExecutor;
  child: FakeChild;
  attachCalls: FakeAcpAttachCall[];
  abort: ReturnType<typeof vi.fn>;
  stopProcessesCalls: Array<Array<number | null | undefined>>;
}

/** Builds an `AgentExecutor` wired to an `acp-json-rpc` def and a fully fake `attachAcpSession` — no real ACP handshake, matching `createHarness`'s JSON-stream-path precedent above. */
function createAcpHarness(options: AcpHarnessOptions = {}): AcpHarness {
  const eventLog = createInMemoryEventLog();
  const lifecycle = createRunLifecycle({ eventLog });
  const child = createFakeChild(5100);
  const def = createFakeDef({ streamFormat: 'acp-json-rpc', ...options.def });
  const attachCalls: FakeAcpAttachCall[] = [];
  const abort = vi.fn();
  const stopProcessesCalls: Array<Array<number | null | undefined>> = [];

  const fakeSpawn = (() => {
    queueMicrotask(() => child.emit('spawn'));
    return child as unknown as ChildProcess;
  }) as unknown as typeof nodeSpawn;

  const fakeAttachAcpSession = ((attachOptions: {
    prompt: string;
    cwd: string;
    envFormat?: 'array' | 'map';
    onPermissionRequest?: unknown;
    send: (event: string, payload: unknown) => void;
  }) => {
    attachCalls.push({
      prompt: attachOptions.prompt,
      cwd: attachOptions.cwd,
      envFormat: attachOptions.envFormat,
      onPermissionRequest: attachOptions.onPermissionRequest,
      send: attachOptions.send,
    });
    if (options.attachThrows) {
      throw options.attachThrows;
    }
    const controller: AcpSessionController = {
      hasFatalError: () => false,
      getDurableSessionId: () => null,
      completedSuccessfully: () => options.completedSuccessfully ?? true,
      abort,
    };
    return controller;
  }) as unknown as typeof attachAcpSession;

  const executor = createAgentExecutor({
    lifecycle,
    getAgentDef: (id: string) => (def.id === id ? def : null),
    resolveAgentLaunch: () =>
      ({
        selectedPath: '/fake/acp-bin',
        pathResolvedPath: '/fake/acp-bin',
        configuredOverridePath: null,
        launchPath: '/fake/acp-bin',
        launchKind: 'selected',
        childPathPrepend: [],
        diagnostic: null,
      }) as AgentLaunchResolution,
    applyAgentLaunchEnv: (env) => env,
    spawn: fakeSpawn,
    attachAcpSession: fakeAttachAcpSession,
    ...(options.acpPermissionHandler !== undefined ? { acpPermissionHandler: options.acpPermissionHandler as never } : {}),
    listProcessSnapshots: async () => {
      const pid = child.pid ?? 0;
      return [
        { pid, ppid: 1, command: 'fake-acp-bin' },
        { pid: pid + 1, ppid: pid, command: 'fake-acp-bin --mcp-helper' },
      ];
    },
    stopProcesses: async (pids) => {
      stopProcessesCalls.push(pids);
      const numericPids = pids.filter((pid): pid is number => typeof pid === 'number');
      return { alreadyStopped: false, forcedPids: [], matchedPids: numericPids, remainingPids: [], stoppedPids: numericPids };
    },
  });

  return { lifecycle, executor, child, attachCalls, abort, stopProcessesCalls };
}

describe('AgentExecutor — ACP dispatch (fake attachAcpSession)', () => {
  it('spawns, attaches an ACP session, forwards raw stdout/stderr, translates a text_delta agent event, and finishes succeeded', async () => {
    const { lifecycle, executor, child, attachCalls } = createAcpHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'do the thing', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(attachCalls).toHaveLength(1);
    expect(attachCalls[0]).toMatchObject({ prompt: 'do the thing', cwd: '/work', envFormat: undefined, onPermissionRequest: undefined });

    child.stdout.emit('data', 'raw acp stdout\n');
    child.stderr.emit('data', 'raw acp stderr\n');
    attachCalls[0]!.send('agent', { type: 'text_delta', delta: 'hello' });

    child.emit('close', 0, null);
    const finished = await lifecycle.waitForTerminal(run.id);
    expect(finished.state).toBe('succeeded');

    const events = await collectEvents(lifecycle, run.id);
    expect(agentPayloadTypes(events)).toEqual(['text_delta']);
    const stdoutEvent = events.find((e) => e.kind === 'stdout');
    expect((stdoutEvent?.payload as { chunk: string }).chunk).toBe('raw acp stdout\n');
    const stderrEvent = events.find((e) => e.kind === 'stderr');
    expect((stderrEvent?.payload as { chunk: string }).chunk).toBe('raw acp stderr\n');
  });

  it('finishes failed (not cancelled) when the child closes and completedSuccessfully() reports false', async () => {
    const { lifecycle, executor, child } = createAcpHarness({ completedSuccessfully: false });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    child.emit('close', 1, null);
    const finished = await lifecycle.waitForTerminal(run.id);
    expect(finished.state).toBe('failed');
  });

  it('aborts the ACP controller and escalates the process tree on cancellation, finishing cancelled', async () => {
    const { lifecycle, executor, child, abort, stopProcessesCalls } = createAcpHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    await lifecycle.cancel({ runId: run.id, reason: 'user requested' });
    await flushAsync();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(stopProcessesCalls).toHaveLength(1);

    child.emit('close', null, 'SIGTERM');
    const finished = await lifecycle.waitForTerminal(run.id);
    expect(finished.state).toBe('cancelled');
  });

  it('includes envFormat in the attachAcpSession call only when def.acpMcpEnvFormat is set', async () => {
    const { lifecycle, executor, child, attachCalls } = createAcpHarness({ def: { acpMcpEnvFormat: 'map' } });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(attachCalls[0]?.envFormat).toBe('map');

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });

  it('passes acpPermissionHandler through to attachAcpSession as onPermissionRequest when configured', async () => {
    const handler = vi.fn();
    const { lifecycle, executor, child, attachCalls } = createAcpHarness({ acpPermissionHandler: handler });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    expect(attachCalls[0]?.onPermissionRequest).toBe(handler);

    child.emit('close', 0, null);
    await lifecycle.waitForTerminal(run.id);
  });

  it('routes a send("agent", {type:"error"}) translated event to the run error channel, not agent', async () => {
    const { lifecycle, executor, child, attachCalls } = createAcpHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    attachCalls[0]!.send('agent', { type: 'error', message: 'agent-shaped failure' });
    child.emit('close', 1, null);
    await lifecycle.waitForTerminal(run.id);

    const events = await collectEvents(lifecycle, run.id);
    const errorEvent = events.find((e) => e.kind === 'error');
    expect(errorEvent?.payload).toEqual({ message: 'agent-shaped failure' });
    expect(events.some((e) => e.kind === 'agent')).toBe(false);
  });

  it('swallows an emit() race against an already-terminal run on the ACP path without an unhandled rejection', async () => {
    const { lifecycle, executor, child } = createAcpHarness();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await flushAsync();
    await runPromise;

    // Same race shape as "AgentExecutor — a single failed queued emit does
    // not block the run from reaching a terminal state" above, replayed
    // against wireAcpLifecycle's own enqueueEmit instead of
    // wireChildLifecycle's — the two closures are independent copies of the
    // same pattern (see agent-executor.ts module doc).
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    expect(() => child.stdout.emit('data', 'straggling output\n')).not.toThrow();
    await flushAsync();

    expect(() => child.emit('close', 0, null)).not.toThrow();
    await flushAsync();

    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('succeeded');
  });

  it('rejects AGENT_SPAWN_FAILED and terminates the child tree when attachAcpSession throws synchronously', async () => {
    const { lifecycle, executor, stopProcessesCalls } = createAcpHarness({ attachThrows: new Error('handshake rejected') });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const resultPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
    await expect(resultPromise).rejects.toMatchObject({
      code: 'AGENT_SPAWN_FAILED',
      message: expect.stringContaining('handshake rejected'),
    });

    await flushAsync();
    expect(stopProcessesCalls).toHaveLength(1);
    expect((await lifecycle.get(run.id))?.state).toBe('failed');
  });

  describe('translateAcpError (exercised via send("error", payload), since the function itself is not exported)', () => {
    it('a non-record, non-string payload falls back to a default message', async () => {
      const { lifecycle, executor, child, attachCalls } = createAcpHarness();
      const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
      const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
      await flushAsync();
      await runPromise;

      attachCalls[0]!.send('error', undefined);
      child.emit('close', 1, null);
      await lifecycle.waitForTerminal(run.id);

      const events = await collectEvents(lifecycle, run.id);
      const errorEvent = events.find((e) => e.kind === 'error');
      expect(errorEvent?.payload).toEqual({ message: 'ACP agent failed' });
    });

    it('a record payload with no error field omits the structured error member', async () => {
      const { lifecycle, executor, child, attachCalls } = createAcpHarness();
      const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
      const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
      await flushAsync();
      await runPromise;

      attachCalls[0]!.send('error', { message: 'plain failure, no structured error' });
      child.emit('close', 1, null);
      await lifecycle.waitForTerminal(run.id);

      const events = await collectEvents(lifecycle, run.id);
      const errorEvent = events.find((e) => e.kind === 'error');
      expect(errorEvent?.payload).toEqual({ message: 'plain failure, no structured error' });
    });

    it('a fully-populated error object (code, message, retryable) is carried through as the structured error', async () => {
      const { lifecycle, executor, child, attachCalls } = createAcpHarness();
      const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
      const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
      await flushAsync();
      await runPromise;

      attachCalls[0]!.send('error', {
        message: 'transport dropped',
        error: { code: 'ACP_TRANSPORT', message: 'socket closed', retryable: true },
      });
      child.emit('close', 1, null);
      await lifecycle.waitForTerminal(run.id);

      const events = await collectEvents(lifecycle, run.id);
      const errorEvent = events.find((e) => e.kind === 'error');
      expect(errorEvent?.payload).toEqual({
        message: 'transport dropped',
        error: { code: 'ACP_TRANSPORT', message: 'socket closed', retryable: true },
      });
    });

    it('an error object present without a retryable flag omits retryable from the structured error', async () => {
      const { lifecycle, executor, child, attachCalls } = createAcpHarness();
      const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
      const runPromise = executor.run({ runId: run.id, agentId: 'fake-agent', prompt: 'x', cwd: '/work' });
      await flushAsync();
      await runPromise;

      attachCalls[0]!.send('error', { message: 'auth required', error: { code: 'AUTH_REQUIRED' } });
      child.emit('close', 1, null);
      await lifecycle.waitForTerminal(run.id);

      const events = await collectEvents(lifecycle, run.id);
      const errorEvent = events.find((e) => e.kind === 'error');
      expect(errorEvent?.payload).toEqual({
        message: 'auth required',
        error: { code: 'AUTH_REQUIRED', message: 'auth required' },
      });
    });
  });
});
