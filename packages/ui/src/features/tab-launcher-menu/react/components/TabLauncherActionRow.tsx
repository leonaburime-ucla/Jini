import type { ReactNode } from 'react';
import type { TabLauncherAction } from '../../types.js';

export interface TabLauncherActionRowProps<TActionCtx> {
  action: TabLauncherAction<TActionCtx>;
  onSelect: (action: TabLauncherAction<TActionCtx>) => void;
  renderIcon?: ((iconName: string | undefined) => ReactNode) | undefined;
}

export function TabLauncherActionRow<TActionCtx>({ action, onSelect, renderIcon }: TabLauncherActionRowProps<TActionCtx>) {
  return (
    <li>
      <button type="button" className="jini-tab-launcher-menu__row" onClick={() => onSelect(action)}>
        {renderIcon ? <span className="jini-tab-launcher-menu__row-icon" aria-hidden="true">{renderIcon(action.iconName)}</span> : null}
        <span className="jini-tab-launcher-menu__row-body">
          <span className="jini-tab-launcher-menu__row-name">{action.label}</span>
          {action.description ? <span className="jini-tab-launcher-menu__row-meta">{action.description}</span> : null}
        </span>
      </button>
    </li>
  );
}
