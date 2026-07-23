/**
 * @module AttachmentTray
 *
 * Renders staged composer attachments as removable chips. A dumb,
 * props-in/JSX-out implementation of the `AttachmentTraySlot` shape from
 * `foundry/docs/jini-port/recon/r4b-webui-design.md` §2 — a host can pass its own
 * `renderItem` for exotic attachment kinds (screenshots, Figma frames, ...)
 * and this component falls back to the built-in chip otherwise.
 */
import type { ChatAttachment } from '@jini/chat-core';
import { useT } from '../hooks/context.js';
import { Icon } from './Icon.js';
import type { AttachmentTraySlot } from '../../slots.js';

export type AttachmentTrayProps = AttachmentTraySlot;

export function AttachmentTray({ attachments, onRemove, renderItem }: AttachmentTrayProps) {
  const t = useT();
  if (attachments.length === 0) return null;
  return (
    <div className="jini-attachment-tray">
      {attachments.map((a) => (
        <div key={a.path} className="jini-attachment-chip">
          {renderItem ? renderItem(a) : <DefaultAttachmentChip attachment={a} />}
          <button type="button" className="jini-attachment-remove" onClick={() => onRemove(a.path)} title={t('Remove {name}', { name: a.name })} aria-label={t('Remove {name}', { name: a.name })}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function DefaultAttachmentChip({ attachment }: { attachment: ChatAttachment }) {
  return (
    <span className="jini-attachment-chip-body">
      {attachment.kind === 'image' ? <Icon name="attach" size={12} /> : null}
      <span className="jini-attachment-chip-name">{attachment.name}</span>
    </span>
  );
}
