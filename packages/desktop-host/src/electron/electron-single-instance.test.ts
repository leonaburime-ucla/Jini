import { describe, expect, it, vi } from 'vitest';
import { createElectronSingleInstanceLockPort } from './electron-single-instance.js';
import { createFakeElectronApp } from './testing.js';

describe('createElectronSingleInstanceLockPort', () => {
  it('claims the lock and forwards second-instance notifications', () => {
    const app = createFakeElectronApp({ lockGranted: true });
    const port = createElectronSingleInstanceLockPort(app);
    const onSecondInstance = vi.fn();
    expect(port.claim(onSecondInstance)).toBe(true);
    app.emitSecondInstance();
    expect(onSecondInstance).toHaveBeenCalledTimes(1);
  });

  it('quits and returns false when another instance already holds the lock', () => {
    const app = createFakeElectronApp({ lockGranted: false });
    const port = createElectronSingleInstanceLockPort(app);
    expect(port.claim(vi.fn())).toBe(false);
    expect(app.quitCalled).toBe(true);
  });
});
