import { createPortal } from 'react-dom';
import { Icon } from '../../../../components/Icon.js';
import { useT } from '../../../i18n/index.js';
import type { TranslationVars } from '../../../i18n/index.js';
import { FILE_DROPZONE_FONT_PANGRAM, FILE_DROPZONE_FONT_SPECIMEN, FILE_DROPZONE_GLYPH_ICON } from '../../constants.js';
import { fileDropzoneExtensionLabel, fileDropzoneKind, fileDropzoneSizeLabel } from '../../rules.js';
import type { FileDropzoneKind, FileDropzonePreviewState } from '../../types.js';

export interface FileDropzoneLightboxProps {
  file: File;
  previews: FileDropzonePreviewState;
  onClose: () => void;
}

function renderStage(t: (key: string, vars?: TranslationVars) => string, file: File, kind: FileDropzoneKind, previews: FileDropzonePreviewState) {
  const url = previews.previewUrls.get(file);
  if (kind === 'image' && url) {
    return <img src={url} alt={file.name} className="jini-file-dropzone__lightbox-img" />;
  }
  if (kind === 'video' && url) {
    return <video src={url} className="jini-file-dropzone__lightbox-video" controls autoPlay playsInline />;
  }
  if (kind === 'audio' && url) {
    return (
      <div className="jini-file-dropzone__lightbox-audio">
        <span className="jini-file-dropzone__lightbox-audio-icon">
          <Icon name="volume" size={34} />
        </span>
        <audio src={url} controls className="jini-file-dropzone__lightbox-audio-player" />
      </div>
    );
  }
  if (kind === 'pdf' && url) {
    return <iframe src={url} className="jini-file-dropzone__lightbox-frame" title={file.name} />;
  }
  if (kind === 'html' && url) {
    return (
      <iframe
        src={url}
        className="jini-file-dropzone__lightbox-frame"
        title={file.name}
        sandbox="allow-scripts allow-popups"
      />
    );
  }
  if (kind === 'font') {
    const family = previews.fontFamilies.get(file);
    if (family) {
      return (
        <div className="jini-file-dropzone__lightbox-font" style={{ fontFamily: `'${family}'` }}>
          <div className="jini-file-dropzone__lightbox-font-hero">{FILE_DROPZONE_FONT_SPECIMEN}Bb Cc</div>
          <div className="jini-file-dropzone__lightbox-font-pangram">{FILE_DROPZONE_FONT_PANGRAM}</div>
          <div className="jini-file-dropzone__lightbox-font-scale">
            <span style={{ fontSize: 13 }}>{FILE_DROPZONE_FONT_PANGRAM}</span>
            <span style={{ fontSize: 18 }}>{FILE_DROPZONE_FONT_PANGRAM}</span>
            <span style={{ fontSize: 26 }}>{FILE_DROPZONE_FONT_PANGRAM}</span>
          </div>
        </div>
      );
    }
  }
  if (kind === 'text') {
    const snippet = previews.textSnippets.get(file);
    if (snippet != null) {
      return <pre className="jini-file-dropzone__lightbox-text">{snippet || t('(empty file)')}</pre>;
    }
  }
  return (
    <div className="jini-file-dropzone__lightbox-fallback">
      <span className="jini-file-dropzone__lightbox-fallback-glyph" data-kind={kind}>
        <Icon name={FILE_DROPZONE_GLYPH_ICON[kind]} size={40} />
      </span>
      <p className="jini-file-dropzone__lightbox-fallback-name">{file.name}</p>
      <p className="jini-file-dropzone__lightbox-fallback-meta">
        {fileDropzoneExtensionLabel(file)} · {fileDropzoneSizeLabel(file.size) || '—'}
      </p>
      <p className="jini-file-dropzone__lightbox-fallback-hint">{t('No inline preview for this file type.')}</p>
    </div>
  );
}

/** Click-to-enlarge, kind-aware preview for one staged file — image, PDF embed, HTML mini-render, video/audio player, font specimen, or a text snippet, with a name/size fallback card for everything else. Portaled to `document.body`. Ported from `DesignSystemAssetDropzone.tsx`'s lightbox. */
export function FileDropzoneLightbox({ file, previews, onClose }: FileDropzoneLightboxProps) {
  const t = useT();
  const kind = fileDropzoneKind(file);
  return createPortal(
    <div className="jini-file-dropzone__lightbox" onClick={onClose} role="presentation">
      <div
        className="jini-file-dropzone__lightbox-inner"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
      >
        <div className="jini-file-dropzone__lightbox-stage" data-kind={kind}>
          {renderStage(t, file, kind, previews)}
        </div>
        <div className="jini-file-dropzone__lightbox-bar">
          <span className="jini-file-dropzone__lightbox-name" title={file.name}>
            {file.name}
          </span>
          <span className="jini-file-dropzone__lightbox-meta">{fileDropzoneSizeLabel(file.size)}</span>
          <button
            type="button"
            className="jini-file-dropzone__lightbox-close"
            onClick={onClose}
            aria-label={t('Close preview')}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
