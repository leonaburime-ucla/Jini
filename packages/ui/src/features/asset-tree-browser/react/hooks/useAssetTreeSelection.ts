import { useCallback, useEffect, useState } from 'react';
import { pruneMissingPaths, toggleInSet } from '../../rules.js';
import type { AssetTreeFileItem } from '../../types.js';

export interface UseAssetTreeSelectionResult {
  selected: Set<string>;
  toggleSelect: (path: string) => void;
  clearSelection: () => void;
  /** Carries a selected path over to its new path after a successful rename, instead of silently dropping the selection. */
  renamePath: (oldPath: string, newPath: string) => void;
}

/**
 * Row selection: a `Set` of selected paths, reset whenever the viewed
 * directory changes, and pruned whenever a previously-selected path
 * disappears from the current listing (a delete or a refresh) — mirrors
 * `features/asset-grid`'s `useAssetGridSelection`, scoped to `path` instead
 * of `id`.
 */
export function useAssetTreeSelection<TFile extends AssetTreeFileItem>(
  filesAtCurrentDir: readonly TFile[],
  currentDir: string,
): UseAssetTreeSelectionResult {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [currentDir]);

  useEffect(() => {
    setSelected((prev) => pruneMissingPaths(prev, filesAtCurrentDir.map((f) => f.path)));
  }, [filesAtCurrentDir]);

  const toggleSelect = useCallback((path: string) => {
    setSelected((prev) => toggleInSet(prev, path));
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const renamePath = useCallback((oldPath: string, newPath: string) => {
    setSelected((prev) => {
      if (!prev.has(oldPath)) return prev;
      const next = new Set(prev);
      next.delete(oldPath);
      next.add(newPath);
      return next;
    });
  }, []);

  return { selected, toggleSelect, clearSelection, renamePath };
}
