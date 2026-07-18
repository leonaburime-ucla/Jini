import type { ShellPort } from '../shell.js';
import type { TauriShellApi } from './tauri-surfaces.js';

export function createTauriShellPort(tauriShell: TauriShellApi): ShellPort {
  return {
    openExternal: (url) => tauriShell.openUrl(url),
    openPath: (path) => tauriShell.openPath(path),
  };
}
