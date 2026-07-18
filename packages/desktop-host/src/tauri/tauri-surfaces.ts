/**
 * Structural (duck-typed) surfaces for exactly the `@tauri-apps/api`/
 * `@tauri-apps/plugin-*` shapes this package's Tauri adapter uses. Like
 * `../electron/electron-surfaces.ts`, no real `@tauri-apps/*` package is a
 * dependency here — a consumer running inside a real Tauri webview passes
 * the real plugin functions, which structurally satisfy these interfaces.
 *
 * Tauri's single-instance model is fundamentally different from
 * Electron's: the `tauri-plugin-single-instance` Rust plugin enforces the
 * lock BEFORE the JS runtime even starts, and notifies the *already
 * running* instance's JS side of a second launch attempt via an emitted
 * event — there is no JS-callable "try to acquire the lock" call the way
 * Electron's `app.requestSingleInstanceLock()` works. `TauriSingleInstanceApi`
 * reflects that: it only exposes a listener registration, because by the
 * time JS code in this instance runs, the lock question is already
 * settled.
 */

export interface TauriSingleInstanceApi {
  onSecondInstance(listener: (args: string[], cwd: string) => void): () => void;
}

export interface TauriWindowLike {
  show(): Promise<void>;
  hide(): Promise<void>;
  setFocus(): Promise<void>;
  close(): Promise<void>;
  navigate(url: string): Promise<void>;
  isClosed(): boolean;
  onCloseRequested(listener: () => void): () => void;
}

export interface TauriWindowCreateOptions {
  label: string;
  url: string;
  width?: number;
  height?: number;
  visible?: boolean;
}

export type TauriWindowFactory = (options: TauriWindowCreateOptions) => Promise<TauriWindowLike>;

export interface TauriShellApi {
  openUrl(url: string): Promise<void>;
  openPath(path: string): Promise<void>;
}

export interface TauriChildProcessLike {
  pid: number | undefined;
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  kill(signal?: NodeJS.Signals): boolean;
  write?(data: string): Promise<void>;
}

export interface TauriSidecarCommandApi {
  spawnSidecar(binaryName: string, args: string[], env?: Record<string, string>): Promise<TauriChildProcessLike>;
}
