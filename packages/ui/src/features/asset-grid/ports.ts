/**
 * The DI seam. Everything in this feature reaches transport/DOM only through
 * these interfaces — `dependencies.ts` is the one file allowed to bind a
 * real implementation.
 *
 * Deleting an asset (single or bulk) is deliberately NOT a port method here:
 * the destructive API call is host-specific, so it's exposed as a plain
 * callback prop on the `AssetGrid` component (`onDeleteAsset`/
 * `onDeleteSelected`) instead — this feature only owns the confirm-UI and
 * the keyboard-shortcut wiring around it, never the delete call itself.
 */
import type { AssetGridQuery } from './types.js';

/** The asset-catalog read transport. */
export interface AssetGridDataPort<TAsset> {
  fetchAssets(query: AssetGridQuery): Promise<TAsset[]>;
  /**
   * Fetch a single asset by id, used to resolve a live-update "ingest"
   * event into a targeted merge instead of a full reload. Omit if the host
   * has no cheap per-id fetch — every ingest event then falls back to a
   * full `fetchAssets` reload.
   */
  fetchAssetById?(id: string): Promise<TAsset | null>;
}

export interface AssetGridLiveUpdateHandlers {
  /** A single asset was created or changed; resolve it via `fetchAssetById` (or reload if absent). */
  onIngest(id: string): void;
  /** A single asset was removed; drop it locally, no fetch needed. */
  onDelete(id: string): void;
  /** The event carried no resolvable id, or update membership can't be predicted client-side — reload everything. */
  onFullReload(): void;
}

/** A live-update transport (e.g. Server-Sent Events) delivering incremental catalog changes. */
export interface AssetGridLiveUpdatesPort {
  /** Start listening; returns an unsubscribe function. */
  subscribe(handlers: AssetGridLiveUpdateHandlers): () => void;
}

export interface AssetGridDependencies<TAsset> {
  data: AssetGridDataPort<TAsset>;
  /** Optional: omit to disable live-merge reconciliation entirely (a host without a push transport can rely on the manual Refresh action alone). */
  liveUpdates?: AssetGridLiveUpdatesPort;
}
