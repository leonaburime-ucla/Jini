import type { ReactNode } from 'react';
import { useT } from '../../../i18n/index.js';
import { Icon } from '../../../../components/Icon.js';
import type { SettingsDialogChromeLabels, SettingsDialogTabMeta } from '../../types.js';
import { findActiveTab } from '../../rules.js';
import { useSettingsDialogShell } from '../hooks/useSettingsDialogShell.js';

/** One sidebar-nav entry + its rendered panel. Extends the pure
 *  `SettingsDialogTabMeta` shape with the render-specific fields
 *  (`icon`/`panel`) that only make sense in the React layer. */
export interface SettingsDialogTab<TId extends string = string> extends SettingsDialogTabMeta<TId> {
  icon?: ReactNode;
  panel: ReactNode;
}

export interface SettingsDialogShellProps<T extends SettingsDialogTab = SettingsDialogTab> {
  tabs: readonly T[];
  initialActiveTabId?: string;
  activeTabId?: string;
  onActiveTabIdChange?: (tabId: string) => void;
  /** Closes the dialog (backdrop click, close button, Escape). Omit to
   *  render the shell without a close affordance — e.g. embedded inline
   *  rather than as a modal overlay. */
  onClose?: () => void;
  /** Renders the tall centered hero (kicker/title/subtitle) instead of the
   *  normal per-tab header — e.g. a first-run "Welcome" variant. */
  welcome?: boolean;
  defaultSidebarCollapsed?: boolean;
  /** Shows the fullscreen toggle button and applies its expanded state as a
   *  modifier class. Defaults to `true`; a host with no use for fullscreen
   *  can turn it off. */
  fullscreenEnabled?: boolean;
  defaultFullscreen?: boolean;
  labels?: SettingsDialogChromeLabels;
  /** Extra chrome rendered in the top-right strip, alongside the fullscreen
   *  toggle and close button — e.g. a host's own autosave-status indicator.
   *  Fully host-owned; the shell renders it as-is. */
  chromeExtra?: ReactNode;
  dialogAriaLabelledBy?: string;
  className?: string;
}

/**
 * Generic tabbed-settings-dialog chrome: modal backdrop + sidebar nav +
 * active-panel switching + fullscreen/collapse/close affordances. Carries no
 * opinion about what any tab contains — a host supplies `tabs`, each with
 * its own `panel` (any `ReactNode`, including one of this package's own
 * `tabs/*` components or a fully product-specific one).
 *
 * Proof this is separable from any one tab's content: in the origin
 * `SettingsDialog.tsx`, 8 of its 17 real tabs were already separate files
 * the original component merely mounted — the shell itself never reached
 * into a tab's internals.
 */
export function SettingsDialogShell<T extends SettingsDialogTab>({
  tabs,
  initialActiveTabId,
  activeTabId: controlledActiveTabId,
  onActiveTabIdChange,
  onClose,
  welcome = false,
  defaultSidebarCollapsed = false,
  fullscreenEnabled = true,
  defaultFullscreen = false,
  labels,
  chromeExtra,
  dialogAriaLabelledBy = 'settings-dialog-title',
  className,
}: SettingsDialogShellProps<T>) {
  const t = useT();
  const shell = useSettingsDialogShell({
    tabs,
    initialActiveTabId,
    activeTabId: controlledActiveTabId,
    onActiveTabIdChange,
    onClose,
    defaultSidebarCollapsed,
    defaultFullscreen,
  });

  const activeTab = findActiveTab(tabs, shell.activeTabId);

  const kicker = labels?.kicker ?? t('Settings');
  const welcomeKicker = labels?.welcomeKicker ?? t('Welcome');
  const welcomeTitle = labels?.welcomeTitle ?? t('Get started');
  const welcomeSubtitle = labels?.welcomeSubtitle ?? t('Set up your preferences before you begin.');
  const closeLabel = labels?.closeLabel ?? t('Close');
  const fullscreenLabel = labels?.fullscreenLabel ?? t('Fullscreen');
  const exitFullscreenLabel = labels?.exitFullscreenLabel ?? t('Exit fullscreen');
  const collapseSidebarLabel = labels?.collapseSidebarLabel ?? t('Collapse settings sidebar');
  const expandSidebarLabel = labels?.expandSidebarLabel ?? t('Expand settings sidebar');
  const sidebarAriaLabel = labels?.sidebarAriaLabel ?? t('Settings sections');

  const sidebarToggleLabel = shell.sidebarCollapsed ? expandSidebarLabel : collapseSidebarLabel;
  const fullscreenToggleLabel = shell.fullscreen ? exitFullscreenLabel : fullscreenLabel;

  const dialogClassName = [
    'jini-settings-dialog',
    shell.sidebarCollapsed ? 'jini-settings-dialog-sidebar-collapsed' : '',
    shell.fullscreen ? 'jini-settings-dialog-fullscreen' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="jini-settings-dialog-backdrop"
      onClick={onClose}
      data-testid="settings-dialog-backdrop"
    >
      <div
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogAriaLabelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="jini-settings-dialog-chrome">
          {chromeExtra}
          {fullscreenEnabled ? (
            <button
              type="button"
              className="jini-settings-dialog-chrome-btn jini-settings-dialog-fullscreen-toggle"
              onClick={shell.toggleFullscreen}
              aria-label={fullscreenToggleLabel}
              aria-pressed={shell.fullscreen}
              title={fullscreenToggleLabel}
            >
              <Icon name={shell.fullscreen ? 'minimize' : 'maximize'} size={15} strokeWidth={2} />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="jini-settings-dialog-chrome-btn jini-settings-dialog-close"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <Icon name="close" size={16} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <header className="jini-settings-dialog-head" id={dialogAriaLabelledBy}>
          {welcome ? (
            <>
              <span className="jini-settings-dialog-kicker">{welcomeKicker}</span>
              <h2>{welcomeTitle}</h2>
              <p className="jini-settings-dialog-subtitle">{welcomeSubtitle}</p>
            </>
          ) : (
            <>
              <span className="jini-settings-dialog-kicker">{kicker}</span>
              <div className="jini-settings-dialog-head-line">
                <h2>{activeTab?.title ?? activeTab?.label ?? ''}</h2>
                {activeTab?.subtitle ? (
                  <p className="jini-settings-dialog-subtitle">{activeTab.subtitle}</p>
                ) : null}
              </div>
            </>
          )}
        </header>

        <div className="jini-settings-dialog-body">
          <button
            type="button"
            className="jini-settings-dialog-sidebar-toggle"
            onClick={shell.toggleSidebarCollapsed}
            aria-label={sidebarToggleLabel}
            aria-pressed={shell.sidebarCollapsed}
            aria-controls="jini-settings-dialog-sidebar"
            title={sidebarToggleLabel}
          >
            <Icon name={shell.sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={15} strokeWidth={2} />
          </button>

          <aside
            id="jini-settings-dialog-sidebar"
            className="jini-settings-dialog-sidebar"
            aria-label={sidebarAriaLabel}
            aria-hidden={shell.sidebarCollapsed ? true : undefined}
          >
            {tabs.map((tab) => {
              const active = tab.id === shell.activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`jini-settings-dialog-nav-item${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => shell.setActiveTabId(tab.id)}
                  data-testid={`settings-dialog-nav-${tab.id}`}
                >
                  {tab.icon}
                  <span>
                    <strong>{tab.label}</strong>
                    {tab.navHint ? <small>{tab.navHint}</small> : null}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="jini-settings-dialog-content" ref={shell.contentRef}>
            {activeTab?.panel}
          </div>
        </div>
      </div>
    </div>
  );
}
