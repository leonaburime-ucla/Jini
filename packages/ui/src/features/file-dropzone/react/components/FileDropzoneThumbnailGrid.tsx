import { Icon } from '../../../../components/Icon.js';
import { useT } from '../../../i18n/index.js';
import { FILE_DROPZONE_FONT_SPECIMEN, FILE_DROPZONE_GLYPH_ICON, FILE_DROPZONE_TEXT_THUMB_CHARS } from '../../constants.js';
import { fileDropzoneExtensionLabel, fileDropzoneKind, fileDropzoneStagingKey } from '../../rules.js';
import type { FileDropzoneKind, FileDropzonePreviewState } from '../../types.js';

export interface FileDropzoneThumbnailGridProps {
  files: readonly File[];
  previews: FileDropzonePreviewState;
  onSelect: (file: File) => void;
  onRemove?: ((file: File) => void) | undefined;
}

function renderGlyph(file: File, kind: FileDropzoneKind) {
  return (
    <span className="jini-file-dropzone__glyph" data-kind={kind}>
      <Icon name={FILE_DROPZONE_GLYPH_ICON[kind]} size={20} />
      <span className="jini-file-dropzone__glyph-ext">{fileDropzoneExtensionLabel(file)}</span>
    </span>
  );
}

function renderThumb(file: File, kind: FileDropzoneKind, previews: FileDropzonePreviewState) {
  const url = previews.previewUrls.get(file);
  if (kind === 'image' && url) {
    return <img src={url} alt="" className="jini-file-dropzone__thumb" loading="lazy" />;
  }
  if (kind === 'video' && url) {
    return (
      <video className="jini-file-dropzone__thumb" src={url} muted playsInline preload="metadata" tabIndex={-1} />
    );
  }
  if (kind === 'font') {
    const family = previews.fontFamilies.get(file);
    if (family) {
      return (
        <span className="jini-file-dropzone__font-thumb" style={{ fontFamily: `'${family}'` }} aria-hidden>
          {FILE_DROPZONE_FONT_SPECIMEN}
        </span>
      );
    }
  }
  if (kind === 'html' && url) {
    return (
      <span className="jini-file-dropzone__frame-thumb" aria-hidden>
        <iframe className="jini-file-dropzone__html-thumb" src={url} title="" sandbox="" tabIndex={-1} />
      </span>
    );
  }
  if (kind === 'text') {
    const snippet = previews.textSnippets.get(file);
    if (snippet && snippet.trim()) {
      return (
        <span className="jini-file-dropzone__text-thumb" aria-hidden>
          {snippet.slice(0, FILE_DROPZONE_TEXT_THUMB_CHARS)}
        </span>
      );
    }
  }
  return renderGlyph(file, kind);
}

/** Kind-aware thumbnail grid over staged files, with remove tiles and click-to-select (the host renders the lightbox — see `FileDropzoneLightbox`). Ported from `DesignSystemAssetDropzone.tsx`'s staged-asset grid. */
export function FileDropzoneThumbnailGrid({ files, previews, onSelect, onRemove }: FileDropzoneThumbnailGridProps) {
  const t = useT();
  if (files.length === 0) return null;
  return (
    <ul className="jini-file-dropzone__grid" aria-label={t('Staged files')}>
      {files.map((file) => {
        const kind = fileDropzoneKind(file);
        return (
          <li key={fileDropzoneStagingKey(file)} className="jini-file-dropzone__tile">
            <button
              type="button"
              className="jini-file-dropzone__tile-main"
              onClick={() => onSelect(file)}
              title={file.name}
            >
              {renderThumb(file, kind, previews)}
            </button>
            {onRemove ? (
              <button
                type="button"
                className="jini-file-dropzone__remove"
                aria-label={t('Remove {name}', { name: file.name })}
                onClick={() => onRemove(file)}
              >
                <Icon name="close" size={12} />
              </button>
            ) : null}
            <span className="jini-file-dropzone__caption" title={file.name}>
              {file.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
