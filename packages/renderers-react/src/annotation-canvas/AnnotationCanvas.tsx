import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chooseToolbarPlacement } from './rules.js';
import { useAnnotationCanvasState } from './useAnnotationCanvas.js';
import type { AnnotationCanvasProps, ToolbarPlacement } from './types.js';

const defaultLabels = {
  box: 'Box',
  pen: 'Pen',
  text: 'Text',
  undo: 'Undo',
  redo: 'Redo',
  submit: 'Submit',
  clear: 'Clear',
  notePlaceholder: 'Add a note',
};

export function AnnotationCanvas({
  children,
  active = true,
  initialTool = 'box',
  labels,
  submitDisabled = false,
  submitDisabledReason,
  toolbarHost,
  onActiveChange,
  onCapture,
  onSubmit,
  onToolbarPlacementChange,
}: AnnotationCanvasProps) {
  const mergedLabels = { ...defaultLabels, ...labels };
  const state = useAnnotationCanvasState(initialTool);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<ToolbarPlacement>({ layout: 'docked', side: null, style: { left: '50%', bottom: 16, transform: 'translateX(-50%)' } });
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const frameRect = state.frameRef.current?.getBoundingClientRect();
      const toolbarRect = toolbarRef.current?.getBoundingClientRect();
      if (!frameRect || !toolbarRect) return;
      const next = chooseToolbarPlacement({
        frame: { x: frameRect.left, y: frameRect.top, width: frameRect.width, height: frameRect.height },
        toolbar: { width: toolbarRect.width || 320, height: toolbarRect.height || 120 },
        avoid: state.value.selectionBoxes.map((box) => ({
          x: frameRect.left + box.x * frameRect.width,
          y: frameRect.top + box.y * frameRect.height,
          width: box.width * frameRect.width,
          height: box.height * frameRect.height,
        })),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      setPlacement(next);
      onToolbarPlacementChange?.(next);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, onToolbarPlacementChange, state.frameRef, state.value.selectionBoxes]);

  useEffect(() => {
    if (!active) onActiveChange?.(false);
  }, [active, onActiveChange]);

  const submit = async () => {
    setPending(true);
    try {
      const request = { value: state.value, frame: state.frameSize, canvas: state.canvasRef.current };
      await onCapture?.(request);
      await onSubmit?.({ ...request, action: 'send' });
    } finally {
      setPending(false);
    }
  };

  const toolbar = (
    <div ref={toolbarRef} data-jini-annotation-toolbar="" style={{ position: 'fixed', zIndex: 20, display: active ? 'grid' : 'none', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.96)', boxShadow: '0 12px 40px rgba(15,23,42,.22)', ...placement.style }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['box', 'pen', 'text'] as const).map((tool) => <button key={tool} type="button" aria-pressed={state.tool === tool} onClick={() => state.setTool(tool)}>{mergedLabels[tool]}</button>)}
        <button type="button" onClick={state.undo} disabled={!state.canUndo}>{mergedLabels.undo}</button>
        <button type="button" onClick={state.redo} disabled={!state.canRedo}>{mergedLabels.redo}</button>
        <button type="button" onClick={state.clear} disabled={!state.hasMarks}>{mergedLabels.clear}</button>
      </div>
      <textarea aria-label={mergedLabels.notePlaceholder} placeholder={mergedLabels.notePlaceholder} value={state.note} onChange={(event) => state.setNote(event.target.value)} />
      <button type="button" onClick={submit} disabled={pending || submitDisabled || !state.hasMarks} title={submitDisabledReason}>{mergedLabels.submit}</button>
    </div>
  );

  return (
    <div ref={state.frameRef} data-jini-annotation-canvas="" style={{ position: 'relative', minHeight: 1 }}>
      {children}
      {active ? (
        <>
          <canvas ref={state.canvasRef} aria-label="Annotation drawing surface" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} onPointerDown={state.onPointerDown} onPointerMove={state.onPointerMove} onPointerUp={state.onPointerUp} />
          {state.value.textLabels.map((label) => (
            <textarea
              key={label.id}
              aria-label="Annotation text label"
              value={label.text}
              readOnly={state.editingTextId !== label.id}
              onPointerDown={(event) => state.beginTextDrag(label.id, event)}
              onDoubleClick={() => state.setEditingTextId(label.id)}
              onBlur={() => state.setEditingTextId(null)}
              onChange={(event) => state.setText(label.id, event.target.value)}
              style={{ position: 'absolute', left: `${label.x * 100}%`, top: `${label.y * 100}%`, background: 'transparent', border: state.editingTextId === label.id ? '1px solid #1677ff' : '1px solid transparent', color: '#111827', font: 'inherit', resize: 'both' }}
            />
          ))}
          {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
        </>
      ) : null}
    </div>
  );
}
