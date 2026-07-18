import type { ReactNode } from 'react';
import type { MentionItem } from '../../types.js';

export interface MentionResultItemProps<T extends MentionItem<ReactNode>> {
  item: T;
  selected: boolean;
  onPick: () => void;
  /** Rendered instead of `item.icon` when `selected` — typically a check icon. */
  selectedIcon?: ReactNode | undefined;
}

/**
 * A single row in the mention results list: icon (or a selected-check when
 * already picked), label, and a secondary meta line. Uses `onMouseDown` +
 * `preventDefault` (not `onClick`) so picking a result never blurs the
 * source textarea first — matches the vendored picker's interaction.
 */
export function MentionResultItem<T extends MentionItem<ReactNode>>({
  item,
  selected,
  onPick,
  selectedIcon,
}: MentionResultItemProps<T>) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`jini-mention-item${selected ? ' is-selected' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onPick();
      }}
    >
      <span className="jini-mention-item__icon">{selected ? selectedIcon : item.icon}</span>
      <span className="jini-mention-item__body">
        <span className="jini-mention-item__title">{item.label}</span>
        {item.meta ? <span className="jini-mention-item__meta">{item.meta}</span> : null}
      </span>
    </button>
  );
}
