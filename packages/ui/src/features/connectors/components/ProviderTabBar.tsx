import type { ProviderTab } from '../types.js';

export interface ProviderTabBarProps {
  tabs: readonly ProviderTab[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}

/** Config-driven provider-tab bar. A single-provider host still renders one tab. */
export function ProviderTabBar({ tabs, selectedId, onSelect, ariaLabel = 'Connector provider' }: ProviderTabBarProps) {
  return (
    <div className="connectors-provider-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === selectedId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`connectors-provider-tab${active ? ' is-active' : ''}`}
            onClick={() => onSelect(tab.id)}
            data-testid={`connectors-provider-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
