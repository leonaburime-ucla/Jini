import { describe, expect, it } from 'vitest';
import { createElectronWindowLifecyclePort } from '../electron-window-lifecycle.js';
import { createFakeBrowserWindowFactory } from '../testing.js';

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

  it('passes explicit width/height through to the BrowserWindow factory', async () => {
    const { factory, windows } = createFakeBrowserWindowFactory();
    let capturedOptions: Parameters<typeof factory>[0] | undefined;
    const spyFactory: typeof factory = (options) => {
      capturedOptions = options;
      return factory(options);
    };
    const port = createElectronWindowLifecyclePort(spyFactory);
    await port.createWindow({ url: 'jini://app/', width: 800, height: 600 });
    expect(capturedOptions?.width).toBe(800);
    expect(capturedOptions?.height).toBe(600);
    expect(windows).toHaveLength(1);
  });

  it('omits width/height from the factory options when not given', async () => {
    const { factory } = createFakeBrowserWindowFactory();
    let capturedOptions: Parameters<typeof factory>[0] | undefined;
    const spyFactory: typeof factory = (options) => {
      capturedOptions = options;
      return factory(options);
    };
    const port = createElectronWindowLifecyclePort(spyFactory);
    await port.createWindow({ url: 'jini://app/' });
    expect(capturedOptions).not.toHaveProperty('width');
    expect(capturedOptions).not.toHaveProperty('height');
  });

  it('exposes hide/focus/isDestroyed delegating to the underlying BrowserWindow', async () => {
    const { factory, windows } = createFakeBrowserWindowFactory();
    const port = createElectronWindowLifecyclePort(factory);
    const handle = await port.createWindow({ url: 'jini://app/', show: false });
    expect(handle.isDestroyed()).toBe(false);
    handle.hide();
    handle.focus();
    expect(windows[0]?.isDestroyed()).toBe(false);
  });

  it('does not auto-show the window when options.show is false', async () => {
    const { factory } = createFakeBrowserWindowFactory();
    const shownCalls: boolean[] = [];
    const spyFactory: typeof factory = (options) => {
      const win = factory(options);
      const originalShow = win.show.bind(win);
      win.show = () => {
        shownCalls.push(true);
        originalShow();
      };
      return win;
    };
    const port = createElectronWindowLifecyclePort(spyFactory);
    await port.createWindow({ url: 'jini://app/', show: false });
    expect(shownCalls).toHaveLength(0);
  });
});
