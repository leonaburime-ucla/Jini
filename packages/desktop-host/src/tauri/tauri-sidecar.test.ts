import { describe, expect, it } from 'vitest';
import { createTauriSidecarLauncher } from './tauri-sidecar.js';
import { createFakeTauriSidecarCommandApi } from './testing.js';

describe('createTauriSidecarLauncher', () => {
  it('waitUntilReady resolves once the probe reports ready', async () => {
    const api = createFakeTauriSidecarCommandApi();
    const launcher = createTauriSidecarLauncher(api);
    const handle = await launcher.launch({ command: 'my-sidecar', args: ['--port', '0'] });
    expect(api.spawned).toEqual([{ binaryName: 'my-sidecar', args: ['--port', '0'] }]);
    let calls = 0;
    const status = await handle.waitUntilReady({
      probe: async () => ({ ready: ++calls >= 2 }),
      isReady: (s) => s.ready,
      pollIntervalMs: 5,
      timeoutMs: 2000,
    });
    expect(status.ready).toBe(true);
  });

  it('waitUntilReady rejects fast on crash before ready (crash recovery signal)', async () => {
    const api = createFakeTauriSidecarCommandApi({ exitImmediatelyWithCode: 7 });
    const launcher = createTauriSidecarLauncher(api);
    const handle = await launcher.launch({ command: 'my-sidecar' });
    await expect(
      handle.waitUntilReady({
        probe: async () => {
          throw new Error('not up');
        },
        isReady: () => false,
        pollIntervalMs: 5,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(/exited before reporting ready/);
  });

  it('shutdown uses the graceful request before falling back to a signal kill', async () => {
    const api = createFakeTauriSidecarCommandApi();
    const launcher = createTauriSidecarLauncher(api);
    const handle = await launcher.launch({ command: 'my-sidecar' });
    let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
    handle.process.onExit((code, signal) => {
      exitInfo = { code, signal };
    });
    await handle.shutdown({
      requestShutdown: async () => {
        handle.process.kill('SIGTERM');
      },
      gracefulTimeoutMs: 2000,
    });
    expect(exitInfo).not.toBeNull();
    expect(exitInfo!.signal).not.toBe('SIGKILL');
  });

  it('shutdown force-kills a sidecar that ignores graceful shutdown', async () => {
    const api = createFakeTauriSidecarCommandApi({ ignoresGracefulShutdown: true });
    const launcher = createTauriSidecarLauncher(api);
    const handle = await launcher.launch({ command: 'my-sidecar' });
    let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
    handle.process.onExit((code, signal) => {
      exitInfo = { code, signal };
    });
    await handle.shutdown({
      requestShutdown: async () => {
        handle.process.kill('SIGTERM');
      },
      gracefulTimeoutMs: 100,
    });
    expect(exitInfo).not.toBeNull();
    expect(exitInfo!.signal).toBe('SIGKILL');
  });
});
