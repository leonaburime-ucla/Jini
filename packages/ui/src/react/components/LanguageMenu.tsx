import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface LocaleOption {
  code: string;
  label: string;
}

interface Props {
  /** Supported locales and their display labels — host-supplied, not hardcoded. */
  locales: LocaleOption[];
  locale: string;
  onLocaleChange: (locale: string) => void;
  compact?: boolean;
  placement?: 'up' | 'down';
  align?: 'start' | 'end';
}

/**
 * Compact language switcher rendered as a small pill that expands into a
 * popover menu. Locale list/labels and the active locale are entirely
 * host-supplied — this component owns only the open/close and keyboard/
 * click-outside behavior. Animation is CSS-driven via the `open`/`closing`
 * classes on the popover; the host supplies the actual transition.
 */
export function LanguageMenu({
  locales,
  locale,
  onLocaleChange,
  compact = false,
  placement = 'up',
  align = 'start',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeLabel = locales.find((l) => l.code === locale)?.label ?? locale;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lang-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`foot-pill lang-pill${compact ? ' lang-pill--compact' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? activeLabel : undefined}
        onClick={() => setOpen((v) => !v)}
        title={activeLabel}
      >
        <Icon name="languages" size={compact ? 20 : 12} />
        {compact ? null : (
          <>
            <span>{activeLabel}</span>
            <Icon name="chevron-down" size={11} />
          </>
        )}
      </button>
      {open ? (
        <div
          className={`lang-menu-popover lang-menu-popover--${placement}${
            compact ? ' lang-menu-popover--compact' : ''
          } lang-menu-popover--align-${align}`}
          role="menu"
        >
          {locales.map(({ code, label }) => {
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`lang-menu-item${active ? ' active' : ''}`}
                onClick={() => {
                  onLocaleChange(code);
                  setOpen(false);
                }}
              >
                <span className="lang-menu-label">{label}</span>
                <span className="lang-menu-code">{code}</span>
                {active ? (
                  <span className="lang-menu-check" aria-hidden>
                    <Icon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
