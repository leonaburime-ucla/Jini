import { RemixIcon, useT } from '@jini/ui';
import { markToolMenuStyle, menuItemIconStyle, menuItemStyle, subToolButtonStyle, subToolGroupStyle } from '../styles.js';
import type { AnnotationMarkTool } from '../../types.js';

export interface MarkToolControlProps {
  tool: AnnotationMarkTool;
  onSelect: (tool: AnnotationMarkTool) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  disabled: boolean;
}

export function MarkToolControl({ tool, onSelect, menuOpen, onToggleMenu, menuRef, disabled }: MarkToolControlProps) {
  const t = useT();
  const options: { tool: AnnotationMarkTool; label: string; icon: string }[] = [
    { tool: 'box', label: t('Box select'), icon: 'checkbox-blank-line' },
    { tool: 'pen', label: t('Pen'), icon: 'pencil-line' },
    { tool: 'text', label: t('Text'), icon: 'text' },
  ];
  const current = options.find((item) => item.tool === tool) ?? options[0]!;

  return (
    <div ref={menuRef} style={subToolGroupStyle} aria-label={t('Mark tool')}>
      <button
        type="button"
        onClick={onToggleMenu}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={current.label}
        title={current.label}
        data-tooltip={current.label}
        className="jini-annotation-subtool-action"
        style={subToolButtonStyle}
      >
        <RemixIcon name={current.icon} size={14} />
        <RemixIcon name="arrow-down-s-line" size={12} style={{ opacity: 0.78 }} />
      </button>
      {menuOpen ? (
        <div role="menu" aria-label={t('Mark tool')} style={markToolMenuStyle}>
          {options.map((item) => {
            const active = tool === item.tool;
            return (
              <button
                key={item.tool}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-label={item.label}
                disabled={disabled}
                onClick={() => onSelect(item.tool)}
                style={menuItemStyle(active, !disabled)}
              >
                <span style={menuItemIconStyle}>
                  <RemixIcon name={item.icon} size={14} />
                </span>
                <span style={{ flex: '1 1 auto' }}>{item.label}</span>
                {active ? <RemixIcon name="check-line" size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
