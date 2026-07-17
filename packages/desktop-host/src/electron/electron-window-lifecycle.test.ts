import { describe, expect, it } from 'vitest';
import { createElectronWindowLifecyclePort } from './electron-window-lifecycle.js';
import { createFakeBrowserWindowFactory } from './testing.js';

describe('createElectronWindowLifecyclePort', () => {
  it('creates a window, loads the url, and tracks it as the main window', async () => {
    const { factory } = createFakeBrowserWindowFactory();
    const port = createElectronWindowLifecyclePort(factory);
    const handle = await port.createWindow({ url: 'jini://app/' });
    expect(port.getMainWindow()).toBe(handle);
  });

  it('clears the main window and showMainWindow no-ops after close', async () => {
    const { factory } = createFakeBrowserWindowFactory();
    const port = createElectronWindowLifecyclePort(factory);
    const handle = await port.createWindow({ url: 'jini://app/' });
    handle.close();
    expect(port.getMainWindow()).toBeNull();
    expect(() => port.showMainWindow()).not.toThrow();
  });
});
