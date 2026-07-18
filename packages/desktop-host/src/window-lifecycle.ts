/**
 * NOT a direct port. OD's real window-open/URL-load/reveal runtime lives in
 * `@open-design/desktop/main` (`createDesktopRuntime`/`runDesktopMain`), a
 * package this task's file list never named and did not read in full — that
 * package is out of scope here (it also owns update-flow/window-title/tray
 * concerns well beyond a shell primitive). `apps/packaged/src/
 * windows-lifecycle.ts` — despite its name — is Windows uninstall-registry
 * version sync (see `windows-registry.ts`), not window/BrowserWindow
 * lifecycle at all. This file is a from-scratch, minimal generic port
 * shaped for what C7's narrow slice actually needs: create a window, load a
 * URL into it, show/focus/close it, and know when it closes — enough for a
 * single main window plus the single-instance "re-show on second launch"
 * pattern `index.ts` (scope 1's composition) demonstrates.
 */

export interface WindowHandle {
  loadUrl(url: string): Promise<void>;
  show(): void;
  hide(): void;
  focus(): void;
  close(): void;
  isDestroyed(): boolean;
  onClosed(listener: () => void): void;
}

export interface WindowCreateOptions {
  url: string;
  width?: number;
  height?: number;
  show?: boolean;
}

export interface WindowLifecyclePort {
  createWindow(options: WindowCreateOptions): Promise<WindowHandle>;
  getMainWindow(): WindowHandle | null;
  showMainWindow(): void;
}

/**
 * Shared "track the main window, re-show it on second-instance focus"
 * bookkeeping — the part of the pattern that isn't backend-specific.
 * Electron/Tauri adapters supply `createWindow`; this wraps it with the
 * single-main-window tracking every packaged desktop app needs.
 */
export function withMainWindowTracking(
  createWindowImpl: (options: WindowCreateOptions) => Promise<WindowHandle>,
): WindowLifecyclePort {
  let mainWindow: WindowHandle | null = null;

  return {
    async createWindow(options) {
      const handle = await createWindowImpl(options);
      mainWindow = handle;
      handle.onClosed(() => {
        if (mainWindow === handle) mainWindow = null;
      });
      return handle;
    },
    getMainWindow() {
      return mainWindow;
    },
    showMainWindow() {
      if (mainWindow == null || mainWindow.isDestroyed()) return;
      mainWindow.show();
      mainWindow.focus();
    },
  };
}
