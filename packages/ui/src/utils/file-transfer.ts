/**
 * Framework-free primitives for turning a native drag/drop or clipboard-paste
 * event into a flat `File[]`, including recursive directory expansion via the
 * `FileSystemEntry` API. Promoted (2026-07-18) out of
 * `features/asset-tree-browser/rules.ts`, which had already generalized this
 * away from its origin `DesignFilesPanel.tsx` with zero product coupling —
 * moved here so `features/file-dropzone/` (the second consumer, ported from
 * OD's `DesignSystemAssetDropzone.tsx`/`DesignSystemFlow.tsx`'s `DropZone`)
 * reuses the exact same directory-walking algorithm instead of a third
 * near-duplicate. `asset-tree-browser/rules.ts` re-exports these names
 * unchanged for its own existing callers/tests.
 */
import { createFileSystemReadError } from './file-system-errors.js';

// --- clipboard-paste ---------------------------------------------------

export function filesFromClipboardData(clipboardData: DataTransfer | null): File[] {
  const files = Array.from(clipboardData?.files ?? []);
  if (files.length > 0) return files.map(normalizePastedFile);
  const items = Array.from(clipboardData?.items ?? []);
  return items
    .filter((item) => item.kind === 'file')
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [normalizePastedFile(file)] : [];
    });
}

/** A pasted file with no filename (common for a straight image-data paste) gets a synthetic timestamped name so it isn't uploaded as `""`. */
export function normalizePastedFile(file: File): File {
  if (file.name.trim()) return file;
  const extension = extensionForMimeType(file.type);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new File([file], `pasted-${stamp}${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/svg+xml') return '.svg';
  if (mimeType === 'text/html') return '.html';
  if (mimeType === 'text/plain') return '.txt';
  return '';
}

/** Whether a global paste event landed on a text-entry target that owns paste itself (so a page-wide clipboard-upload listener should ignore it). */
export function shouldIgnoreClipboardFilePaste(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[contenteditable="true"]')) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

// --- drag-and-drop ---------------------------------------------------

type FileSystemEntryWithReader = FileSystemEntry & {
  createReader?: () => FileSystemDirectoryReader;
};
type FileSystemFileEntryWithFile = FileSystemFileEntry & {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};
type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

/** Resolves a drop's `DataTransfer` into a flat `File[]`, recursively expanding any dropped folders via the `FileSystemEntry` API. Falls back to `dataTransfer.files` when the browser exposes no entry API, or when every item's entry read fails. */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const fallbackFiles = Array.from(dataTransfer.files ?? []);
  if (items.length === 0) return fallbackFiles;

  const results = await Promise.allSettled(items.map(filesFromDataTransferItem));
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected) {
    if (fallbackFiles.length > 0) return fallbackFiles;
    throw rejected.reason;
  }
  // Every entry in `results` is guaranteed fulfilled here — the `if (rejected)`
  // check above already returned/threw for the first rejected one, so
  // there's no reachable `result.status === 'rejected'` case left to branch
  // on (an earlier `flatMap((result) => (status === 'fulfilled' ? value : []))`
  // form carried a dead `: []` arm that v8 correctly flagged as never taken).
  const files = (results as PromiseFulfilledResult<File[]>[]).flatMap((result) => result.value);
  return files.length > 0 ? files : fallbackFiles;
}

async function filesFromDataTransferItem(item: DataTransferItem): Promise<File[]> {
  const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.();
  if (!entry) {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return file ? [file] : [];
  }
  return filesFromFileSystemEntry(entry);
}

export async function filesFromFileSystemEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) return [await fileFromEntry(entry as FileSystemFileEntryWithFile)];
  if (!entry.isDirectory) return [];

  const reader = (entry as FileSystemEntryWithReader).createReader?.();
  if (!reader) return [];

  const files: File[] = [];
  for (;;) {
    const entries = await readEntryBatch(reader);
    if (entries.length === 0) break;
    const nested = await Promise.all(entries.map(filesFromFileSystemEntry));
    files.push(...nested.flat());
  }
  return files;
}

function fileFromEntry(entry: FileSystemFileEntryWithFile): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, (error) => {
      reject(createFileSystemReadError('Could not read dropped file', error));
    });
  });
}

function readEntryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, (error) => {
      reject(createFileSystemReadError('Could not read dropped folder', error));
    });
  });
}
