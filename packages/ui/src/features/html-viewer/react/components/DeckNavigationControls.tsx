import { useT } from '../../../i18n/index.js';

export interface DeckNavigationControlsProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  /** `"N / total"`, or `null` while there is no deck state yet (nothing renders). */
  counterLabel: string | null;
  onPrev(): void;
  onNext(): void;
}

/** Prev/next slide buttons + a live counter. Renders nothing until the sandboxed deck reports its first state. */
export function DeckNavigationControls({
  canGoPrev,
  canGoNext,
  counterLabel,
  onPrev,
  onNext,
}: DeckNavigationControlsProps) {
  const t = useT();
  if (counterLabel === null) return null;
  return (
    <div className="jini-deck-nav" role="group" aria-label={t('Slide navigation')}>
      <button
        type="button"
        className="jini-deck-nav-prev"
        aria-label={t('Previous slide')}
        disabled={!canGoPrev}
        onClick={onPrev}
      >
        {'<'}
      </button>
      <span className="jini-deck-nav-counter" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {counterLabel}
      </span>
      <button
        type="button"
        className="jini-deck-nav-next"
        aria-label={t('Next slide')}
        disabled={!canGoNext}
        onClick={onNext}
      >
        {'>'}
      </button>
    </div>
  );
}
