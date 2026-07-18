import type { ReactNode, RefObject } from 'react';
import { StatusPill } from './StatusPill.js';
import type { ResourceBoardItem, ResourceStatusToneMap } from '../../types.js';

export interface ResourceCardProps<TBody = unknown> {
  item: ResourceBoardItem<TBody>;
  selectMode: boolean;
  selected: boolean;
  menuOpen: boolean;
  busy: boolean;
  /** Pre-translated status label (`undefined` when the item has no status) — the card itself never calls `t()`. */
  statusLabel?: string;
  toneMap?: ResourceStatusToneMap;
  /** Pre-translated kebab-menu labels (keyed by `ResourceMenuActionSpec.kind`) — same i18n-at-the-boundary rule. */
  menuActionLabel?: (kind: string, fallback: string) => string;
  moreLabel: string;
  /** Attach only when `menuOpen` is true — lets the owning hook's outside-click effect tell a click inside the open menu apart from a genuine outside click (see `useResourceBoard`'s `menuContainerRef`). */
  menuContainerRef?: RefObject<HTMLDivElement | null>;
  /** Host-supplied render slot for anything beyond title/subtitle/status (DesignsTab's cover-thumbnail resolution stays entirely host-owned). */
  renderBody?: (item: ResourceBoardItem<TBody>) => ReactNode;
  onOpen: () => void;
  onToggleSelected: () => void;
  onToggleMenu: () => void;
  onAction: (kind: string) => void;
}

/**
 * One dashboard card: DesignsTab's `design-card` grid item — clickable to
 * open (or, in select-mode, to toggle selection), a select-mode checkbox OR
 * a kebab menu (never both), a status badge, and a host-supplied body slot.
 * Kanban-column cards reuse this same component (DesignsTab's own
 * `design-kanban-card` is a slimmer variant of the same card, so this
 * primitive renders one shape for both rather than two near-duplicates).
 */
export function ResourceCard<TBody = unknown>({
  item,
  selectMode,
  selected,
  menuOpen,
  busy,
  statusLabel,
  toneMap,
  menuActionLabel,
  moreLabel,
  menuContainerRef,
  renderBody,
  onOpen,
  onToggleSelected,
  onToggleMenu,
  onAction,
}: ResourceCardProps<TBody>) {
  const handleActivate = () => {
    if (selectMode) onToggleSelected();
    else onOpen();
  };
  const hasMenu = !selectMode && item.menuActions && item.menuActions.length > 0;

  return (
    <div
      className={`resource-board-card${selected ? ' is-selected' : ''}${selectMode ? ' select-mode' : ''}`}
      role="button"
      tabIndex={0}
      data-testid="resource-board-card"
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      {selectMode ? (
        <span className={`resource-board-card-checkbox${selected ? ' checked' : ''}`} aria-hidden data-testid="resource-board-card-checkbox" />
      ) : hasMenu ? (
        <div className="resource-board-card-menu-anchor" ref={menuOpen ? menuContainerRef : undefined}>
          <button
            type="button"
            className="resource-board-card-more"
            aria-label={moreLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu();
            }}
            // `stopPropagation` on `onClick` above only stops the CLICK the
            // browser synthesizes from an Enter/Space keydown — the raw
            // keydown event itself still bubbles to the outer card's own
            // `onKeyDown` (a separate event), which would otherwise ALSO
            // treat that same keypress as "activate the card" and open/
            // toggle-select it at the same time this button's own action
            // runs. Stop it here too.
            onKeyDown={(event) => event.stopPropagation()}
          >
            {moreLabel}
          </button>
          {menuOpen ? (
            <div
              className="resource-board-card-menu"
              role="menu"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {item.menuActions!.map((action) => (
                <button
                  key={action.kind}
                  type="button"
                  role="menuitem"
                  className={action.danger ? 'danger' : undefined}
                  disabled={busy}
                  onClick={() => onAction(action.kind)}
                >
                  {menuActionLabel ? menuActionLabel(action.kind, action.label) : action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="resource-board-card-body">{renderBody ? renderBody(item) : null}</div>

      <div className="resource-board-card-meta">
        <div className="resource-board-card-title" title={item.title}>
          {item.title}
        </div>
        {item.subtitle ? <div className="resource-board-card-subtitle">{item.subtitle}</div> : null}
        {item.status && statusLabel ? <StatusPill status={item.status} label={statusLabel} {...(toneMap ? { toneMap } : {})} /> : null}
      </div>
    </div>
  );
}
