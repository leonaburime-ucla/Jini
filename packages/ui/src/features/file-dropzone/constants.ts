import type { IconName } from '../../components/Icon.js';
import type { FileDropzoneKind } from './types.js';

/** MIME-type sniffing (see `rules.ts`'s `fileDropzoneKind`) is authoritative when present; this is the fallback for files the browser types as `application/octet-stream`. */
export const FILE_DROPZONE_KIND_BY_EXTENSION: Record<string, FileDropzoneKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  svg: 'image', avif: 'image', bmp: 'image', ico: 'image', apng: 'image',
  woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  pdf: 'pdf',
  html: 'html', htm: 'html',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  ppt: 'slides', pptx: 'slides', key: 'slides', odp: 'slides',
  txt: 'text', md: 'text', markdown: 'text', json: 'text', csv: 'text',
  css: 'text', js: 'text', jsx: 'text', ts: 'text', tsx: 'text',
  xml: 'text', yml: 'text', yaml: 'text', toml: 'text',
};

/** Fallback glyph icon for a kind with no renderable preview (or while a preview hasn't loaded yet). */
export const FILE_DROPZONE_GLYPH_ICON: Record<FileDropzoneKind, IconName> = {
  image: 'image',
  font: 'file',
  pdf: 'file',
  html: 'file-code',
  video: 'play',
  audio: 'volume',
  slides: 'present',
  text: 'file-code',
  other: 'file',
};

export const FILE_DROPZONE_FONT_SPECIMEN = 'Ag';
export const FILE_DROPZONE_FONT_PANGRAM = 'The quick brown fox jumps over the lazy dog 0123456789';

/** Bytes read from the start of a text-like file for its snippet thumbnail + lightbox preview — capped so a large JSON/CSS never blocks. */
export const FILE_DROPZONE_TEXT_PREVIEW_BYTES = 16 * 1024;
/** Snippet thumbnail truncation (the lightbox shows the full capped read). */
export const FILE_DROPZONE_TEXT_THUMB_CHARS = 360;

// --- file-dialog cancel-vs-still-loading detection heuristic ---------------
//
// Ported from `DesignSystemFlow.tsx`'s `DropZone`. A native `<input
// type=file>` click opens an OS-level dialog with no DOM signal for "still
// open" — only `window` regaining `focus` (dialog closed, picked or not) and
// the input's own `cancel` event (dialog dismissed with no selection). See
// `react/hooks/useFileDialogTracking.ts` for the state machine these drive.

/** A `focus` event within this delay of opening the dialog is ignored — too soon to be a genuine dialog-closed signal. */
export const FILE_DIALOG_FOCUS_DELAY_MS = 120;
/** If no `focus` signal arrives within this long, assume the dialog is genuinely open and start showing a loading affordance anyway. */
export const FILE_DIALOG_WARMUP_MS = 450;
/** Safety net: force-clear a loading affordance that's been open this long without the dialog resolving (a hung/buggy picker). */
export const FILE_DIALOG_STALE_MS = 30_000;
/** Minimum time a loading affordance stays visible once shown, so it never flashes. */
export const FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS = 900;
/** A selection at or above this file count is treated as large enough to show a loading affordance while it's staged. */
export const FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD = 24;
/** A selection at or above this total size is treated as large enough to show a loading affordance while it's staged. */
export const FILE_DROPZONE_PROCESSING_BYTES_THRESHOLD = 4 * 1024 * 1024;
