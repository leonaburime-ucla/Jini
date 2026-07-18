import { describe, expect, it } from 'vitest';
import * as renderersReact from './index.js';

/**
 * A barrel-only smoke test: every other test in this package imports from
 * the concrete module (`./sandboxed-document.js`, `./sandbox-bridge.js`,
 * etc.) rather than `./index.js`, so nothing else actually loads/exercises
 * this file's re-export statements. Importing the barrel here both closes
 * that coverage gap and catches a real class of bug — a typo'd or missing
 * re-export name that unit tests hitting the concrete modules directly
 * would never notice.
 */
describe('renderers-react barrel (index.ts)', () => {
  it('re-exports the sandboxed-document functions', () => {
    expect(typeof renderersReact.isFullHtmlDocument).toBe('function');
    expect(typeof renderersReact.wrapFragmentAsDocument).toBe('function');
    expect(typeof renderersReact.injectBaseHref).toBe('function');
    expect(typeof renderersReact.buildStorageShimScript).toBe('function');
    expect(typeof renderersReact.buildFocusGuardScript).toBe('function');
    expect(typeof renderersReact.buildSandboxedDocument).toBe('function');
  });

  it('re-exports the html-utils helpers', () => {
    expect(typeof renderersReact.escapeHtmlAttribute).toBe('function');
    expect(typeof renderersReact.injectAfterHeadOpen).toBe('function');
    expect(typeof renderersReact.injectBeforeHeadEnd).toBe('function');
    expect(typeof renderersReact.injectBeforeBodyEnd).toBe('function');
  });

  it('re-exports the sandbox bridge hook', () => {
    expect(typeof renderersReact.useSandboxBridge).toBe('function');
  });

  it('re-exports the new-tab preview functions', () => {
    expect(typeof renderersReact.buildSandboxedPreviewPage).toBe('function');
    expect(typeof renderersReact.openSandboxedPreviewInNewTab).toBe('function');
  });
});
