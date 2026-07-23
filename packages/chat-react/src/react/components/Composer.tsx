/**
 * @module Composer
 *
 * The dumb, presentational half of the composer: takes a `useComposer()`
 * controller (headless state) plus a few UI-only props and renders the
 * textarea/attachment-tray/send-button chrome. Slot extraction points
 * (`ComposerPlusItem[]`, `leadingAccessories`, the mention popover) are
 * generalized from OD's `ChatComposer.tsx` decomposition
 * (`ComposerPlusMenu`/`LibraryPicker`/`SessionModeToggle`-equivalent) per
 * `foundry/docs/jini-port/recon/r4b-webui-design.md` §2/§3 — this component renders
 * the slots a host supplies; it does not itself know what a "library
 * picker" or "session mode" is.
 */
import { type KeyboardEvent } from 'react';
import { useT } from '../hooks/context.js';
import { Icon } from './Icon.js';
import { AttachmentTray } from './AttachmentTray.js';
import type { UseComposerResult } from '../hooks/useComposer.js';
import type { ComposerSlots } from '../../slots.js';

export interface ComposerProps {
  composer: UseComposerResult;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  slots?: ComposerSlots;
}

export function Composer({ composer, onSend, disabled = false, placeholder, slots }: ComposerProps) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t('Send a message…');

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!disabled && composer.canSubmit) onSend();
  }

  return (
    <div className="jini-composer">
      {slots?.leadingAccessories ? <div className="jini-composer-leading">{slots.leadingAccessories}</div> : null}
      <AttachmentTray attachments={composer.attachments} onRemove={composer.removeAttachment} />
      <textarea
        className="jini-composer-input"
        value={composer.draft}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        onChange={(e) => composer.setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <div className="jini-composer-footer">
        {slots?.plusMenuItems && slots.plusMenuItems.length > 0 ? (
          <div className="jini-composer-plus-menu">
            {slots.plusMenuItems.map((item) => (
              <button key={item.id} type="button" className="jini-composer-plus-item" onClick={() => void item.onSelect()} title={t(item.label)}>
                {item.icon ?? null}
                <span>{t(item.label)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="jini-composer-send" disabled={disabled || !composer.canSubmit} onClick={onSend} title={t('Send')} aria-label={t('Send')}>
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  );
}
