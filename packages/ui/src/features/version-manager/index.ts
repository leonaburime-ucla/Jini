export type {
  VersionSource,
  VersionRecord,
  VersionManagerFileRef,
  VersionRestoreWarning,
  VersionRestoreResult,
  PreviewCanvasSize,
} from './types.js';

export {
  SEARCH_VISIBLE_THRESHOLD,
  PROMPT_COPY_FEEDBACK_RESET_MS,
  PREVIEW_LOAD_FALLBACK_MS,
  DEFAULT_PREVIEW_CANVAS_PADDING,
} from './constants.js';

export * from './rules.js';

export type { VersionManagerPort, VersionManagerClipboardPort, VersionManagerDependencies } from './ports.js';
export {
  createFakeVersionManagerPort,
  createBrowserVersionManagerClipboard,
  createDefaultVersionManagerDependencies,
  defaultVersionManagerDependencies,
} from './dependencies.js';

export { usePreviewCanvasSize } from './react/hooks/usePreviewCanvasSize.js';
export { useVersionManager, useWiredVersionManager } from './react/hooks/useVersionManager.js';
export type {
  UseVersionManagerOptions,
  VersionManagerController,
} from './react/hooks/useVersionManager.js';

export { VersionSidebar } from './react/components/VersionSidebar.js';
export type { VersionSidebarProps } from './react/components/VersionSidebar.js';
export { VersionPromptPopover } from './react/components/VersionPromptPopover.js';
export type { VersionPromptPopoverProps } from './react/components/VersionPromptPopover.js';
export { VersionRestoreControl } from './react/components/VersionRestoreControl.js';
export type { VersionRestoreControlProps } from './react/components/VersionRestoreControl.js';
export { VersionPreviewFrame } from './react/components/VersionPreviewFrame.js';
export type { VersionPreviewFrameProps } from './react/components/VersionPreviewFrame.js';
export { VersionManagerModal } from './react/components/VersionManagerModal.js';
export type { VersionManagerModalProps } from './react/components/VersionManagerModal.js';
