// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as CommandPaletteFeature from './index.js';

describe('command-palette index barrel', () => {
  it('re-exports the constants, rules, dependency, hook, and components it advertises', () => {
    const runtimeExports = [
      'MAX_RESULTS',
      'DEFAULT_RECENTS_LIMIT',
      'DEFAULT_RECENTS_STORAGE_NAMESPACE',
      'DEFAULT_SCOPE_KEY',
      'scoreItemMatch',
      'rankItems',
      'nextCursor',
      'parseRecentIds',
      'pushRecentId',
      'createLocalStorageRecents',
      'useCommandPalette',
      'useWiredCommandPalette',
      'CommandPaletteRow',
      'CommandPalette',
    ] as const;

    for (const name of runtimeExports) {
      expect(CommandPaletteFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
