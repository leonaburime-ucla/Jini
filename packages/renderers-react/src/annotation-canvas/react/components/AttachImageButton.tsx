import { useRef } from 'react';
import { RemixIcon, useT } from '@jini/ui';
import { historyButtonStyle } from '../styles.js';

export interface AttachImageButtonProps {
  disabled: boolean;
  onFilesSelected: (files: FileList | null) => void;
  onAttachClick?: () => void;
}

export function AttachImageButton({ disabled, onFilesSelected, onAttachClick }: AttachImageButtonProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => {
          onAttachClick?.();
          fileInputRef.current?.click();
        }}
        disabled={disabled}
        aria-label={t('Attach image')}
        title={t('Attach image')}
        data-tooltip={t('Attach image')}
        className="jini-annotation-icon-action"
        style={historyButtonStyle(!disabled)}
      >
        <RemixIcon name="image-add-line" size={14} />
      </button>
    </>
  );
}
