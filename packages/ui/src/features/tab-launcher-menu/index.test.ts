// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as TabLauncherMenuFeature from './index.js';

describe('tab-launcher-menu index barrel', () => {
  it('re-exports the constants, rules, hook, and components it advertises', () => {
    const runtimeExports = [
      'MENU_WIDTH',
      'VIEWPORT_MARGIN',
      'ANCHOR_OFFSET',
      'MAX_TAB_RESULTS',
      'ALL_KIND_FILTER',
      'clampAnchoredPosition',
      'presentKinds',
      'filterFiles',
      'filterTabs',
      'clampSelection',
      'nextSelected',
      'resolveSelection',
      'useTabLauncherMenu',
      'TabLauncherResultRow',
      'TabLauncherActionRow',
      'TabLauncherMenu',
    ] as const;

    for (const name of runtimeExports) {
      expect(TabLauncherMenuFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
