/**
 * Pure logic for the asset-tree-browser feature. No React. `filesFromDataTransfer`
 * / `filesFromFileSystemEntry` touch the browser's `FileSystemEntry` API, but
 * only through arguments a caller hands them (no `window`/`document` global
 * reads) — same "parameterized, not global-reading" discipline
 * `features/asset-grid/rules.ts`'s `snapshotCardRects` documents for its own
 * DOM-touching function.
 */
import { createFileSystemReadError } from '../../utils/file-system-errors.js';
import {
  DEFAULT_KIND_GLYPH,
  DOUBLE_ACTIVATION_WINDOW_MS,
  ROW_MENU_ESTIMATED_HEIGHT_PX,
  ROW_MENU_SAFE_PADDING_PX,
} from './constants.js';
import type {
  AssetTreeBreadcrumbSegment,
  AssetTreeFileItem,
  AssetTreeFolderItem,
  AssetTreeKindConfig,
  AssetTreeKindConfigMap,
  AssetTreeRelativeTime,
  AssetTreeSection,
  AssetTreeSelectors,
} from './types.js';

// --- directory + section derivation ----------------------------------------

export interface TreeChildren<TFile> {
  dirsAtCurrentDir: string[];
  filesAtCurrentDir: TFile[];
}

/**
 * Derives the immediate subdirectories and files visible at `currentDir`
 * from the flat `files` list plus any persisted (possibly-empty) `folders`.
 *
 * Preserves the origin's root-level behavior exactly: at the tree root
 * (`currentDir === ''`), every file is pushed into `filesAtCurrentDir` —
 * both root-level files AND files nested under a subdirectory (which also
 * contribute their top segment to `dirsAtCurrentDir`) — so the root view is
 * a flattened "everything" listing with folders offered as a secondary
 * drill-down. Inside a non-root directory, only files strictly at that one
 * level are included. Verified against the real `DesignFilesPanel.tsx`
 * (`dirsAtCurrentDir`/`filesAtCurrentDir` `useMemo`) rather than assumed —
 * this asymmetry looks surprising but is exactly what the source does.
 */
export function deriveTreeChildren<TFile extends AssetTreeFileItem>(
  files: readonly TFile[],
  folders: readonly AssetTreeFolderItem[],
  currentDir: string,
): TreeChildren<TFile> {
  const prefix = currentDir === '' ? '' : `${currentDir}/`;
  const dirs = new Set<string>();
  const localFiles: TFile[] = [];
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const remainder = f.path.slice(prefix.length);
    const slashIdx = remainder.indexOf('/');
    if (slashIdx === -1) {
      localFiles.push(f);
    } else {
      dirs.add(remainder.slice(0, slashIdx));
      if (currentDir === '') localFiles.push(f);
    }
  }
  for (const folder of folders) {
    if (!folder.path.startsWith(prefix)) continue;
    const remainder = folder.path.slice(prefix.length);
    if (!remainder) continue; // the current directory itself
    const slashIdx = remainder.indexOf('/');
    dirs.add(slashIdx === -1 ? remainder : remainder.slice(0, slashIdx));
  }
  return {
    dirsAtCurrentDir: [...dirs].sort((a, b) => a.localeCompare(b)),
    filesAtCurrentDir: localFiles,
  };
}

/**
 * Groups files at the current level into kind sections, ordered by the
 * host's `sectionOrder` with any kind absent from it appended afterward in
 * first-seen order (the origin's `SECTION_ORDER` never needed this fallback
 * since it enumerated every `ProjectFileKind` — this package's `kind` is an
 * arbitrary host string, so an unconfigured kind must still render
 * somewhere rather than silently vanishing). Files within a section sort
 * most-recently-modified first.
 */
export function groupFilesByKind<TFile>(
  files: readonly TFile[],
  sectionOrder: readonly string[],
  getKind: (file: TFile) => string,
  getModifiedAt: (file: TFile) => number,
): AssetTreeSection<TFile>[] {
  const grouped = new Map<string, TFile[]>();
  const firstSeenOrder: string[] = [];
  for (const f of files) {
    const kind = getKind(f);
    let bucket = grouped.get(kind);
    if (!bucket) {
      bucket = [];
      grouped.set(kind, bucket);
      firstSeenOrder.push(kind);
    }
    bucket.push(f);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => getModifiedAt(b) - getModifiedAt(a));
  }
  const ordered = sectionOrder.filter((kind) => grouped.has(kind));
  const seen = new Set(ordered);
  for (const kind of firstSeenOrder) {
    if (!seen.has(kind)) {
      ordered.push(kind);
      seen.add(kind);
    }
  }
  return ordered.map((kind) => ({ kind, files: grouped.get(kind)! }));
}

/**
 * The nearest ancestor of `currentDir` that still exists (has files under it
 * or is itself a persisted folder), or `''` if none do. Returns `null` when
 * no correction is needed (already at the root, or `currentDir` itself still
 * exists) — callers should treat `null` as "don't navigate".
 */
export function nextExistingAncestorDir<TFile extends AssetTreeFileItem>(
  files: readonly TFile[],
  folders: readonly AssetTreeFolderItem[],
  currentDir: string,
): string | null {
  if (currentDir === '') return null;
  const dirExists = (dir: string) =>
    files.some((f) => f.path.startsWith(`${dir}/`)) ||
    folders.some((fo) => fo.path === dir || fo.path.startsWith(`${dir}/`));
  if (dirExists(currentDir)) return null;
  const parts = currentDir.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const ancestor = parts.slice(0, i).join('/');
    if (dirExists(ancestor)) return ancestor;
  }
  return '';
}

// --- selection ---------------------------------------------------------

