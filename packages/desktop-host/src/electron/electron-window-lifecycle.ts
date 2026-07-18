import { withMainWindowTracking, type WindowCreateOptions, type WindowHandle, type WindowLifecyclePort } from '../window-lifecycle.js';
import type { ElectronBrowserWindowFactory } from './electron-surfaces.js';

function toWindowHandle(win: ReturnType<ElectronBrowserWindowFactory>): WindowHandle {
  return {
    async loadUrl(url) {
      await win.loadURL(url);
    },
    show: () => win.show(),
    hide: () => win.hide(),
    focus: () => win.focus(),
    close: () => win.close(),
    isDestroyed: () => win.isDestroyed(),
    onClosed: (listener) => win.on('closed', listener),
  };
}

export function createElectronWindowLifecyclePort(createBrowserWindow: ElectronBrowserWindowFactory): WindowLifecyclePort {
  return withMainWindowTracking(async (options: WindowCreateOptions) => {
    const win = createBrowserWindow({
      show: options.show ?? false,
      ...(options.width == null ? {} : { width: options.width }),
      ...(options.height == null ? {} : { height: options.height }),
    });
    const handle = toWindowHandle(win);
    await handle.loadUrl(options.url);
    if (options.show ?? true) handle.show();
    return handle;
  });
}
