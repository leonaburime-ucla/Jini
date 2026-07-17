import { RemixIcon, useT } from '@jini/ui';
import { historyButtonStyle } from '../styles.js';

export interface HistoryButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function HistoryButtons({ canUndo, canRedo, onUndo, onRedo }: HistoryButtonsProps) {
  const t = useT();
  return (
    <>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        style={historyButtonStyle(canUndo)}
        aria-label={t('Undo')}
        title={t('Undo')}
      >
        <RemixIcon name="arrow-go-back-line" size={14} />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        style={historyButtonStyle(canRedo)}
        aria-label={t('Redo')}
        title={t('Redo')}
      >
        <RemixIcon name="arrow-go-forward-line" size={14} />
      </button>
    </>
  );
}
