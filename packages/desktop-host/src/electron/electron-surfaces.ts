/**
 * Structural (duck-typed) surfaces for exactly the Electron APIs this
 * package's adapters use. Deliberately NOT importing the real `electron`
 * package — this package stays free of the Electron binary/native
 * dependency, matching the VALIDATION brief's expectation that adapters
 * are proven against "a fake/mock Electron webContents/BrowserWindow
 * surface", not a real Electron runtime. A consumer running inside a real
 * Electron main process passes the real `app`/`BrowserWindow`/`protocol`
 * modules, which structurally satisfy these interfaces (Electron's real
 * types are a superset of what's declared here).
 */

export interface ElectronAppLike {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: 'second-instance', listener: () => void): void;
}

export interface ElectronNavigationEvent {
  preventDefault(): void;
}

export interface ElectronBeforeRequestDetails {
  url: string;
}

export type ElectronBeforeRequestCallback = (response: { cancel: boolean }) => void;

export interface ElectronWebRequestLike {
  onBeforeRequest(listener: ((details: ElectronBeforeRequestDetails, callback: ElectronBeforeRequestCallback) => void) | null): void;
}

export interface ElectronSessionLike {
  webRequest: ElectronWebRequestLike;
}

export interface ElectronWebContentsLike {
  session: ElectronSessionLike;
  loadURL(url: string): Promise<void>;
  once(event: 'did-finish-load', listener: () => void): void;
  once(event: 'did-fail-load', listener: (event: unknown, errorCode: number, errorDescription: string) => void): void;
  on(event: 'will-navigate', listener: (event: ElectronNavigationEvent, url: string) => void): void;
  printToPDF(options: Record<string, unknown>): Promise<Buffer>;
  capturePage(rect?: { x: number; y: number; width: number; height: number }): Promise<{ toPNG(): Buffer }>;
}

export interface ElectronBrowserWindowLike {
  readonly webContents: ElectronWebContentsLike;
  loadURL(url: string): Promise<void>;
  show(): void;
  hide(): void;
  focus(): void;
  close(): void;
  destroy(): void;
  isDestroyed(): boolean;
  on(event: 'closed', listener: () => void): void;
}

export interface ElectronBrowserWindowOptions {
  show?: boolean;
  width?: number;
  height?: number;
  webPreferences?: { javascript?: boolean; offscreen?: boolean; [key: string]: unknown };
}

export type ElectronBrowserWindowFactory = (options: ElectronBrowserWindowOptions) => ElectronBrowserWindowLike;

export interface ElectronProtocolPrivileges {
  standard?: boolean;
  secure?: boolean;
  corsEnabled?: boolean;
  supportFetchAPI?: boolean;
  stream?: boolean;
}

export interface ElectronProtocolLike {
  registerSchemesAsPrivileged(schemes: Array<{ scheme: string; privileges: ElectronProtocolPrivileges }>): void;
  handle(scheme: string, handler: (request: Request) => Promise<Response>): void;
}
