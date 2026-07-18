/** Fake Tauri surfaces for tests — never a real `@tauri-apps/*` import (see `tauri-surfaces.ts`). */
import type {
  TauriChildProcessLike,
  TauriShellApi,
  TauriSidecarCommandApi,
  TauriSingleInstanceApi,
  TauriWindowCreateOptions,
  TauriWindowFactory,
  TauriWindowLike,
} from './tauri-surfaces.js';

export function createFakeTauriSingleInstanceApi(): TauriSingleInstanceApi & { emitSecondInstance(args: string[], cwd: string): void } {
  const listeners: Array<(args: string[], cwd: string) => void> = [];
  return {
    onSecondInstance(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    emitSecondInstance(args, cwd) {
      for (const listener of listeners) listener(args, cwd);
    },
  };
}

export function createFakeTauriWindowFactory(): { factory: TauriWindowFactory; windows: TauriWindowLike[] } {
  const windows: TauriWindowLike[] = [];
  const factory = async (_options: TauriWindowCreateOptions): Promise<TauriWindowLike> => {
    let closed = false;
    const closeListeners: Array<() => void> = [];
    const win: TauriWindowLike & { navigatedTo: string[] } = {
      navigatedTo: [],
      async show() {},
      async hide() {},
      async setFocus() {},
      async close() {
        closed = true;
        for (const listener of closeListeners) listener();
      },
      async navigate(url: string) {
        win.navigatedTo.push(url);
      },
      isClosed() {
        return closed;
      },
      onCloseRequested(listener) {
        closeListeners.push(listener);
        return () => {
          const index = closeListeners.indexOf(listener);
          if (index >= 0) closeListeners.splice(index, 1);
        };
      },
    };
    windows.push(win);
    return win;
  };
  return { factory, windows };
}

export function createFakeTauriShellApi(): TauriShellApi & { openedUrls: string[]; openedPaths: string[] } {
  const openedUrls: string[] = [];
  const openedPaths: string[] = [];
  return {
    openedUrls,
    openedPaths,
    async openUrl(url: string) {
      openedUrls.push(url);
    },
    async openPath(path: string) {
      openedPaths.push(path);
    },
  };
}

export interface FakeTauriSidecarScript {
  exitImmediatelyWithCode?: number;
  readyAfterProbes?: number;
  ignoresGracefulShutdown?: boolean;
}

export function createFakeTauriSidecarCommandApi(script: FakeTauriSidecarScript = {}): TauriSidecarCommandApi & {
  spawned: Array<{ binaryName: string; args: string[] }>;
} {
  const spawned: Array<{ binaryName: string; args: string[] }> = [];
  return {
    spawned,
    async spawnSidecar(binaryName, args) {
      spawned.push({ binaryName, args });
      const exitListeners: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];
      let killed = false;
      const child: TauriChildProcessLike = {
        pid: 4242,
        onExit(listener) {
          exitListeners.push(listener);
        },
        kill(signal) {
          if (script.ignoresGracefulShutdown === true && signal !== 'SIGKILL') return true;
          killed = true;
          // A macrotask, not queueMicrotask: real process exit delivery
          // happens after the event loop's current microtask work drains
          // (the caller's own await chains included). queueMicrotask here
          // would race ahead of a listener a caller registers after one
          // more `await`, silently dropping the event — exactly the kind
          // of flake this fake exists to not have.
          setTimeout(() => {
            for (const listener of exitListeners) listener(null, signal ?? 'SIGTERM');
          }, 0);
          return true;
        },
      };
      const exitImmediatelyWithCode = script.exitImmediatelyWithCode;
      if (exitImmediatelyWithCode != null) {
        // `exitImmediatelyWithCode` (a local, narrowed here) rather than
        // `script.exitImmediatelyWithCode` again inside the closure: TS
        // narrowing doesn't persist across a property access re-read in a
        // later closure, but re-reading the property here is genuinely
        // always defined given the guard above — a local avoids needing an
        // otherwise-dead `?? 0` fallback to satisfy the type checker.
        setTimeout(() => {
          for (const listener of exitListeners) listener(exitImmediatelyWithCode, null);
        }, 0);
      }
      void killed;
      return child;
    },
  };
}
