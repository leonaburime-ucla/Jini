// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises). Catches an
// export silently dropped from the barrel without touching runtime behavior.
import { describe, expect, it } from 'vitest';
import * as AssetGridFeature from './index.js';

describe('asset-grid index barrel', () => {
  it('re-exports the rules, dependencies, hooks, and components it advertises', () => {
    const runtimeExports = [
      'ASSET_ID_ATTR',
      'ASSET_ID_SELECTOR',
      'DEFAULT_SEARCH_DEBOUNCE_MS',
      'DEFAULT_LIVE_UPDATE_COALESCE_MS',
      'ALL_FACET_VALUE',
      'localDayKey',
      'dayKeyFromTimestamp',
      'dayHeading',
      'dayHeadingResult',
      'groupByDay',
      'snapshotCardRects',
      'cardIdsInBand',
      'toggleSelection',
      'rangeSelection',
      'selectAllIds',
      'pruneMissingSelection',
      'mergeIngestedAssets',
      'parseLiveUpdateAssetId',
      'buildAssetGridQuery',
      'defaultMatchesKindFilter',
      'filterByKind',
      'resolvePreviewClickAction',
      'resolveCheckboxClickAction',
      'buildFacetLabelMap',
      'resolveFacetLabel',
      'isTypingTarget',
      'createFakeAssetGridDataPort',
      'createBrowserSseLiveUpdatesPort',
      'createFakeAssetGridDependencies',
      'useAssetGridData',
      'useWiredAssetGridData',
      'useAssetGridLiveUpdates',
      'useWiredAssetGridLiveUpdates',
      'useAssetGridSelection',
      'useRubberBandDrag',
      'useAssetGridKeyboardShortcuts',
      'AssetCard',
      'AssetGridToolbar',
      'AssetGridBody',
      'SelectionActionBar',
      'SelectionBand',
      'DeleteConfirmDialog',
      'AssetGrid',
    ] as const;

    for (const name of runtimeExports) {
      expect(AssetGridFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
