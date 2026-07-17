import { Icon, useT } from '@jini/ui';
import type { ImagePreview } from '../hooks/useAnnotationSubmit.js';

export interface ImageAttachmentStripProps {
  previews: ImagePreview[];
  sending: boolean;
  chromeHidden: boolean;
  onPreview: (index: number) => void;
  onRemove: (index: number) => void;
}

export function ImageAttachmentStrip({ previews, sending, chromeHidden, onPreview, onRemove }: ImageAttachmentStripProps) {
  const t = useT();
  if (previews.length === 0) return null;
  return (
    <div
      aria-label={t('Attached images')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        overflowX: 'auto',
        padding: '6px 8px',
        background: 'rgba(20,20,20,0.92)',
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(8px)',
        zIndex: 90,
        pointerEvents: 'auto',
        visibility: chromeHidden ? 'hidden' : undefined,
      }}
    >
      {previews.map((item, i) => (
        <div key={item.url} style={{ position: 'relative', flex: '0 0 auto' }}>
          <button
            type="button"
            onClick={() => onPreview(i)}
            disabled={sending}
            title={item.file.name}
            aria-label={item.file.name}
            style={{
              display: 'block',
              width: 44,
              height: 44,
              padding: 0,
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.08)',
              cursor: sending ? 'wait' : 'zoom-in',
            }}
          >
            <img src={item.url} alt="" aria-hidden style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={sending}
            aria-label={t('Remove attachment')}
            title={t('Remove attachment')}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.25)',
              background: '#1f1f1f',
              color: '#fff',
              cursor: sending ? 'wait' : 'pointer',
              padding: 0,
            }}
          >
            <Icon name="close" size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
