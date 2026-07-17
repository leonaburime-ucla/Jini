import { describe, expect, it } from 'vitest';
import { createNodeSidecarLauncher } from './sidecar.js';

const node = process.execPath;

describe('createNodeSidecarLauncher', () => {
  it('waitUntilReady resolves once the probe reports ready', async () => {
    const launcher = createNodeSidecarLauncher();
    const handle = await launcher.launch({ command: node, args: ['-e', 'setInterval(() => {}, 1000)'] });
    try {
      let calls = 0;
      const status = await handle.waitUntilReady({
        probe: async () => ({ ready: ++calls >= 2 }),
        isReady: (s) => s.ready,
        pollIntervalMs: 10,
        timeoutMs: 2000,
      });
      expect(status.ready).toBe(true);
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      await handle.shutdown({ gracefulTimeoutMs: 200 });
    }
  });

  it('waitUntilReady rejects fast when the child exits before reporting ready (crash recovery signal)', async () => {
    const launcher = createNodeSidecarLauncher();
    const handle = await launcher.launch({ command: node, args: ['-e', 'process.exit(3)'] });
    await expect(
      handle.waitUntilReady({
        probe: async () => {
          throw new Error('not up yet');
        },
        isReady: () => false,
        pollIntervalMs: 10,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(/exited before reporting ready/);
  });

  it('waitUntilReady times out when the probe never reports ready', async () => {
    const launcher = createNodeSidecarLauncher();
    const handle = await launcher.launch({ command: node, args: ['-e', 'setInterval(() => {}, 1000)'] });
    try {
      await expect(
        handle.waitUntilReady({ probe: async () => ({ ready: false }), isReady: () => false, pollIntervalMs: 10, timeoutMs: 80 }),
      ).rejects.toThrow(/timed out waiting/);
    } finally {
      await handle.shutdown({ gracefulTimeoutMs: 200 });
    }
  });

  it('shutdown uses the caller-supplied graceful request before falling back to a signal kill', async () => {
    const launcher = createNodeSidecarLauncher();
    const handle = await launcher.launch({
      command: node,
      args: ['-e', "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000)"],
    });
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

  it('shutdown force-kills a child that never exits on its own', async () => {
    const launcher = createNodeSidecarLauncher();
    const handle = await launcher.launch({
      command: node,
      args: ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    });
    let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
    handle.process.onExit((code, signal) => {
      exitInfo = { code, signal };
    });
    await handle.shutdown({ gracefulTimeoutMs: 150 });
    expect(exitInfo).not.toBeNull();
    expect(exitInfo!.signal).toBe('SIGKILL');
  }, 10_000);
});
