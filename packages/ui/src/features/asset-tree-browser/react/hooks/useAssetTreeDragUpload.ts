import { useCallback, useRef, useState, type DragEvent } from 'react';
import { FILE_SYSTEM_READ_ERROR_MESSAGE, isFileSystemReadError } from '../../../../utils/file-system-errors.js';
import { filesFromDataTransfer } from '../../rules.js';

export interface UseAssetTreeDragUploadResult {
  draggingFiles: boolean;
  dropReadError: string | null;
  clearDropReadError: () => void;
  onDragEnter: (event: DragEvent<Element>) => void;
  onDragOver: (event: DragEvent<Element>) => void;
  onDragLeave: (event: DragEvent<Element>) => void;
  onDrop: (event: DragEvent<Element>) => void;
}

/**
 * Drag-and-drop upload over the tree body: a nesting-depth-tracked drag-over
 * overlay (`dragenter`/`dragleave` fire for every descendant element, so a
 * naive boolean would flicker off while dragging over a child row — the
 * `dragDepthRef` counter is what the origin `DesignFilesPanel` uses to avoid
 * that), and the drop handler itself, which recursively expands dropped
 * folders via `rules.ts`'s `filesFromDataTransfer`.
 */
export function useAssetTreeDragUpload(onUploadFiles: (files: File[]) => void): UseAssetTreeDragUploadResult {
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [dropReadError, setDropReadError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const onUploadFilesRef = useRef(onUploadFiles);
  onUploadFilesRef.current = onUploadFiles;

  const clearDropReadError = useCallback(() => setDropReadError(null), []);

  const onDragEnter = useCallback((event: DragEvent<Element>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent<Element>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((event: DragEvent<Element>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      dragDepthRef.current = 0;
      setDraggingFiles(false);
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingFiles(false);
  }, []);

  const onDrop = useCallback((event: DragEvent<Element>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFiles(false);
    setDropReadError(null);
    const dataTransfer = event.dataTransfer;
    void (async () => {
      try {
        const dropped = await filesFromDataTransfer(dataTransfer);
        if (dropped.length > 0) onUploadFilesRef.current(dropped);
      } catch (error) {
        if (!isFileSystemReadError(error)) throw error;
        setDropReadError(FILE_SYSTEM_READ_ERROR_MESSAGE);
      }
    })();
  }, []);

  return { draggingFiles, dropReadError, clearDropReadError, onDragEnter, onDragOver, onDragLeave, onDrop };
}
