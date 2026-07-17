import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon } from '../../../components/Icon.js';

export interface ConnectorSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  clearAriaLabel?: string;
}

export function ConnectorSearchBar({
  value,
  onChange,
  disabled = false,
  onFocus,
  placeholder = 'Search connectors',
  ariaLabel = 'Search connectors',
  clearAriaLabel = 'Clear search',
}: ConnectorSearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasQuery = value.trim().length > 0;

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && value) {
      event.preventDefault();
      event.stopPropagation();
      onChange('');
    }
  }

  return (
    <div className="toolbar-search connectors-search">
      <span className="search-icon" aria-hidden>
        <Icon name="search" size={13} />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid="connectors-search-input"
      />
      {hasQuery ? (
        <button
          type="button"
          className="toolbar-search-clear"
          aria-label={clearAriaLabel}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          data-testid="connectors-search-clear"
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </div>
  );
}
