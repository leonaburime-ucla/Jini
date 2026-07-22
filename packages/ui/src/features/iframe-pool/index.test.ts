// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as IframePoolFeature from './index.js';

describe('iframe-pool index barrel', () => {
  it('re-exports the constants, rules, context, hook, and components it advertises', () => {
    const runtimeExports = [
      'DEFAULT_MAX_MOUNTED_IFRAMES',
      'selectLruEvictions',
      'selectMatchingEvictions',
      'IframeKeepAliveContext',
      'useIframeKeepAlivePool',
      'IframeKeepAliveProvider',
      'PooledIframe',
    ] as const;

    for (const name of runtimeExports) {
      expect(IframePoolFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
