// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAssetGridData } from './useAssetGridData.js';
import { createFakeAssetGridDataPort } from '../../dependencies.js';

interface TestAsset {
  id: string;
  kind: string;
}

function port(assets: TestAsset[]) {
  return createFakeAssetGridDataPort<TestAsset>({
    assets,
    matchesQuery: (asset, query) =>
      (!query.kind || asset.kind === query.kind) && (!query.search || asset.id.includes(query.search)),
  });
}

describe('useAssetGridData', () => {
  it('fetches once active becomes true', async () => {
    const data = port([{ id: 'a', kind: 'image' }]);
    const { result, rerender } = renderHook(
      ({ active }) =>
        useAssetGridData({ active, data, kind: '', source: '', debouncedSearch: '', getKind: (a) => a.kind }),
      { initialProps: { active: false } },
    );
    expect(result.current.assets).toEqual([]);
    rerender({ active: true });
    await waitFor(() => expect(result.current.assets).toEqual([{ id: 'a', kind: 'image' }]));
  });

  it('refetches when the derived query changes', async () => {
    const data = port([
      { id: 'a', kind: 'image' },
      { id: 'b', kind: 'video' },
    ]);
    const { result, rerender } = renderHook(
      ({ kind }) =>
        useAssetGridData({ active: true, data, kind, source: '', debouncedSearch: '', getKind: (a) => a.kind }),
      { initialProps: { kind: '' } },
    );
    await waitFor(() => expect(result.current.assets).toHaveLength(2));
    rerender({ kind: 'video' });
    await waitFor(() => expect(result.current.assets).toEqual([{ id: 'b', kind: 'video' }]));
  });

  it('applies a client-side matchesKindFilter narrowing pass after fetch', async () => {
    // Server-side query only understands `image`; the client narrows `element` out of it.
    const data = createFakeAssetGridDataPort<{ id: string; kind: string; badge: string }>({
      assets: [
        { id: 'a', kind: 'image', badge: 'image' },
        { id: 'b', kind: 'image', badge: 'element' },
      ],
      matchesQuery: (asset, query) => !query.kind || asset.kind === query.kind,
    });
    const { result } = renderHook(() =>
      useAssetGridData({
        active: true,
        data,
        kind: 'element',
        source: '',
        debouncedSearch: '',
        getKind: (a) => a.badge,
        mapKindToQuery: (kind) => (kind === 'element' ? 'image' : kind),
      }),
    );
    await waitFor(() => expect(result.current.assets.map((a) => a.id)).toEqual(['b']));
  });

  it('reload() re-runs the fetch on demand', async () => {
    const data = port([{ id: 'a', kind: 'image' }]);
    const { result } = renderHook(() =>
      useAssetGridData({ active: false, data, kind: '', source: '', debouncedSearch: '', getKind: (a) => a.kind }),
    );
    expect(result.current.assets).toEqual([]);
    await result.current.reload();
    await waitFor(() => expect(result.current.assets).toEqual([{ id: 'a', kind: 'image' }]));
  });
});
