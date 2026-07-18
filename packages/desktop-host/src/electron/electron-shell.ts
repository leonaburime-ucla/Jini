import { ShellError, type ShellPort } from '../shell.js';
import type { ElectronShellLike } from './electron-surfaces.js';

export function createElectronShellPort(electronShell: ElectronShellLike): ShellPort {
  return {
    async openExternal(url: string): Promise<void> {
      await electronShell.openExternal(url);
    },
    async openPath(path: string): Promise<void> {
      const errorMessage = await electronShell.openPath(path);
      if (errorMessage.length > 0) throw new ShellError(errorMessage);
    },
  };
}
