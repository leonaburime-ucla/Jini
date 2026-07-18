import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetTreeFileItem } from '../../types.js';

export interface UseAssetTreePreviewResult<TFile> {
  previewPath: string | null;
  previewFile: TFile | null;
  setPreviewPath: (path: string | null) => void;
  clearPreview: () => void;
}

/**
 * Preview-pane selection: which file (by path) is previewed, resolved
 * against the FULL `files` list (not just the current directory's listing)
 * — the origin `DesignFilesPanel` never clears the preview on navigation, so
 * it can keep showing a file after the user has navigated elsewhere.
 * Auto-applies an optional host-supplied initial pick exactly once per
 * mount, and clears the preview if its file vanishes from `files` (a delete
 * or a refresh).
 */
export function useAssetTreePreview<TFile extends AssetTreeFileItem>(
  files: readonly TFile[],
  selectInitialPreviewFile?: (files: TFile[]) => TFile | null,
): UseAssetTreePreviewResult<TFile> {
  const [previewPath, setPreviewPathState] = useState<string | null>(null);
  const autoPreviewAppliedRef = useRef(false);

  const previewFile = useMemo(
    () => files.find((f) => f.path === previewPath) ?? null,
    [files, previewPath],
  );

  useEffect(() => {
    if (autoPreviewAppliedRef.current) return;
    if (!selectInitialPreviewFile) return;
    const initial = selectInitialPreviewFile([...files]);
    if (!initial) return;
    autoPreviewAppliedRef.current = true;
    setPreviewPathState(initial.path);
  }, [files, selectInitialPreviewFile]);

  useEffect(() => {
    if (!previewPath) return;
    if (files.some((f) => f.path === previewPath)) return;
    setPreviewPathState(null);
  }, [files, previewPath]);

  const setPreviewPath = useCallback((path: string | null) => setPreviewPathState(path), []);
  const clearPreview = useCallback(() => setPreviewPathState(null), []);

  return { previewPath, previewFile, setPreviewPath, clearPreview };
}
