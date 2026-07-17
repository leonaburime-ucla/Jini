export const ANNOTATION_STROKE_COLOR = '#ff3b30';
export const ANNOTATION_STROKE_WIDTH = 4;
export const ANNOTATION_TARGET_COLOR = '#1677ff';

// Text-annotation glyph height as a fraction of the frame height, so a
// dropped label reads at a consistent size across differently-sized
// annotated surfaces and its on-screen size matches what gets baked into
// the exported composite.
export const ANNOTATION_TEXT_FONT_FRACTION = 0.03;
export const ANNOTATION_TEXT_LINE_HEIGHT = 1.25;
export const ANNOTATION_TEXT_MIN_FONT_PX = 12;
export const ANNOTATION_TEXT_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const ANNOTATION_DOCK_GAP = 12;
export const ANNOTATION_DOCK_MARGIN = 16;
export const ANNOTATION_DOCK_MIN_WIDTH = 320;
export const ANNOTATION_DOCK_MIN_HEIGHT = 120;

// Ignore accidental micro-drags (a click without a real drag) when
// committing a box-select region, expressed as a fraction of the frame.
export const ANNOTATION_BOX_MIN_SIZE = 0.006;

// A tap that doesn't move within this window of a prior tap on the same
// label re-opens it for editing (covers both mouse double-click and touch).
export const ANNOTATION_DOUBLE_TAP_MS = 320;

// Client-side ceiling on a submit's ack round trip before it's treated as
// failed, independent of whatever the host's own port does internally.
export const ANNOTATION_SUBMIT_TIMEOUT_MS = 60000;
