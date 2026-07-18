// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as FileDropzoneFeature from './index.js';

describe('file-dropzone index barrel', () => {
  it('re-exports the constants, rules, hooks, and components it advertises', () => {
    const runtimeExports = [
      'FILE_DROPZONE_KIND_BY_EXTENSION',
      'FILE_DROPZONE_GLYPH_ICON',
      'FILE_DROPZONE_FONT_SPECIMEN',
      'FILE_DROPZONE_FONT_PANGRAM',
      'FILE_DROPZONE_TEXT_PREVIEW_BYTES',
      'FILE_DROPZONE_TEXT_THUMB_CHARS',
      'FILE_DIALOG_FOCUS_DELAY_MS',
      'FILE_DIALOG_WARMUP_MS',
      'FILE_DIALOG_STALE_MS',
      'FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS',
      'FILE_DROPZONE_PROCESSING_FILE_COUNT_THRESHOLD',
      'FILE_DROPZONE_PROCESSING_BYTES_THRESHOLD',
      'fileDropzoneExtension',
      'fileDropzoneKind',
      'fileDropzoneNeedsObjectUrl',
      'fileDropzoneExtensionLabel',
      'fileDropzoneSizeLabel',
      'fileDropzoneStagingKey',
      'fileDropzoneFontFamilyName',
      'fileDropzoneShouldShowProcessing',
      'useFileDialogTracking',
      'useFileDropzonePreviews',
      'useFileDropzone',
      'FileDropzoneThumbnailGrid',
      'FileDropzoneLightbox',
      'FileDropzoneNameList',
      'FileDropzone',
    ] as const;

    for (const name of runtimeExports) {
      expect(FileDropzoneFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
