import { describe, expect, it } from 'vitest';
import { createTauriWindowLifecyclePort } from './tauri-window-lifecycle.js';
import { createFakeTauriWindowFactory } from './testing.js';

describe('createTauriWindowLifecyclePort', () => {
  it('creates a window, loads the url via navigate, and tracks it as the main window', async () => {
    const { factory, windows } = createFakeTauriWindowFactory();
    const port = createTauriWindowLifecyclePort(factory);
    const handle = await port.createWindow({ url: 'https://example.test/' });
    expect(port.getMainWindow()).toBe(handle);
    const win = windows[0] as unknown as { navigatedTo: string[] };
    expect(win.navigatedTo).toEqual(['https://example.test/']);
  });

  it('clears the main window after close', async () => {
    const { factory } = createFakeTauriWindowFactory();
    const port = createTauriWindowLifecyclePort(factory);
    const handle = await port.createWindow({ url: 'https://example.test/' });
    handle.close();
    await Promise.resolve();
    expect(port.getMainWindow()).toBeNull();
  });
});
