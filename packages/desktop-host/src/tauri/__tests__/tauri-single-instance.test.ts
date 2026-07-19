import { describe, expect, it, vi } from 'vitest';
import { createTauriSingleInstanceLockPort } from '../tauri-single-instance.js';
import { createFakeTauriSingleInstanceApi } from '../testing.js';

describe('createTauriSingleInstanceLockPort', () => {
  it('always returns true — the lock is already enforced Rust-side by the time claim() runs', () => {
    const api = createFakeTauriSingleInstanceApi();
    const port = createTauriSingleInstanceLockPort(api);
    expect(port.claim(vi.fn())).toBe(true);
  });

  it('forwards second-instance notifications from the plugin event', () => {
    const api = createFakeTauriSingleInstanceApi();
    const port = createTauriSingleInstanceLockPort(api);
    const onSecondInstance = vi.fn();
    port.claim(onSecondInstance);
    api.emitSecondInstance(['--foo'], '/cwd');
    expect(onSecondInstance).toHaveBeenCalledTimes(1);
  });
});
