import { describe, expect, it, vi } from 'vitest';
import { createBrowserViewerClipboard, createDefaultViewerShellDependencies } from './dependencies.js';

describe('createBrowserViewerClipboard', () => {
  it('delegates to navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const clipboard = createBrowserViewerClipboard();
    const result = await clipboard.copyText('hello');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    vi.unstubAllGlobals();
  });
});

describe('createDefaultViewerShellDependencies', () => {
  it('wires a real browser clipboard by default', () => {
    const deps = createDefaultViewerShellDependencies();
    expect(typeof deps.clipboard.copyText).toBe('function');
  });
});
