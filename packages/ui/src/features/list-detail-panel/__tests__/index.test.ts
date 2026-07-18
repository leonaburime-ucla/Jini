// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js`, not just through each source file
// directly.
import { describe, expect, it } from 'vitest';
import * as ListDetailPanelFeature from '../index.js';

describe('list-detail-panel index barrel', () => {
  it('re-exports the rules, hook, and component it advertises', () => {
    const runtimeExports = [
      'resolveListDetailSelection',
      'findSelectedItem',
      'useListDetailSelection',
      'ListDetailPanel',
    ] as const;

    for (const name of runtimeExports) {
      expect(ListDetailPanelFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
