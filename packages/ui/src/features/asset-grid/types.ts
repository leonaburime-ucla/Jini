/**
 * Generic types for the asset-grid feature: a live-updating, filterable,
 * multi-selectable grid of items (comparable to a photo library/DAM).
 * `TAsset` is any host-owned asset shape with at least a stable `id`; every
 * other generic behavior reads the asset through the `AssetGridSelectors`
 * a host supplies rather than assuming a fixed field layout.
 */

export interface AssetGridItem {
  id: string;
}

export interface AssetGridFacetOption {
  value: string;
  label: string;
}

export interface AssetGridQuery {
  kind?: string;
  source?: string;
  search?: string;
}

export type AssetGridViewMode = 'grid' | 'timeline';

/** How the grid reads generic fields off a host's own asset shape. */
export interface AssetGridSelectors<TAsset> {
  getKind: (asset: TAsset) => string;
  getSource?: (asset: TAsset) => string | undefined;
  /** Capture/creation time in epoch ms — drives day-bucketed timeline grouping. */
  getTimestamp: (asset: TAsset) => number;
  /** Override the day-bucket key directly (e.g. a server-provided archive
   *  date) instead of deriving one from `getTimestamp`. */
  getDayKey?: (asset: TAsset) => string;
  getTitle: (asset: TAsset) => string;
  getSubtitle?: (asset: TAsset) => string | undefined;
  /**
   * Client-side kind-facet match, applied after a fetch. Defaults to
   * `getKind(asset) === filterValue`. Override this when a facet value is a
   * *badge* identity that doesn't equal the asset's raw storage kind (e.g.
   * OD's `element` facet narrows a subset of `image`-kind assets).
   */
  matchesKindFilter?: (asset: TAsset, filterValue: string) => boolean;
  /**
   * Maps a kind-facet value to the value actually sent to `fetchAssets`'s
   * query, when the two diverge (e.g. `element` queries the server as
   * `image`, then `matchesKindFilter` narrows client-side). Defaults to the
   * identity mapping.
   */
  mapKindToQuery?: (filterValue: string) => string | undefined;
}

/** A card's viewport-space box, snapshotted for hit-testing during a rubber-band drag. */
export interface CardRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Band {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AssetGridDayGroup<TAsset> {
  key: string;
  items: Array<{ asset: TAsset; index: number }>;
}
