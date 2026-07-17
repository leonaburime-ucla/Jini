import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ANNOTATION_TEXT_FONT_FRACTION, ANNOTATION_TEXT_MIN_FONT_PX } from '../../constants.js';
import { createFakeAnnotationCanvasDependencies } from '../../dependencies.js';
import type { AnnotationCanvasDependencies } from '../../ports.js';
import type { AnnotationAction, AnnotationTarget, AnnotationToolbarElement } from '../../types.js';
import { useAnnotationDockPlacement } from '../hooks/useAnnotationDockPlacement.js';
import { useAnnotationDrawing } from '../hooks/useAnnotationDrawing.js';
import { useAnnotationKeyboardShortcuts } from '../hooks/useAnnotationKeyboardShortcuts.js';
import { useAnnotationSubmit } from '../hooks/useAnnotationSubmit.js';
import { useAnnotationTextMarks } from '../hooks/useAnnotationTextMarks.js';
import { useAnnotationTool } from '../hooks/useAnnotationTool.js';
import { ANNOTATION_TOOLTIP_STYLE, wrapStyle } from '../styles.js';
import { AnnotationTextLayer } from './AnnotationTextLayer.js';
import { AnnotationToolbarDock } from './AnnotationToolbarDock.js';

export interface AnnotationCanvasProps {
  children: ReactNode;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
  /** A host-supplied highlighted target region (e.g. a clicked element)
   *  that anchors the mark independent of anything drawn. */
  target?: AnnotationTarget | null;
  /** Forces the capture pipeline to run even with no ink/box/text/target —
   *  useful for a host that always wants a screenshot with the note. */
  captureViewport?: boolean;
  /** Hides every visible chrome element (canvas ink, text layer, toolbar)
   *  without deactivating — used by a host mid-capture, or to render this
   *  overlay in a display-only mode. */
  hideChrome?: boolean;
  sendDisabled?: boolean;
  sendDisabledReason?: string;
  onToolbarClick?: (element: AnnotationToolbarElement, submitAction?: AnnotationAction) => void;
  /** An explicit portal host for the floating toolbar. */
  toolbarHost?: HTMLElement | null;
  /** A CSS selector resolved via `closest()` from the wrap element when no
   *  explicit `toolbarHost` is given — lets a host anchor the toolbar to
   *  whatever scroll/clip ancestor it uses, without this package needing
   *  to know that ancestor's class name. */
  toolbarHostSelector?: string;
  dependencies?: AnnotationCanvasDependencies;
}

function maybePortal(node: ReactNode, host: HTMLElement | null) {
  return host ? createPortal(node, host) : node;
}

/**
 * A generic annotation-canvas overlay: freehand pen drawing, box-select,
 * draggable text labels, undo/redo, and a floating toolbar with a
 * send/add-to-input/queue submit picker — rendered over `children`. The
 * actual snapshot/submit mechanism is entirely behind `dependencies`; see
 * `packages/renderers-react/source-map.md` for what a host is expected to
 * bind there.
 */
