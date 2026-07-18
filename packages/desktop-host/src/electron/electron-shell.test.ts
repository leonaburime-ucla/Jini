import { describe, expect, it } from 'vitest';
import { ShellError } from '../shell.js';
import { createElectronShellPort } from './electron-shell.js';
import { createFakeElectronShell } from './testing.js';

describe('createElectronShellPort', () => {
  it('opens external urls and paths through the underlying Electron shell', async () => {
    const electronShell = createFakeElectronShell();
    const port = createElectronShellPort(electronShell);
    await port.openExternal('https://example.test');
    await port.openPath('/tmp/x');
    expect(electronShell.openedExternalUrls).toEqual(['https://example.test']);
    expect(electronShell.openedPaths).toEqual(['/tmp/x']);
  });

  it('throws a ShellError when Electron reports a non-empty openPath error string', async () => {
    const electronShell = createFakeElectronShell({ openPathError: 'no such file' });
    const port = createElectronShellPort(electronShell);
    await expect(port.openPath('/missing')).rejects.toThrow(ShellError);
  });
});
