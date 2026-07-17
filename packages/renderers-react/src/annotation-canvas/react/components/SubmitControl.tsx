import { Icon, RemixIcon, useT } from '@jini/ui';
import { dropdownMenuStyle, menuItemIconStyle, menuItemStyle, submitActionButtonStyle, submitSplitStyle } from '../styles.js';
import type { AnnotationAction } from '../../types.js';

interface SubmitOption {
  action: AnnotationAction;
  label: string;
  pendingLabel: string;
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export interface SubmitControlProps {
  menuRef: React.RefObject<HTMLDivElement | null>;
  submitAction: AnnotationAction;
  /** Runs the split button's main half (the currently-selected action). */
  onSubmit: (action: AnnotationAction) => void;
  /** Picks a different action from the dropdown, closes the menu, and runs it. */
  onPick: (action: AnnotationAction) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  sending: boolean;
  pendingAction: AnnotationAction | null;
  canSend: boolean;
  canAddToInput: boolean;
  canSubmit: boolean;
  sendDisabled: boolean;
  sendDisabledReason?: string | undefined;
}

/**
 * The submit split button: the main half runs the currently-selected
 * action (default 'send', so a host with no opinion gets an immediate
 * send), and the chevron opens a menu to switch between Send / Add to
 * input / Queue. Each action has its own icon, label, pending label, and
 * enable rule.
 */
export function SubmitControl({
  menuRef,
  submitAction,
  onSubmit,
  onPick,
  menuOpen,
  onToggleMenu,
  sending,
  pendingAction,
  canSend,
  canAddToInput,
  canSubmit,
  sendDisabled,
  sendDisabledReason,
}: SubmitControlProps) {
  const t = useT();
  const options: SubmitOption[] = [
    {
      action: 'send',
      label: t('Send'),
      pendingLabel: t('Sending…'),
      title: sendDisabled ? sendDisabledReason ?? t('Sending is unavailable right now.') : t('Send'),
      icon: <Icon name="send" size={14} />,
      enabled: canSend,
    },
    {
      action: 'draft',
      label: t('Add to input'),
      pendingLabel: t('Adding to input…'),
      title: t('Add to input'),
      icon: <RemixIcon name="input-field" size={15} />,
      enabled: canAddToInput,
    },
    {
      action: 'queue',
      label: t('Queue'),
      pendingLabel: t('Queueing…'),
      title: t('Queue'),
      icon: <RemixIcon name="list-check-2" size={15} />,
      enabled: canSubmit,
    },
  ];
  const current = options.find((opt) => opt.action === submitAction) ?? options[0]!;

  return (
    <div className="jini-annotation-submit" ref={menuRef} style={submitSplitStyle}>
      <button
        type="button"
        onClick={() => onSubmit(submitAction)}
        disabled={sending || !current.enabled}
        aria-label={pendingAction === submitAction ? current.pendingLabel : current.label}
        title={pendingAction === submitAction ? current.pendingLabel : current.title}
        data-tooltip={pendingAction === submitAction ? current.pendingLabel : current.title}
        className="jini-annotation-icon-action"
        style={{
          ...submitActionButtonStyle(true),
          width: 'auto',
          minWidth: 40,
          padding: '0 7px 0 12px',
          borderRadius: '999px 0 0 999px',
          opacity: current.enabled ? 1 : 0.4,
          cursor: sending ? 'wait' : current.enabled ? 'pointer' : 'not-allowed',
        }}
      >
        {pendingAction === submitAction ? <Icon name="spinner" size={14} /> : current.icon}
      </button>
      <button
        type="button"
        onClick={onToggleMenu}
        disabled={sending || !canSubmit}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t('Submit options')}
        title={t('Submit options')}
        style={{
          ...submitActionButtonStyle(true),
          width: 25,
          borderRadius: '0 999px 999px 0',
          borderLeft: '1px solid rgba(255,255,255,0.28)',
          opacity: !sending && canSubmit ? 1 : 0.5,
          cursor: sending ? 'wait' : canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        <RemixIcon name={menuOpen ? 'arrow-down-s-line' : 'arrow-up-s-line'} size={14} />
      </button>
      {menuOpen ? (
        <div role="menu" aria-label={t('Submit options')} style={dropdownMenuStyle}>
          {options.map((opt) => {
            const itemEnabled = !sending && opt.enabled;
            const active = submitAction === opt.action;
            return (
              <button
                key={opt.action}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-label={opt.label}
                disabled={!itemEnabled}
                title={opt.title}
                onClick={() => onPick(opt.action)}
                style={menuItemStyle(active, itemEnabled)}
              >
                <span style={menuItemIconStyle}>{opt.icon}</span>
                <span style={{ flex: '1 1 auto' }}>{opt.label}</span>
                {active ? <RemixIcon name="check-line" size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
