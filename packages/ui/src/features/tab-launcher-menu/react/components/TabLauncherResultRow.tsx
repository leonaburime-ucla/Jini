import type { ReactNode } from 'react';
import type { TabLauncherResultItem } from '../../types.js';

export interface TabLauncherResultRowProps {
  item: TabLauncherResultItem;
  selectableIndex: number;
  selected: boolean;
  openLabel: string;
  onHover: (index: number) => void;
  onSelect: (item: TabLauncherResultItem) => void;
  /** Renders `item.iconName` however the host's icon set works. Omit for no icon. */
  renderIcon?: ((iconName: string | undefined) => ReactNode) | undefined;
}

export function TabLauncherResultRow({
  item,
  selectableIndex,
  selected,
  openLabel,
  onHover,
  onSelect,
  renderIcon,
}: TabLauncherResultRowProps) {
  return (
    <li>
      <button
        type="button"
        className={`jini-tab-launcher-menu__row${selected ? ' jini-tab-launcher-menu__row--selected' : ''}`}
        onMouseEnter={() => onHover(selectableIndex)}
        onClick={() => onSelect(item)}
        data-selectable-idx={selectableIndex}
      >
        {renderIcon ? <span className="jini-tab-launcher-menu__row-icon" aria-hidden="true">{renderIcon(item.iconName)}</span> : null}
        <span className="jini-tab-launcher-menu__row-body">
          <span className="jini-tab-launcher-menu__row-name">{item.name}</span>
          {item.meta ? <span className="jini-tab-launcher-menu__row-meta">{item.meta}</span> : null}
        </span>
        {item.isOpen ? <span className="jini-tab-launcher-menu__row-open">{openLabel}</span> : null}
      </button>
    </li>
  );
}
