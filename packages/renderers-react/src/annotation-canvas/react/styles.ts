import type { CSSProperties } from 'react';

export const wrapStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: 0,
};

export const dockBaseStyle: CSSProperties = {
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  zIndex: 91,
  pointerEvents: 'none',
};

export const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignContent: 'center',
  flexWrap: 'nowrap',
  gap: 6,
  boxSizing: 'border-box',
  width: 'max-content',
  maxWidth: '100%',
  overflow: 'visible',
  padding: 6,
  background: 'rgba(20,20,20,0.92)',
  color: '#fff',
  borderRadius: 22,
  boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(8px)',
  zIndex: 91,
  pointerEvents: 'auto',
  fontSize: 13,
};

export const toolClusterStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flex: '0 0 auto',
};

export const noteActionsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flex: '1 1 360px',
  minWidth: 0,
  maxWidth: 420,
};

export const subToolGroupStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  padding: 0,
  borderRadius: 999,
  background: 'transparent',
  border: 'none',
  flex: '0 0 auto',
};

export const subToolButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 999,
  width: 54,
  minWidth: 54,
  height: 30,
  padding: '0 8px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  flex: '0 0 54px',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const iconButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 999,
  width: 30,
  minWidth: 30,
  height: 30,
  padding: 0,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 30px',
  aspectRatio: '1 / 1',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
};

export function historyButtonStyle(enabled: boolean): CSSProperties {
  return {
    ...iconButtonStyle,
    opacity: enabled ? 1 : 0.36,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

export const closeButtonStyle: CSSProperties = {
  ...iconButtonStyle,
  borderColor: 'rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
};

export function submitActionButtonStyle(primary: boolean): CSSProperties {
  return {
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
    borderRadius: 999,
    width: 34,
    height: 34,
    padding: 0,
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
    background: primary ? 'var(--accent)' : 'transparent',
    color: primary ? '#fff' : 'inherit',
  };
}

export const submitSplitStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  flex: '0 0 auto',
};

export const dropdownMenuStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 'calc(100% + 8px)',
  minWidth: 184,
  padding: 4,
  borderRadius: 12,
  background: 'rgba(20,20,20,0.98)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.32)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  zIndex: 12,
};

export const markToolMenuStyle: CSSProperties = {
  ...dropdownMenuStyle,
  left: 0,
  right: 'auto',
  minWidth: 144,
};

export function menuItemStyle(active: boolean, enabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 9px',
    borderRadius: 8,
    border: 'none',
    background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
    color: '#fff',
    fontSize: 12.5,
    lineHeight: 1.2,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    opacity: enabled ? 1 : 0.4,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

export const menuItemIconStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  flex: '0 0 auto',
};

export const noteInputStyle: CSSProperties = {
  background: 'rgba(218, 97, 56, 0.18)',
  border: '1px solid rgba(248, 150, 104, 0.82)',
  borderRadius: 999,
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(218, 97, 56, 0.22)',
  color: 'inherit',
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 240,
  minWidth: 0,
  width: 'clamp(160px, 28vw, 320px)',
  maxWidth: '100%',
  padding: '5px 10px',
  fontSize: 13,
  transition: 'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
};

// Embedded once by the top-level orchestrator (portal-scoped tooltip +
// remove-button hover styling that inline `style` props can't express).
export const ANNOTATION_TOOLTIP_STYLE = `
  .jini-annotation-overlay-active iframe {
    pointer-events: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
  }
  .jini-annotation-icon-action,
  .jini-annotation-subtool-action {
    position: relative;
  }
  .jini-annotation-icon-action::after,
  .jini-annotation-subtool-action::after {
    content: attr(data-tooltip);
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translateX(-50%) translateY(2px);
    padding: 4px 7px;
    border-radius: 6px;
    background: rgba(20,20,20,0.94);
    color: #fff;
    font-size: 11px;
    line-height: 1.2;
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    transition: opacity 140ms cubic-bezier(0.23, 1, 0.32, 1), transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .jini-annotation-icon-action:hover::after,
  .jini-annotation-icon-action:focus-visible::after,
  .jini-annotation-subtool-action:hover::after,
  .jini-annotation-subtool-action:focus-visible::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  /* A label's remove control stays hidden until you hover the label (or
     tab to it), then fades + scales in. */
  .jini-annotation-text-remove {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 15px;
    height: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.28);
    background: rgba(28,28,30,0.5);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    color: rgba(255,255,255,0.92);
    box-shadow: 0 1px 4px rgba(0,0,0,0.28);
    cursor: pointer;
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 140ms cubic-bezier(0.23, 1, 0.32, 1), transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .jini-annotation-text-mark:hover .jini-annotation-text-remove,
  .jini-annotation-text-remove:focus-visible {
    opacity: 1;
    transform: scale(1);
  }
  .jini-annotation-text-remove:hover {
    background: rgba(42,42,46,0.62);
    color: #fff;
  }
`;
