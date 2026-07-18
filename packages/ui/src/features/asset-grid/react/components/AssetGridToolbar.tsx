import type { ReactNode } from 'react';
import { useT } from '../../../i18n/index.js';
import { Icon } from '../../../../react/components/Icon.js';
import { ALL_FACET_VALUE } from '../../constants.js';
import type { AssetGridFacetOption, AssetGridViewMode } from '../../types.js';

export interface AssetGridToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string | undefined;
  kind: string;
  onKindChange: (value: string) => void;
  kindFacets: AssetGridFacetOption[];
  kindFacetsLabel?: string | undefined;
  source: string;
  onSourceChange: (value: string) => void;
  sourceFacets: AssetGridFacetOption[];
  sourceFacetsLabel?: string | undefined;
  viewMode: AssetGridViewMode;
  onViewModeChange: (mode: AssetGridViewMode) => void;
  onRefresh: () => void;
  loading: boolean;
  /** Host-specific extra toolbar controls (e.g. an Upload button), rendered after the built-in controls. */
  toolbarActions?: ReactNode;
}

export function AssetGridToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  kind,
  onKindChange,
  kindFacets,
  kindFacetsLabel,
  source,
  onSourceChange,
  sourceFacets,
  sourceFacetsLabel,
  viewMode,
  onViewModeChange,
  onRefresh,
  loading,
  toolbarActions,
}: AssetGridToolbarProps) {
  const t = useT();

  return (
    <div className="asset-grid-toolbar">
      <div className="asset-grid-search-wrap">
        <Icon name="search" size={15} className="asset-grid-search-icon" />
        <input
          className="asset-grid-search"
          type="search"
          placeholder={searchPlaceholder ?? t('Search…')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('Search')}
        />
      </div>
      {kindFacets.length > 0 ? (
        <select
          aria-label={kindFacetsLabel ?? t('Filter by kind')}
          className="asset-grid-select"
          value={kind}
          onChange={(e) => onKindChange(e.target.value)}
        >
          {kindFacets.map((f) => (
            <option key={f.value || ALL_FACET_VALUE} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      ) : null}
      {sourceFacets.length > 0 ? (
        <select
          aria-label={sourceFacetsLabel ?? t('Filter by source')}
          className="asset-grid-select"
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
        >
          {sourceFacets.map((f) => (
            <option key={f.value || ALL_FACET_VALUE} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      ) : null}
      <div className="asset-grid-view-toggle" role="group" aria-label={t('View mode')}>
        <button
          type="button"
          className="asset-grid-view-toggle-btn"
          data-active={viewMode === 'grid' ? 'true' : 'false'}
          aria-pressed={viewMode === 'grid'}
          onClick={() => onViewModeChange('grid')}
        >
          <Icon name="grid" size={14} />
          {t('Grid')}
        </button>
        <button
          type="button"
          className="asset-grid-view-toggle-btn"
          data-active={viewMode === 'timeline' ? 'true' : 'false'}
          aria-pressed={viewMode === 'timeline'}
          onClick={() => onViewModeChange('timeline')}
        >
          <Icon name="history" size={14} />
          {t('Timeline')}
        </button>
      </div>
      <button
        type="button"
        className="asset-grid-refresh-btn"
        onClick={onRefresh}
        aria-busy={loading}
        aria-label={t('Refresh')}
      >
        <Icon name="refresh" size={15} className={loading ? 'asset-grid-spin' : undefined} />
        {t('Refresh')}
      </button>
      {toolbarActions}
    </div>
  );
}
