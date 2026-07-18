export type {
  AssetGridItem,
  AssetGridFacetOption,
  AssetGridQuery,
  AssetGridViewMode,
  AssetGridSelectors,
  CardRect,
  Band,
  AssetGridDayGroup,
} from './types.js';

export {
  ASSET_ID_ATTR,
  ASSET_ID_SELECTOR,
  DEFAULT_SEARCH_DEBOUNCE_MS,
  DEFAULT_LIVE_UPDATE_COALESCE_MS,
  ALL_FACET_VALUE,
} from './constants.js';

export {
  localDayKey,
  dayKeyFromTimestamp,
  dayHeading,
  dayHeadingResult,
  groupByDay,
  snapshotCardRects,
  cardIdsInBand,
  toggleSelection,
  rangeSelection,
  selectAllIds,
  pruneMissingSelection,
  mergeIngestedAssets,
  parseLiveUpdateAssetId,
  buildAssetGridQuery,
  defaultMatchesKindFilter,
  filterByKind,
  resolvePreviewClickAction,
  resolveCheckboxClickAction,
  buildFacetLabelMap,
  resolveFacetLabel,
  isTypingTarget,
} from './rules.js';
export type { DayHeading, PreviewClickAction, CheckboxClickAction } from './rules.js';

export type {
  AssetGridDataPort,
  AssetGridLiveUpdateHandlers,
  AssetGridLiveUpdatesPort,
  AssetGridDependencies,
} from './ports.js';

export {
  createFakeAssetGridDataPort,
  createBrowserSseLiveUpdatesPort,
  createFakeAssetGridDependencies,
} from './dependencies.js';
export type { FakeAssetGridDataPortOptions, BrowserSseLiveUpdatesOptions } from './dependencies.js';

export { useAssetGridData, useWiredAssetGridData } from './react/hooks/useAssetGridData.js';
export type {
  UseAssetGridDataParams,
  UseAssetGridDataResult,
  UseWiredAssetGridDataParams,
} from './react/hooks/useAssetGridData.js';
export { useAssetGridLiveUpdates, useWiredAssetGridLiveUpdates } from './react/hooks/useAssetGridLiveUpdates.js';
export type {
  UseAssetGridLiveUpdatesParams,
  UseWiredAssetGridLiveUpdatesParams,
} from './react/hooks/useAssetGridLiveUpdates.js';
export { useAssetGridSelection } from './react/hooks/useAssetGridSelection.js';
export type { UseAssetGridSelectionResult } from './react/hooks/useAssetGridSelection.js';
export { useRubberBandDrag } from './react/hooks/useRubberBandDrag.js';
export type { UseRubberBandDragParams, UseRubberBandDragResult } from './react/hooks/useRubberBandDrag.js';
export { useAssetGridKeyboardShortcuts } from './react/hooks/useAssetGridKeyboardShortcuts.js';
export type { UseAssetGridKeyboardShortcutsParams } from './react/hooks/useAssetGridKeyboardShortcuts.js';

export { AssetCard } from './react/components/AssetCard.js';
export type { AssetCardProps } from './react/components/AssetCard.js';
export { AssetGridToolbar } from './react/components/AssetGridToolbar.js';
export type { AssetGridToolbarProps } from './react/components/AssetGridToolbar.js';
export { AssetGridBody } from './react/components/AssetGridBody.js';
export type { AssetGridBodyProps } from './react/components/AssetGridBody.js';
export { SelectionActionBar } from './react/components/SelectionActionBar.js';
export type { SelectionActionBarProps } from './react/components/SelectionActionBar.js';
export { SelectionBand } from './react/components/SelectionBand.js';
export type { SelectionBandProps } from './react/components/SelectionBand.js';
export { DeleteConfirmDialog } from './react/components/DeleteConfirmDialog.js';
export type { DeleteConfirmDialogProps } from './react/components/DeleteConfirmDialog.js';
export { AssetGrid } from './react/components/AssetGrid.js';
export type { AssetGridProps } from './react/components/AssetGrid.js';
