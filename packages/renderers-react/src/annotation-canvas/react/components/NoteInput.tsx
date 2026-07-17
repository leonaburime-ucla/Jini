import { useRef } from 'react';
import { isImeComposing, useT } from '@jini/ui';
import { noteInputStyle } from '../styles.js';

export interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  disabled: boolean;
  /** Enter (outside IME composition) submits via the 'queue' action —
   *  matches the original's one keyboard shortcut on this field. */
  onEnterQueue: () => void;
}

export function NoteInput({ value, onChange, onPaste, disabled, onEnterQueue }: NoteInputProps) {
  const t = useT();
  const composingRef = useRef(false);

  return (
    <input
      className="jini-annotation-note-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onPaste={onPaste}
      disabled={disabled}
      placeholder={t('Add a note…')}
      style={noteInputStyle}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (isImeComposing(e, composingRef.current)) return;
        if (e.key === 'Enter') onEnterQueue();
      }}
    />
  );
}
