export { AnnotationCanvas } from './react/components/AnnotationCanvas.js';
export type { AnnotationCanvasProps } from './react/components/AnnotationCanvas.js';

export type {
  AnnotationAction,
  AnnotationCaptureFrameRect,
  AnnotationDockLayout,
  AnnotationDockPlacement,
  AnnotationDockSide,
  AnnotationMarkKind,
  AnnotationMarkTool,
  AnnotationPoint,
  AnnotationRect,
  AnnotationSnapshot,
  AnnotationStroke,
  AnnotationSubmitPayload,
  AnnotationSubmitResult,
  AnnotationTarget,
  AnnotationTextMark,
  AnnotationToolbarElement,
  NormalizedRect,
} from './types.js';

export {
  ANNOTATION_BOX_MIN_SIZE,
  ANNOTATION_DOCK_GAP,
  ANNOTATION_DOCK_MARGIN,
  ANNOTATION_DOCK_MIN_HEIGHT,
  ANNOTATION_DOCK_MIN_WIDTH,
  ANNOTATION_DOUBLE_TAP_MS,
  ANNOTATION_STROKE_COLOR,
  ANNOTATION_STROKE_WIDTH,
  ANNOTATION_SUBMIT_TIMEOUT_MS,
  ANNOTATION_TARGET_COLOR,
  ANNOTATION_TEXT_FONT_FAMILY,
  ANNOTATION_TEXT_FONT_FRACTION,
  ANNOTATION_TEXT_LINE_HEIGHT,
  ANNOTATION_TEXT_MIN_FONT_PX,
} from './constants.js';

export * from './rules.js';

export type { AnnotationCanvasDependencies, AnnotationCanvasPort } from './ports.js';

export { createFakeAnnotationCanvasDependencies, createFakeAnnotationCanvasPort } from './dependencies.js';
export type { FakeAnnotationCanvasPortOptions } from './dependencies.js';

export { useAnnotationTool } from './react/hooks/useAnnotationTool.js';
export type { AnnotationToolController } from './react/hooks/useAnnotationTool.js';
export { useAnnotationDrawing } from './react/hooks/useAnnotationDrawing.js';
export type { AnnotationDrawingController, UseAnnotationDrawingParams } from './react/hooks/useAnnotationDrawing.js';
export { useAnnotationTextMarks } from './react/hooks/useAnnotationTextMarks.js';
export type { AnnotationTextMarksController, UseAnnotationTextMarksParams } from './react/hooks/useAnnotationTextMarks.js';
export { useAnnotationDockPlacement } from './react/hooks/useAnnotationDockPlacement.js';
export type {
  AnnotationDockPlacementController,
  UseAnnotationDockPlacementParams,
} from './react/hooks/useAnnotationDockPlacement.js';
export { useAnnotationSubmit } from './react/hooks/useAnnotationSubmit.js';
export type {
  AnnotationSubmitController,
  CaptureWarning,
  ImagePreview,
  UseAnnotationSubmitParams,
} from './react/hooks/useAnnotationSubmit.js';
export { useAnnotationKeyboardShortcuts } from './react/hooks/useAnnotationKeyboardShortcuts.js';
export type { UseAnnotationKeyboardShortcutsParams } from './react/hooks/useAnnotationKeyboardShortcuts.js';

export { AnnotationTextLayer } from './react/components/AnnotationTextLayer.js';
export type { AnnotationTextLayerProps } from './react/components/AnnotationTextLayer.js';
export { AnnotationToolbarDock } from './react/components/AnnotationToolbarDock.js';
export type { AnnotationToolbarDockProps } from './react/components/AnnotationToolbarDock.js';
export { MarkToolControl } from './react/components/MarkToolControl.js';
export type { MarkToolControlProps } from './react/components/MarkToolControl.js';
export { HistoryButtons } from './react/components/HistoryButtons.js';
export type { HistoryButtonsProps } from './react/components/HistoryButtons.js';
export { AttachImageButton } from './react/components/AttachImageButton.js';
export type { AttachImageButtonProps } from './react/components/AttachImageButton.js';
export { NoteInput } from './react/components/NoteInput.js';
export type { NoteInputProps } from './react/components/NoteInput.js';
export { SubmitControl } from './react/components/SubmitControl.js';
export type { SubmitControlProps } from './react/components/SubmitControl.js';
export { ImageAttachmentStrip } from './react/components/ImageAttachmentStrip.js';
export type { ImageAttachmentStripProps } from './react/components/ImageAttachmentStrip.js';
export { ImagePreviewModal } from './react/components/ImagePreviewModal.js';
export type { ImagePreviewModalProps } from './react/components/ImagePreviewModal.js';
export { CaptureWarningBanner } from './react/components/CaptureWarningBanner.js';
export type { CaptureWarningBannerProps } from './react/components/CaptureWarningBanner.js';
