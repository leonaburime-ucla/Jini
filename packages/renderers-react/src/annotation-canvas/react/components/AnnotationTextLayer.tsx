import { Icon, useT } from '@jini/ui';
import { ANNOTATION_STROKE_COLOR, ANNOTATION_TEXT_FONT_FAMILY, ANNOTATION_TEXT_LINE_HEIGHT } from '../../constants.js';
import type { AnnotationMarkTool, AnnotationTextMark } from '../../types.js';
import type { AnnotationTextMarksController } from '../hooks/useAnnotationTextMarks.js';

export interface AnnotationTextLayerProps {
  controller: AnnotationTextMarksController;
  tool: AnnotationMarkTool;
  visible: boolean;
  chromeHidden: boolean;
  fontPx: number;
}

/** The free-floating text-label layer: an absolutely-positioned wrapper
 *  per label, each holding an autosizing textarea (readOnly unless it's
 *  the one being edited) plus a hover-revealed remove button. The layer
 *  itself passes pointer events through to the canvas beneath it so a
 *  press on empty space still drops a new label; only labels (and, while
 *  editing, their textarea) opt back into pointer events. */
export function AnnotationTextLayer({ controller, tool, visible, chromeHidden, fontPx }: AnnotationTextLayerProps) {
  const t = useT();
  if (!visible) return null;

  return (
    <div
      className="jini-annotation-text-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        visibility: chromeHidden ? 'hidden' : 'visible',
        zIndex: 81,
      }}
    >
      {controller.textMarks.map((mark) => (
        <TextMarkItem
          key={mark.id}
          mark={mark}
          tool={tool}
          editing={controller.editingTextId === mark.id}
          fontPx={fontPx}
          controller={controller}
          removeLabel={t('Remove annotation')}
          textToolLabel={t('Text')}
        />
      ))}
    </div>
  );
}

function TextMarkItem({
  mark,
  tool,
  editing,
  fontPx,
  controller,
  removeLabel,
  textToolLabel,
}: {
  mark: AnnotationTextMark;
  tool: AnnotationMarkTool;
  editing: boolean;
  fontPx: number;
  controller: AnnotationTextMarksController;
  removeLabel: string;
  textToolLabel: string;
}) {
  return (
    <div
      className="jini-annotation-text-mark"
      onPointerDown={(e) => controller.onTextPointerDown(e, mark)}
      onPointerMove={(e) => controller.onTextPointerMove(e, mark)}
      onPointerUp={(e) => controller.onTextPointerUp(e, mark)}
      onPointerCancel={(e) => controller.onTextPointerUp(e, mark)}
      style={{
        position: 'absolute',
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        display: 'block',
        pointerEvents: tool === 'text' ? 'auto' : 'none',
        cursor: editing ? 'default' : 'move',
        touchAction: 'none',
      }}
    >
      <textarea
        ref={(el) => controller.registerTextareaRef(mark.id, el)}
        value={mark.text}
        wrap="off"
        rows={1}
        spellCheck={false}
        readOnly={!editing}
        aria-label={textToolLabel}
        onChange={(e) => controller.updateText(mark.id, e.target.value)}
        onBlur={() => controller.onBlur(mark.id)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            controller.onTextareaEscape(mark.id);
          }
        }}
        style={{
          display: 'block',
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre',
          boxShadow: 'none',
          color: ANNOTATION_STROKE_COLOR,
          caretColor: ANNOTATION_STROKE_COLOR,
          fontFamily: ANNOTATION_TEXT_FONT_FAMILY,
          fontWeight: 600,
          fontSize: fontPx,
          lineHeight: ANNOTATION_TEXT_LINE_HEIGHT,
          minWidth: Math.max(2, Math.round(fontPx * 0.5)),
          textShadow: '0 0 3px rgba(255,255,255,0.75)',
          pointerEvents: editing ? 'auto' : 'none',
          userSelect: editing ? 'text' : 'none',
          WebkitUserSelect: editing ? 'text' : 'none',
          cursor: editing ? 'text' : 'move',
        }}
      />
      {tool === 'text' ? (
        <button
          type="button"
          className="jini-annotation-text-remove"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => controller.removeMark(mark.id)}
          aria-label={removeLabel}
          title={removeLabel}
        >
          <Icon name="close" size={8} />
        </button>
      ) : null}
    </div>
  );
}
