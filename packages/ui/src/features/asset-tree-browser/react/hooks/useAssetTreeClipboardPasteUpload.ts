import { useEffect, useRef } from 'react';
import type { AssetTreeDomBridgePort } from '../../ports.js';

export interface UseAssetTreeClipboardPasteUploadParams {
  dom: AssetTreeDomBridgePort;
  onUploadFiles: (files: File[]) => void;
  /**
   * Called once per qualifying paste, before `onUploadFiles` — the
   * orchestrator wires this to clear any visible upload-error banner,
   * mirroring the origin `DesignFilesPanel`'s clipboard-paste handler
   * (`setDropReadError(null); onClearUploadError?.();`) before it forwards
   * the pasted files.
   */
  onBeforeUpload?: () => void;
}

/**
 * Global clipboard-paste upload: listens document-wide (via the DOM bridge
 * port, which already ignores a paste landing on a text-entry target and
 * already filters to a non-empty file list — see `dependencies.ts`'s
 * `subscribeGlobalPaste`) and forwards whatever files it finds to
 * `onUploadFiles`.
 */
export function useAssetTreeClipboardPasteUpload(params: UseAssetTreeClipboardPasteUploadParams): void {
  const { dom } = params;
  const onUploadFilesRef = useRef(params.onUploadFiles);
  onUploadFilesRef.current = params.onUploadFiles;
  const onBeforeUploadRef = useRef(params.onBeforeUpload);
  onBeforeUploadRef.current = params.onBeforeUpload;

  useEffect(() => {
    return dom.subscribeGlobalPaste((files) => {
      onBeforeUploadRef.current?.();
      onUploadFilesRef.current(files);
    });
  }, [dom]);
}
