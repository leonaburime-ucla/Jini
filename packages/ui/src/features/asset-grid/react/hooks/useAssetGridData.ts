import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAssetGridQuery, defaultMatchesKindFilter, filterByKind } from '../../rules.js';
import type { AssetGridDataPort } from '../../ports.js';
import type { AssetGridItem, AssetGridQuery } from '../../types.js';

export interface UseAssetGridDataParams<TAsset extends AssetGridItem> {
  active: boolean;
  data: AssetGridDataPort<TAsset>;
  kind: string;
  source: string;
  debouncedSearch: string;
  getKind: (asset: TAsset) => string;
  matchesKindFilter?: ((asset: TAsset, filterValue: string) => boolean) | undefined;
  mapKindToQuery?: ((kind: string) => string | undefined) | undefined;
}

export interface UseAssetGridDataResult<TAsset> {
  assets: TAsset[];
  setAssets: React.Dispatch<React.SetStateAction<TAsset[]>>;
  loading: boolean;
  query: AssetGridQuery;
  reload: () => Promise<void>;
}

/** Fetches assets when `active` or the derived query changes, applying an optional client-side kind narrowing pass after each fetch. */
export function useAssetGridData<TAsset extends AssetGridItem>(
  params: UseAssetGridDataParams<TAsset>,
): UseAssetGridDataResult<TAsset> {
  const { active, data, kind, source, debouncedSearch, getKind, matchesKindFilter, mapKindToQuery } = params;
  const [assets, setAssets] = useState<TAsset[]>([]);
  const [loading, setLoading] = useState(false);

  // Selector functions are host-supplied and not guaranteed to be
  // referentially stable across renders (e.g. an inline arrow in JSX). Ref
  // them so `reload`'s identity depends only on primitives — otherwise an
  // unstable selector would recreate `reload` every render, which would
  // retrigger the fetch effect below on every render in turn.
  const getKindRef = useRef(getKind);
  useEffect(() => {
    getKindRef.current = getKind;
  }, [getKind]);
  const matchesKindFilterRef = useRef(matchesKindFilter);
  useEffect(() => {
    matchesKindFilterRef.current = matchesKindFilter;
  }, [matchesKindFilter]);
  const mapKindToQueryRef = useRef(mapKindToQuery);
  useEffect(() => {
    mapKindToQueryRef.current = mapKindToQuery;
  }, [mapKindToQuery]);

  const query = useMemo(
    () => buildAssetGridQuery(kind, source, debouncedSearch, mapKindToQuery),
    [kind, source, debouncedSearch, mapKindToQuery],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const liveQuery = buildAssetGridQuery(kind, source, debouncedSearch, mapKindToQueryRef.current);
    const fetched = await data.fetchAssets(liveQuery);
    const matches =
      matchesKindFilterRef.current ??
      ((asset: TAsset, filterValue: string) => defaultMatchesKindFilter(asset, filterValue, getKindRef.current));
    setAssets(filterByKind(fetched, kind, matches));
    setLoading(false);
  }, [data, kind, source, debouncedSearch]);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  return { assets, setAssets, loading, query, reload };
}
