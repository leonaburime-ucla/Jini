import { createPortal } from 'react-dom';
import { Icon, useT } from '@jini/ui';
import type { ImagePreview } from '../hooks/useAnnotationSubmit.js';

export interface ImagePreviewModalProps {
  preview: ImagePreview;
  onClose: () => void;
}

/** A zoomed staged-image preview, portalled to `document.body`. Closed by
 *  clicking its own backdrop, its close button, or Escape (the Escape
 *  handler lives in `useAnnotationSubmit`, capture-phase, so it runs
 *  before the overlay's own Escape-to-deactivate). */
export function ImagePreviewModal({ preview, onClose }: ImagePreviewModalProps) {
  const t = useT();
  return createPortal(
    <div
      className="jini-annotation-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label={preview.file.name}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="jini-annotation-preview-card">
        <div className="jini-annotation-preview-head">
          <span title={preview.file.name}>{preview.file.name}</span>
          <button type="button" className="icon-only" onClick={onClose} aria-label={t('Close')} title={t('Close')}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <img src={preview.url} alt={preview.file.name} />
      </div>
    </div>,
    document.body,
  );
}
