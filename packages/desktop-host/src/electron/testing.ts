/** Fake Electron surfaces for tests — never a real `electron` import (see `electron-surfaces.ts`). */
import type {
  ElectronAppLike,
  ElectronBrowserWindowFactory,
  ElectronBrowserWindowLike,
  ElectronBrowserWindowOptions,
  ElectronProtocolLike,
  ElectronShellLike,
  ElectronWebContentsLike,
} from './electron-surfaces.js';

export function createFakeElectronApp(options: { lockGranted?: boolean } = {}): ElectronAppLike & {
  quitCalled: boolean;
  emitSecondInstance(): void;
} {
  let secondInstanceListener: (() => void) | null = null;
  const app = {
    quitCalled: false,
    requestSingleInstanceLock: () => options.lockGranted ?? true,
    quit() {
      app.quitCalled = true;
    },
    on(_event: 'second-instance', listener: () => void) {
      secondInstanceListener = listener;
    },
    emitSecondInstance() {
      secondInstanceListener?.();
    },
  };
  return app;
}

export interface FakeWindowScript {
  failLoad?: { errorCode: number; errorDescription: string };
  hang?: boolean;
  pdfResult?: Buffer;
  pngResult?: Buffer;
}

export function createFakeBrowserWindowFactory(script: FakeWindowScript = {}): {
  factory: ElectronBrowserWindowFactory;
  windows: ElectronBrowserWindowLike[];
} {
  const windows: ElectronBrowserWindowLike[] = [];

  const factory = (_options: ElectronBrowserWindowOptions): ElectronBrowserWindowLike => {
    let destroyed = false;
    let didFinishLoad: (() => void) | null = null;
    let didFailLoad: ((event: unknown, errorCode: number, errorDescription: string) => void) | null = null;
    let willNavigate: ((event: { preventDefault(): void }, url: string) => void) | null = null;
    let beforeRequest: ((details: { url: string }, callback: (response: { cancel: boolean }) => void) => void) | null = null;
    const closedListeners: Array<() => void> = [];

    const webContents: ElectronWebContentsLike = {
      session: {
        webRequest: {
          onBeforeRequest(listener) {
            beforeRequest = listener;
          },
        },
      },
      async loadURL() {},
      once(event, listener) {
        if (event === 'did-finish-load') didFinishLoad = listener as () => void;
        if (event === 'did-fail-load') didFailLoad = listener as (event: unknown, errorCode: number, errorDescription: string) => void;
      },
      on(event, listener) {
        if (event === 'will-navigate') willNavigate = listener as (event: { preventDefault(): void }, url: string) => void;
      },
      async printToPDF() {
        return script.pdfResult ?? Buffer.from('pdf-bytes');
      },
      async capturePage() {
        const png = script.pngResult ?? Buffer.from('png-bytes');
        return { toPNG: () => png };
      },
    };

    const win: ElectronBrowserWindowLike & { triggerBeforeRequest(url: string): { cancel: boolean }; triggerWillNavigate(url: string): boolean } = {
      webContents,
      async loadURL(_url: string) {
        if (script.hang === true) return;
        queueMicrotask(() => {
          if (script.failLoad != null) didFailLoad?.(null, script.failLoad.errorCode, script.failLoad.errorDescription);
          else didFinishLoad?.();
        });
      },
      show() {},
      hide() {},
      focus() {},
      close() {
        win.destroy();
      },
      destroy() {
        destroyed = true;
        for (const listener of closedListeners) listener();
      },
      isDestroyed() {
        return destroyed;
      },
      on(event, listener) {
        if (event === 'closed') closedListeners.push(listener);
      },
      triggerBeforeRequest(url: string) {
        let result: { cancel: boolean } = { cancel: false };
        beforeRequest?.({ url }, (response) => {
          result = response;
        });
        return result;
      },
      triggerWillNavigate(url: string) {
        let prevented = false;
        willNavigate?.({ preventDefault: () => (prevented = true) }, url);
        return prevented;
      },
    };
    windows.push(win);
    return win;
  };

  return { factory, windows };
}

export function createFakeElectronProtocol(): ElectronProtocolLike & { handlers: Map<string, (request: Request) => Promise<Response>> } {
  const handlers = new Map<string, (request: Request) => Promise<Response>>();
  return {
    handlers,
    registerSchemesAsPrivileged() {},
    handle(scheme, handler) {
      handlers.set(scheme, handler);
    },
  };
}

export function createFakeElectronShell(options: { openPathError?: string } = {}): ElectronShellLike & {
  openedExternalUrls: string[];
  openedPaths: string[];
} {
  const openedExternalUrls: string[] = [];
  const openedPaths: string[] = [];
  return {
    openedExternalUrls,
    openedPaths,
    async openExternal(url: string) {
      openedExternalUrls.push(url);
    },
    async openPath(path: string) {
      openedPaths.push(path);
      return options.openPathError ?? '';
    },
  };
}
