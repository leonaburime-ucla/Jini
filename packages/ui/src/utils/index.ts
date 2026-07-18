export {
  FILE_SYSTEM_READ_ERROR_MESSAGE,
  createFileSystemReadError,
  isFileSystemReadError,
} from './file-system-errors.js';

export { isImeComposing } from './ime-composing.js';

export {
  SUCCESS_SOUNDS,
  FAILURE_SOUNDS,
  DEFAULT_SUCCESS_SOUND_ID,
  DEFAULT_FAILURE_SOUND_ID,
  playSound,
  previewSuccess,
  previewFailure,
  notificationPermission,
  requestNotificationPermission,
  showCompletionNotification,
} from './notifications.js';
export type {
  SoundId,
  SoundOption,
  CompletionNotificationOpts,
  CompletionNotificationResult,
} from './notifications.js';

export { isMacPlatform } from './platform.js';

export { smoothScrollToTop } from './smooth-scroll-to-top.js';

export { randomUUID } from './uuid.js';

export {
  DEFAULT_VISUAL_STABILITY_STORAGE_KEY,
  isVisualStabilityMode,
} from './visual-stability.js';
