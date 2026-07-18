import { Icon } from '../../../../react/components/Icon.js';

export interface SketchSaveStateBadgeProps {
  state: 'saving' | 'dirty' | 'saved';
  label: string;
}

/** The small save-state indicator rendered in Excalidraw's own top-right UI slot. */
export function SketchSaveStateBadge({ state, label }: SketchSaveStateBadgeProps) {
  return (
    <div className="sketch-excalidraw-actions" data-testid="sketch-save-state">
      <span className={`sketch-save-state is-${state}`} role="status" aria-live="polite">
        <Icon
          name={state === 'saving' ? 'spinner' : state === 'dirty' ? 'alert-triangle' : 'check'}
          size={12}
          className={state === 'saving' ? 'icon-spin' : undefined}
        />
        <span>{label}</span>
      </span>
    </div>
  );
}