export function toggleInSet(prev: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(prev);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

/**
 * Drops selected paths absent from `livePaths`. Returns `prev` unchanged
 * (the exact same `Set` reference) when nothing was dropped, so a caller's
 * `setSelected` bails out of the state update instead of forcing an extra
 * render — same reasoning as `features/asset-grid/rules.ts`'s
 * `pruneMissingSelection`.
 */
export function pruneMissingPaths(prev: Set<string>, livePaths: Iterable<string>): Set<string> {
  if (prev.size === 0) return prev;
  const live = new Set(livePaths);
  const next = new Set(prev);
  let changed = false;
  for (const p of next) {
    if (!live.has(p)) {
      next.delete(p);
      changed = true;
    }
  }
  return changed ? next : prev;
}

// --- rename ---------------------------------------------------------

/** The editable basename for `path` when renaming inside `currentDir` (strips the directory prefix). */
export function basenameForRename(path: string, currentDir: string): string {
  return currentDir === '' ? path : path.slice(currentDir.length + 1);
}

export interface RenameCommitDecision {
  nextPath: string;
}

/**
 * Whether a commit of `draft` (the edited basename) should proceed, and the
 * resulting full path if so. Returns `null` for the two no-op cases the
 * origin's `commitRename` short-circuits on: an empty (whitespace-only)
 * draft, or a draft that resolves back to the exact same path.
 */
export function resolveRenameCommit(path: string, currentDir: string, draft: string): RenameCommitDecision | null {
  const nextBasename = draft.trim();
  if (!nextBasename) return null;
  const nextPath = currentDir === '' ? nextBasename : `${currentDir}/${nextBasename}`;
  if (nextPath === path) return null;
  return { nextPath };
}

// --- row context menu ---------------------------------------------------

export interface MenuAnchorRect {
  top: number;
  bottom: number;
  right: number;
}

export interface MenuPositionOptions {
  estimatedHeight?: number;
  safePadding?: number;
}

/**
 * Viewport-flip position for the row context menu: opens below its anchor
 * when there's room, above when there isn't but there IS room above, and
 * otherwise clamps to the viewport with `safePadding` clearance.
 */
export function computeMenuPosition(
  anchor: MenuAnchorRect,
  viewportHeight: number,
  options: MenuPositionOptions = {},
): { top: number; left: number } {
  const estimatedHeight = options.estimatedHeight ?? ROW_MENU_ESTIMATED_HEIGHT_PX;
  const safePadding = options.safePadding ?? ROW_MENU_SAFE_PADDING_PX;
  const spaceBelow = viewportHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  let top: number;
  if (spaceBelow >= estimatedHeight + safePadding) {
    top = anchor.bottom + 4;
  } else if (spaceAbove >= estimatedHeight + safePadding) {
    top = anchor.top - estimatedHeight - 4;
  } else {
    top = Math.max(safePadding, viewportHeight - estimatedHeight - safePadding);
  }
  const left = Math.max(safePadding, anchor.right - 160);
  return { top, left };
}

/** Whether the row menu's "copy local path" action should be enabled for `file`. */
export function canCopyLocalPath<TFile>(file: TFile, selectors: AssetTreeSelectors<TFile>): boolean {
  return !!selectors.getLocalPath?.(file);
}

// --- keyboard row activation ---------------------------------------------------

/** Whether `nowMs` lands within `windowMs` of a prior activation timestamp — the double-Enter-to-open gesture on a keyboard-focused row name. */
export function isDoubleActivation(
  lastTimestampMs: number | undefined,
  nowMs: number,
  windowMs: number = DOUBLE_ACTIVATION_WINDOW_MS,
): boolean {
  return lastTimestampMs !== undefined && nowMs - lastTimestampMs < windowMs;
}

// --- display formatting ---------------------------------------------------

/** Display config for `kind`, falling back to the raw kind key as the label and a generic glyph when the host's `AssetTreeKindConfigMap` has no entry for it. */
export function resolveKindConfig(kind: string, kindConfig: AssetTreeKindConfigMap): AssetTreeKindConfig {
  return kindConfig[kind] ?? { label: kind, glyph: DEFAULT_KIND_GLYPH };
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** See {@link AssetTreeRelativeTime} for why this returns a template + params instead of a finished string. */
export function relativeTimeResult(ts: number, nowMs: number = Date.now()): AssetTreeRelativeTime {
  const diff = nowMs - ts;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return { label: 'Just now', translatable: true };
  if (diff < hr) return { label: '{n}m ago', translatable: true, params: { n: Math.floor(diff / min) } };
  if (diff < day) return { label: '{n}h ago', translatable: true, params: { n: Math.floor(diff / hr) } };
  if (diff < 7 * day) return { label: '{n}d ago', translatable: true, params: { n: Math.floor(diff / day) } };
  if (diff < 30 * day) {
    return { label: '{n}w ago', translatable: true, params: { n: Math.floor(diff / (7 * day)) } };
  }
  return { label: new Date(ts).toLocaleDateString(), translatable: false };
}

/** Breadcrumb segments for every path component below the tree root (the root itself is rendered separately by `Breadcrumbs` since its label is host-configurable). */
export function buildBreadcrumbSegments(currentDir: string): AssetTreeBreadcrumbSegment[] {
  const parts = currentDir.split('/').filter(Boolean);
  return parts.map((segment, idx) => ({
    path: parts.slice(0, idx + 1).join('/'),
    label: segment,
    isLast: idx === parts.length - 1,
  }));
}

// --- clipboard-paste upload ---------------------------------------------------

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

/** Whether a global paste event landed on a text-entry target that owns paste itself (so the tree's clipboard-upload listener should ignore it). */
export function shouldIgnoreClipboardFilePaste(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[contenteditable="true"]')) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

// --- drag-and-drop upload ---------------------------------------------------

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
  const files = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
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
