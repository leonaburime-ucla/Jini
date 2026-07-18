/**
 * Backs the bridge's `shell.openExternal`/`shell.openPath` (`bridge.ts`)
 * from the host side — this was missing from scope 1's file list even
 * though C7's narrow slice explicitly names "open-path/open-external" as
 * something both the Electron and Tauri adapters must provide. Filed here
 * rather than retroactively editing scope 1, since it only became
 * apparent as a gap while wiring the Tauri adapter (scope 4) against the
 * same `DesktopHostPorts` shape scope 3 established.
 */

export class ShellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShellError';
  }
}

export interface ShellPort {
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<void>;
}
