import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../../../features/i18n/index.js';
import { Icon } from '../../../../../../components/Icon.js';
import type { McpClientDescriptor, McpClientId } from '../../types.js';

export interface ClientPickerProps {
  clients: readonly McpClientDescriptor[];
  selectedClientId: McpClientId;
  onSelect: (clientId: McpClientId) => void;
  /** Method sub-label shown under the selected client's name (e.g. "Run a
   *  command" / "Edit a JSON file") — purely presentational, host-supplied
   *  so it can vary by fetched install info. */
  methodLabel?: string | undefined;
}

/**
 * Dropdown client picker. Origin: the `ds-picker` markup inline in
 * `IntegrationsSection` — closes on outside click or Escape.
 */
export function ClientPicker({ clients, selectedClientId, onSelect, methodLabel }: ClientPickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = clients.find((c) => c.id === selectedClientId) ?? clients[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="jini-picker" ref={rootRef}>
      <button
        type="button"
        className={`jini-picker-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="jini-picker-meta">
          <span className="jini-picker-title">{selected ? t(selected.label) : ''}</span>
          {methodLabel ? <span className="jini-picker-sub">{methodLabel}</span> : null}
        </span>
        <Icon name="chevron-down" size={14} className="jini-picker-chevron" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open ? (
        <div className="jini-picker-popover" role="listbox">
          <div className="jini-picker-list">
            {clients.map((client) => {
              const active = client.id === selectedClientId;
              return (
                <button
                  key={client.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`jini-picker-item${active ? ' active' : ''}`}
                  onClick={() => {
                    onSelect(client.id);
                    setOpen(false);
                  }}
                >
                  <span className="jini-picker-item-title">{t(client.label)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
