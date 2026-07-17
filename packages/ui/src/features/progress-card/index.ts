export type { ProgressCardData, ProgressCardItem, ProgressStatus } from './types.js';

export {
  clampProgressPercent,
  defaultProgressCardDetail,
  defaultProgressCardTitle,
  progressBarAriaValueNow,
  progressBarWidthPercent,
  progressCardItemIcon,
  progressCardStatusIcon,
  progressCardStatusLabel,
} from './rules.js';

export { ProgressCard } from './components/ProgressCard.js';
export type { ProgressCardProps } from './components/ProgressCard.js';

export {
  chatActivityToProgressCard,
  dedupeToolUsesById,
  deriveFileOpsFromAgentEvents,
  designSystemGenerationJobToProgressCard,
  isTodoWriteToolName,
  latestStatusDetailFromAgentEvents,
  latestTodosFromAgentEvents,
  parseTodoWriteInput,
} from './reference-adapters.js';
export type {
  AgentEventLike,
  AgentOtherEventLike,
  AgentStatusEventLike,
  AgentToolResultEventLike,
  AgentToolUseEventLike,
  ChatActivityLike,
  ChatActivityToProgressCardOptions,
  DesignSystemGenerationJobLike,
  DesignSystemGenerationJobStatusLike,
  DesignSystemGenerationJobStepLike,
  FileOpEntryLike,
  FileOpKindLike,
  FileOpStatusLike,
  TodoItemLike,
  TodoStatusLike,
} from './reference-adapters.js';
