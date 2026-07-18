// Public API of the memory slice. Consumers import ONLY from here — never
// from the slice's internal files. Barrels mark boundaries: this is the
// slice boundary, and `scripts/check-engine-boundaries.ts`-style guards fail
// any outside-in deep import that reaches past it.

// Wire + view-model types a host needs to implement the ports below.
export type {
  ConnectorMemoryAttempt,
  ConnectorMemoryAttemptStatus,
  ConnectorMemorySuggestionResponse,
  DraftEntry,
  FlashKind,
  FriendlyExtractionFailure,
  MemoryEntry,
  MemoryEntrySummary,
  MemoryExtractionEvent,
  MemoryExtractionPhase,
  MemoryExtractionProvider,
  MemoryExtractionRecord,
  MemoryExtractionSkipReason,
  MemoryExtractionsResponse,
  MemoryListResponse,
  MemorySourceTab,
  MemorySuggestion,
  MemoryTab,
  MemoryTreeListResponse,
  MemoryTreeNode,
  MemoryTreeNodeKind,
  MemoryType,
  UpdateMemoryConfigRequest,
  UpsertMemoryRequest,
} from './types.js';

// Ports + their default bindings.
export type {
  MemoryConfigPort,
  MemoryConnectorsPort,
  MemoryEntriesPort,
  MemoryExtractionsPort,
} from './ports.js';
export {
  createFakeMemoryConnectorsPort,
  fetchMemoryList,
  memoryConfigPort,
  memoryConnectorsPort,
  memoryEntriesPort,
  memoryExtractionsPort,
} from './dependencies.js';
export type { FakeMemoryConnectorsPortOptions } from './dependencies.js';

// Pure rules + constants + formatters a host may need directly.
export type { MemoryConfigFlagKey } from './rules.js';
export {
  applyMemoryConnectorStatus,
  connectorWithPendingAuthorization,
  enabledPatch,
  memoryEntryIdForConnectorSuggestion,
  singleFlagPatch,
  upsertMemoryConnector,
  visibleExtractionsFor,
} from './rules.js';
export {
  CONNECTOR_CALLBACK_MESSAGE_TYPE,
  connectorAppLabel,
  DEFAULT_CONNECTOR_PROVIDER,
  EMPTY_DRAFT,
  FIELD_LABEL_STYLE,
  MEMORY_CONNECTOR_APP_IDS,
  MEMORY_CONNECTOR_APP_LABELS,
  MEMORY_CONNECTOR_PENDING_AUTH_STORAGE_KEY,
  STARTERS,
  TYPES,
} from './constants.js';
export {
  connectorAttemptDetail,
  connectorAttemptName,
  connectorAttemptTitle,
  describeConnectorReadIssue,
  describeExtractionFailure,
  describeRecord,
  extractionCardMeta,
  extractionCardTitle,
  formatAbsoluteTime,
  formatConnectorContextBytes,
  formatDuration,
  formatRelativeTime,
  formatRelativeTimeAgo,
  memoryCountLabel,
  memoryFlashLabels,
  memorySourceTabs,
  memoryTypeLabels,
  parseProviderError,
  providerDisplayName,
} from './formatters.js';
export type { AsyncCommitGuard } from './async-commit-guard.js';
export { createAsyncCommitGuard } from './async-commit-guard.js';

// Feature-local hooks (with their controller/coordination types) a host wires.
export {
  useMemoryFlash,
  type MemoryFlashController,
} from './react/hooks/useMemoryFlash.hooks.js';
export {
  useMemoryNavigation,
  type MemoryNavigationController,
  type MemoryTopTab,
} from './react/hooks/useMemoryNavigation.hooks.js';
export {
  useMemoryConfig,
  useWiredMemoryConfig,
  type MemoryConfigController,
} from './react/hooks/useMemoryConfig.hooks.js';
export {
  useMemoryEntries,
  useWiredMemoryEntries,
  type MemoryEntriesController,
  type MemoryEntriesCoordination,
} from './react/hooks/useMemoryEntries.hooks.js';
export {
  useMemoryExtractions,
  useWiredMemoryExtractions,
  type MemoryExtractionsController,
} from './react/hooks/useMemoryExtractions.hooks.js';
export {
  useMemoryConnectors,
  useWiredMemoryConnectors,
  type MemoryConnectorsController,
  type MemoryConnectorsCoordination,
} from './react/hooks/useMemoryConnectors.hooks.js';

// Dumb components a host composes.
export { MemoryHooksPanel } from './react/components/MemoryHooksPanel.js';
export type { MemoryHookKey } from './react/components/MemoryHooksPanel.js';
export { MemoryHowPanel } from './react/components/MemoryHowPanel.js';
export { MemoryEntryCard } from './react/components/MemoryEntryCard.js';
export { MemoryExtractionCard } from './react/components/MemoryExtractionCard.js';
export { MemoryList } from './react/components/MemoryList.js';
export { MemoryAdvancedModal } from './react/components/MemoryAdvancedModal.js';
export { MemoryManualEditor } from './react/components/MemoryManualEditor.js';
export { MemoryConnectedPanel } from './react/components/MemoryConnectedPanel.js';

// UI types the orchestrator reads.
export type { MemorySectionProps } from './types.js';
