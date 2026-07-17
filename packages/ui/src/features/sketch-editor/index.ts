export type {
  SketchDomTextOverrides,
  SketchExportImageResult,
  SketchExportedImageResult,
  SketchScene,
  SketchSceneChangeOptions,
  SketchToastState,
  SketchTooltipLabelKey,
  SketchTooltipLabels,
  SketchTooltipTarget,
  SketchTranslate,
} from './types.js';

export {
  DEFAULT_CONTEXT_MENU_ACTION_ORDER,
  DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS,
  DEFAULT_EXCALIDRAW_LANG_CODES,
  DEFAULT_SKETCH_DARK_TOOL_COLOR,
  DEFAULT_SKETCH_LIGHT_TOOL_COLOR,
  DEFAULT_SKETCH_TOOLTIP_TARGETS,
  EXPORTED_IMAGE_MIME_TYPE,
  SAVED_VISIBLE_MS,
  SKETCH_CONTEXT_MENU_MARGIN,
  SKETCH_TEXT_OVERRIDE_ATTRS,
} from './constants.js';

export * from './rules.js';

export {
  applySketchContextMenuSimplification,
  applySketchDomTextOverrides,
  applySketchEditorTooltips,
  clampSketchContextPopover,
  enhanceSketchExcalidrawPortals,
  findSketchMermaidInsertButton,
  handleSketchPortalCommandEnter,
  readDefaultSketchToolColor,
  readExcalidrawTheme,
  removeSketchMermaidShortcutHints,
  rewriteExcalidrawUnableToEmbedToasts,
  setTooltipAttribute,
} from './dom.js';

export type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  OrderedExcalidrawElement,
  SketchEditorDependencies,
  SketchEditorEnginePort,
  SketchExportToBlobOptions,
  SketchMainMenuComponent,
  SketchMainMenuItemProps,
} from './ports.js';

export { defaultSketchEditorDependencies, realSketchEditorEngine } from './dependencies.js';

export { createFakeSketchEditorDependencies, createFakeSketchEditorEngine } from './react/dependencies-fake.js';

export { useSketchTheme } from './react/hooks/useSketchTheme.js';
export { useSketchScene } from './react/hooks/useSketchScene.js';
export type { SketchSceneController, UseSketchSceneParams } from './react/hooks/useSketchScene.js';
export { useSketchSaveWorkflow } from './react/hooks/useSketchSaveWorkflow.js';
export type { SketchSaveWorkflowController, UseSketchSaveWorkflowParams } from './react/hooks/useSketchSaveWorkflow.js';
export { useSketchDomEnhancements } from './react/hooks/useSketchDomEnhancements.js';
export type { UseSketchDomEnhancementsParams } from './react/hooks/useSketchDomEnhancements.js';

export { SketchMainMenu } from './react/components/SketchMainMenu.js';
export type { SketchMainMenuProps } from './react/components/SketchMainMenu.js';
export { SketchSaveStateBadge } from './react/components/SketchSaveStateBadge.js';
export type { SketchSaveStateBadgeProps } from './react/components/SketchSaveStateBadge.js';
export { SketchEditor } from './react/components/SketchEditor.js';
export type { SketchEditorProps } from './react/components/SketchEditor.js';
