import { withMainWindowTracking, type WindowCreateOptions, type WindowHandle, type WindowLifecyclePort } from '../window-lifecycle.js';
import type { TauriWindowFactory, TauriWindowLike } from './tauri-surfaces.js';

let windowLabelCounter = 0;
function nextWindowLabel(): string {
  windowLabelCounter += 1;
  return `jini-desktop-host-${windowLabelCounter}`;
}

function toWindowHandle(win: TauriWindowLike): WindowHandle {
  return {
    async loadUrl(url) {
      await win.navigate(url);
    },
    show: () => void win.show(),
    hide: () => void win.hide(),
    focus: () => void win.setFocus(),
    close: () => void win.close(),
    isDestroyed: () => win.isClosed(),
    onClosed: (listener) => win.onCloseRequested(listener),
  };
}

export function createTauriWindowLifecyclePort(createTauriWindow: TauriWindowFactory): WindowLifecyclePort {
  return withMainWindowTracking(async (options: WindowCreateOptions) => {
    const win = await createTauriWindow({
      label: nextWindowLabel(),
      url: options.url,
      visible: options.show ?? true,
      ...(options.width == null ? {} : { width: options.width }),
      ...(options.height == null ? {} : { height: options.height }),
    });
    const handle = toWindowHandle(win);
    // Redundant with the `url` passed to createTauriWindow above (Tauri's
    // real WebviewWindow constructor loads it immediately) but explicit,
    // so WindowHandle.loadUrl is a real, exercised "URL load" capability
    // matching the Electron adapter's shape rather than a dead method.
    await handle.loadUrl(options.url);
    return handle;
  });
}
