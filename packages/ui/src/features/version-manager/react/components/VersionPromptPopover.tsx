import { useId, useRef, useState } from 'react';
import { useDismissOnOutsideOrEscape } from '../../../../browser/index.js';
import { useT } from '../../../i18n/index.js';

export interface VersionPromptPopoverProps {
  /** The generating prompt for the selected version, already trimmed.
   *  Empty string when the selected version has none. */
  prompt: string;
  /** Disable the toggle entirely (no version selected). */
  disabled: boolean;
  /** True for a short window after a successful copy. Owned by the parent
   *  (a `useCopyToClipboard` hook, e.g. `features/viewer-shell/`'s) rather
   *  than by this component — this component stays props-in/JSX-out for
   *  its business logic, only the open/close disclosure state is local. */
  copied: boolean;
  onCopy: (text: string) => void;
}

/** Disclosure showing the AI-generation prompt behind the selected version,
 *  with a copy button. Open/close is small local UI state (acceptable per
 *  this package's hook-ownership discipline); copy-to-clipboard itself is
 *  injected, not reimplemented here. */
export function VersionPromptPopover({ prompt, disabled, copied, onCopy }: VersionPromptPopoverProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  useDismissOnOutsideOrEscape(() => setOpen(false), { enabled: open, containerRef: wrapRef });

  return (
    <div className="jini-version-prompt-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`jini-version-prompt-toggle${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {t('Prompt')}
      </button>
      {open ? (
        <section className="jini-version-prompt-popover" id={popoverId} role="region" aria-label={t('Prompt')}>
          <div className="jini-version-prompt-head">
            <h3>{t('Prompt')}</h3>
            <button type="button" className="jini-viewer-action" disabled={!prompt} onClick={() => onCopy(prompt)}>
              {copied ? t('Copied') : t('Copy')}
            </button>
          </div>
          <p>{prompt || t('This version has no recorded prompt.')}</p>
        </section>
      ) : null}
    </div>
  );
}
