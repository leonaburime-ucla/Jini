import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  /**
   * Currently selected local working directory shown inline with a clear
   * button, or null to show only the "select" label (e.g. when the selection
   * is surfaced elsewhere, like a project composer's linked-dir chips).
   */
  workingDir: string | null;
  /** Most-recently-used directories, most-recent-first. */
  recentDirs: string[];
  /** Open the native folder picker. */
  onPickDirectory: () => void;
  /** Re-select a previously used directory. */
  onSelectRecent: (dir: string) => void;
  /** Clear the current selection. Only reachable when `workingDir` is set. */
  onClear?: () => void;
  /** Extra class applied to the outer wrapper, for layout by the host. */
  className?: string;
  /** The selected directory no longer exists on disk — flag it in red. */
  invalid?: boolean;
  /**
   * Panel direction. `'down'` (default) suits a composer with room below;
   * `'up'` suits a composer whose trigger sits at the bottom of the
   * viewport, so a downward panel would be clipped.
   */
  placement?: 'down' | 'up';
  /** Fired when the panel opens, so the host can re-validate freshness. */
  onOpen?: () => void;
  /** Copy — all host-supplied, no built-in i18n. */
  labels?: Partial<{
    missing: string;
    hint: string;
    trigger: string;
    replace: string;
    pick: string;
    recent: string;
    recentEmpty: string;
    clear: string;
  }>;
}

const DEFAULT_LABELS = {
  missing: 'Directory no longer exists',
  hint: 'Select a working directory',
  trigger: 'Working directory',
  replace: 'Change folder',
  pick: 'Choose folder',
  recent: 'Recent folders',
  recentEmpty: 'No recent folders',
  clear: 'Clear',
};

function basename(dir: string): string {
  return dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;
}

/**
 * Working-directory picker: a borderless trigger that opens a panel with
 * "Choose folder" and a "Recent folders" submenu. Layout is left to the host
 * via `className`; this component owns only the open/close/keyboard state.
 */
export function WorkingDirPicker({
  workingDir,
  recentDirs,
  onPickDirectory,
  onSelectRecent,
  onClear,
  className,
  placement = 'down',
  invalid = false,
  onOpen,
  labels,
}: Props) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setRecentOpen(false);
      return;
    }
    function onPointer(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`jini-working-dir-picker${className ? ` ${className}` : ''}`}
      data-testid="working-dir-picker"
    >
      <div className="jini-working-dir-trigger-row">
        <button
          type="button"
          className={`jini-working-dir-trigger${invalid ? ' invalid' : ''}`}
          data-testid="working-dir-trigger"
          aria-expanded={open}
          title={invalid ? t.missing : (workingDir ?? t.hint)}
          onClick={() =>
            setOpen((v) => {
              if (!v) onOpen?.();
              return !v;
            })
          }
        >
          <Icon name="folder" size={13} className="jini-working-dir-trigger-icon" />
          <span className="jini-working-dir-trigger-label">
            {workingDir ? basename(workingDir) : t.trigger}
          </span>
          <Icon name="chevron-down" size={11} className="jini-working-dir-trigger-chevron" />
        </button>
      </div>

      {open ? (
        <div
          className={`jini-working-dir-panel${placement === 'up' ? ' up' : ''}`}
          role="menu"
          data-testid="working-dir-panel"
        >
          <button
            type="button"
            role="menuitem"
            className="jini-working-dir-item"
            data-testid="working-dir-pick"
            onClick={() => {
              setOpen(false);
              onPickDirectory();
            }}
          >
            <Icon name="folder" size={14} className="jini-working-dir-item-icon" />
            <span>{workingDir ? t.replace : t.pick}</span>
          </button>

          <div
            className="jini-working-dir-submenu-row"
            onMouseEnter={() => setRecentOpen(true)}
            onMouseLeave={() => setRecentOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="jini-working-dir-item"
              aria-haspopup="menu"
              aria-expanded={recentOpen}
              data-testid="working-dir-recent"
              onClick={() => setRecentOpen((v) => !v)}
            >
              <Icon name="history" size={14} className="jini-working-dir-item-icon" />
              <span>{t.recent}</span>
              <Icon name="chevron-right" size={12} className="jini-working-dir-item-chevron" />
            </button>
            {recentOpen ? (
              <div
                className={`jini-working-dir-flyout${placement === 'up' ? ' up' : ''}`}
                role="menu"
                data-testid="working-dir-recent-list"
              >
                {recentDirs.length === 0 ? (
                  <div className="jini-working-dir-empty">{t.recentEmpty}</div>
                ) : (
                  recentDirs.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      role="menuitem"
                      className="jini-working-dir-recent-item"
                      title={dir}
                      onClick={() => {
                        onSelectRecent(dir);
                        setOpen(false);
                      }}
                    >
                      <Icon name="folder" size={13} className="jini-working-dir-item-icon" />
                      <span className="jini-working-dir-recent-name">{basename(dir)}</span>
                      <span className="jini-working-dir-recent-path">{dir}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {workingDir && onClear ? (
            <button
              type="button"
              role="menuitem"
              className="jini-working-dir-item"
              data-testid="working-dir-clear"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <Icon name="close" size={14} className="jini-working-dir-item-icon" />
              <span>{t.clear}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
