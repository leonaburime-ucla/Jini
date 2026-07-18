// HeaderActionsMenu — a compact "More" overflow menu for a sticky/compact
// header: a single trigger button that opens a grouped popover of actions
// (divided into visually-separated groups, empty groups skipped). Closes on
// outside click or Escape.

import { Fragment, useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from './Icon';

export interface HeaderMenuAction {
  id: string;
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Toggles render with checkbox semantics + a trailing check when active. */
  active?: boolean;
}

export interface HeaderActionsMenuProps {
  /** Each inner array renders as one visually-divided group; empty groups are skipped. */
  groups: HeaderMenuAction[][];
  /** Accessible label for the trigger button and the popover menu. */
  label: string;
}

export function HeaderActionsMenu({ groups, label }: HeaderActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const visibleGroups = groups.filter((group) => group.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="jini-header-actions-menu" ref={wrapRef}>
      <button
        type="button"
        className="jini-header-actions-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-testid="header-actions-menu-trigger"
      >
        <Icon name="more-horizontal" size={16} />
      </button>
      {open ? (
        <div className="jini-header-actions-menu-popover" role="menu" aria-label={label}>
          {visibleGroups.map((group, groupIndex) => (
            <Fragment key={group[0]?.id ?? groupIndex}>
              {groupIndex > 0 ? <div className="jini-header-actions-menu-divider" aria-hidden /> : null}
              {group.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role={item.active === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={item.active === undefined ? undefined : item.active}
                  className="jini-header-actions-menu-item"
                  disabled={item.disabled || item.loading}
                  aria-busy={item.loading || undefined}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  <span className="jini-header-actions-menu-item-icon" aria-hidden>
                    <Icon name={item.loading ? 'spinner' : item.icon} size={15} />
                  </span>
                  <span className="jini-header-actions-menu-item-label">{item.label}</span>
                  {item.active ? (
                    <span className="jini-header-actions-menu-item-check" aria-hidden>
                      <Icon name="check" size={14} />
                    </span>
                  ) : null}
                </button>
              ))}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