export function AnnotationCanvas({
  children,
  active = false,
  onActiveChange,
  target = null,
  captureViewport = false,
  hideChrome = false,
  sendDisabled = false,
  sendDisabledReason,
  onToolbarClick,
  toolbarHost,
  toolbarHostSelector,
  dependencies,
}: AnnotationCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [capturing, setCapturing] = useState(false);
  const deps = dependencies ?? defaultDependencies;

  // Owned here (not inside useAnnotationSubmit) because useAnnotationDrawing
  // — constructed first, since useAnnotationSubmit needs its outputs — also
  // needs `sending` to gate pointer handlers and undo/redo.
  const [pendingAction, setPendingAction] = useState<AnnotationAction | null>(null);
  const sending = pendingAction !== null;

  const tool = useAnnotationTool(onToolbarClick);
  const drawing = useAnnotationDrawing({
    wrapRef,
    active,
    tool: tool.tool,
    sending,
    onToolbarClick,
  });
  const textMarks = useAnnotationTextMarks({ canvasRef: drawing.canvasRef, frameSize: drawing.frameSize });

  const clearAll = () => {
    drawing.clear();
    textMarks.clear();
  };

  const submit = useAnnotationSubmit({
    wrapRef,
    port: deps.data,
    target,
    captureViewport,
    sendDisabled,
    hasInk: drawing.hasInk,
    hasBox: drawing.hasBox,
    hasText: textMarks.hasText,
    getSelectionBoxes: drawing.getSelectionBoxes,
    getStrokes: drawing.getStrokes,
    getTextMarks: () => textMarks.textMarks,
    boxBoundsRect: drawing.boxBoundsRect,
    strokeBoundsRect: drawing.strokeBoundsRect,
    textBoundsRect: textMarks.boundsRect,
    onCapturingChange: setCapturing,
    onSentSuccessfully: clearAll,
    onToolbarClick,
    pendingAction,
    setPendingAction,
  });

  useAnnotationKeyboardShortcuts({
    active,
    onDeactivate: onActiveChange,
    onUndo: drawing.undo,
    onRedo: drawing.redo,
  });

  // Reset transient state when the overlay deactivates (deliberately
  // narrower than a full reset — see `resetOnDeactivate`'s doc comment:
  // the original doesn't clear the note or a capture warning either).
  useEffect(() => {
    if (active) return;
    drawing.clear();
    textMarks.clear();
    submit.resetOnDeactivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const anchor = drawing.lastBoxRect() ?? drawing.lastStrokeRect() ?? target?.position ?? null;
  const { dockRef, placement, resolvedToolbarHost } = useAnnotationDockPlacement({
    active,
    wrapRef,
    toolbarHost,
    toolbarHostSelector,
    anchor,
    // `drawing.layoutRevision` bumps on every box/stroke mutation even
    // when it doesn't flip a boolean flag (e.g. committing a 2nd box
    // while `hasBox` was already `true`) — its `setState` call is what
    // actually forces the re-render that recomputes `anchor` above.
    // Listed explicitly here too (rather than relying only on `anchor`
    // being a fresh object reference every render) so this stays correct
    // even if `anchor` is memoized later.
    extraDeps: [target, drawing.layoutRevision, submit.imagePreviews.length, submit.captureWarning?.message],
  });

  const textFontPx = Math.max(ANNOTATION_TEXT_MIN_FONT_PX, ANNOTATION_TEXT_FONT_FRACTION * drawing.frameSize.h);
  const chromeHidden = capturing || hideChrome;

  return (
    <div ref={wrapRef} className={`jini-annotation-overlay${active ? ' jini-annotation-overlay-active' : ''}`} style={wrapStyle}>
      {children}
      <canvas
        ref={drawing.canvasRef}
        onPointerDown={(e) => {
          if (tool.tool !== 'text') {
            drawing.onPointerDown(e);
            return;
          }
          if (!active) return;
          e.preventDefault();
          if (sending) return;
          textMarks.addLabelAt(drawing.pointFromClientXY(e.clientX, e.clientY));
        }}
        onPointerMove={drawing.onPointerMove}
        onPointerUp={drawing.onPointerUp}
        onPointerCancel={drawing.onPointerUp}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: active ? 'auto' : 'none',
          cursor: active ? (tool.tool === 'text' ? 'text' : 'crosshair') : 'default',
          visibility: chromeHidden ? 'hidden' : 'visible',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          zIndex: 80,
        }}
      />
      <AnnotationTextLayer
        controller={textMarks}
        tool={tool.tool}
        visible={active || textMarks.hasText}
        chromeHidden={chromeHidden}
        fontPx={textFontPx}
      />
      {active
        ? maybePortal(
            <>
              <style>{ANNOTATION_TOOLTIP_STYLE}</style>
              <AnnotationToolbarDock
                dockRef={dockRef}
                placement={placement}
                tool={tool}
                drawing={drawing}
                submit={submit}
                sending={sending}
                chromeHidden={chromeHidden}
                sendDisabled={sendDisabled}
                sendDisabledReason={sendDisabledReason}
                onExit={() => {
                  onToolbarClick?.('exit');
                  onActiveChange?.(false);
                }}
              />
            </>,
            resolvedToolbarHost,
          )
        : null}
    </div>
  );
}

const defaultDependencies = createFakeAnnotationCanvasDependencies();
