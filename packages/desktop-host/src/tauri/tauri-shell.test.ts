import { describe, expect, it } from 'vitest';
import { createTauriShellPort } from './tauri-shell.js';
import { createFakeTauriShellApi } from './testing.js';

describe('createTauriShellPort', () => {
  it('delegates openExternal/openPath to the Tauri shell plugin', async () => {
    const api = createFakeTauriShellApi();
    const port = createTauriShellPort(api);
    await port.openExternal('https://example.test');
    await port.openPath('/tmp/x');
    expect(api.openedUrls).toEqual(['https://example.test']);
    expect(api.openedPaths).toEqual(['/tmp/x']);
  });
});
