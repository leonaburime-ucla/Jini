/**
 * Generic annotation-canvas domain types — a tldraw/Excalidraw-style
 * freehand/box/text markup layer meant to sit over arbitrary preview
 * content. See `packages/renderers-react/source-map.md` for full
 * provenance and what was deliberately left out of scope.
 */

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  points: AnnotationPoint[];
}

/** A rect normalized to the 0..1 range of the annotated surface. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rect in on-screen pixels (canvas-local coordinates). */
export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A free-floating text label. `x`/`y` are the top-left position normalized
 * to the frame (0..1) so it tracks the annotated surface as it scales;
 * `text` is the raw multi-line string.
 */
export interface AnnotationTextMark {
  id: number;
  x: number;
  y: number;
  text: string;
}

export type AnnotationMarkTool = 'box' | 'pen' | 'text';

export type AnnotationDockLayout = 'floating' | 'docked';
export type AnnotationDockSide = 'right' | 'left' | 'bottom' | 'top';

export interface AnnotationDockPlacement {
  layout: AnnotationDockLayout;
  side: AnnotationDockSide | null;
  style: {
    position?: 'absolute';
    left?: string;
    top?: string;
    bottom?: string;
    transform?: string;
    maxWidth?: string;
  };
}

/**
 * The submit action a user picks: 'send' immediately submits, 'draft'
 * stages the note/mark into the host's input for further editing, 'queue'
 * stages it for the host's next turn. Generic UX, not tied to any product
 * vocabulary — see source-map.md for why this ships as a real picker, not
 * just a type.
 */
export type AnnotationAction = 'draft' | 'queue' | 'send';

/** Which kind of mark the user produced, derived from what's on the canvas
 *  plus whether a host-supplied target is present. */
export type AnnotationMarkKind = 'click' | 'stroke' | 'click+stroke';

/** Toolbar elements a host may want to observe for analytics — purely an
 *  optional notification channel, no host is required to use it. */
export type AnnotationToolbarElement =
  | 'rect'
  | 'pen'
  | 'text'
  | 'undo'
  | 'redo'
  | 'attach_image'
  | 'annotation_submit'
  | 'exit';

/**
 * An optional highlighted target region (e.g. an element the user clicked
 * in the host's own UI) that anchors the mark, independent of anything the
 * user draws. `contextId` is an opaque host identifier (a file path, node
 * id, whatever the host's own domain needs) — this package never
 * interprets it.
 */
export interface AnnotationTarget {
  contextId?: string;
  elementId?: string;
  selector?: string;
  label?: string;
  text?: string;
  position: AnnotationRect;
  htmlHint?: string;
}

export interface AnnotationSnapshot {
  dataUrl: string;
  w: number;
  h: number;
}

export type AnnotationCaptureFrameRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export interface AnnotationSubmitPayload {
  file: File | null;
  note: string;
  action: AnnotationAction;
  markKind?: AnnotationMarkKind | undefined;
  bounds?: AnnotationRect | undefined;
  target?: AnnotationTarget | null;
  /** Images the user attached (picker/paste) to accompany the mark. */
  extraFiles?: File[] | undefined;
}

export interface AnnotationSubmitResult {
  ok: boolean;
  message?: string;
}
