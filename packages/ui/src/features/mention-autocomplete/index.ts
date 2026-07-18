export type {
  MentionItem,
  MentionCategory,
  MentionCategoryFilter,
  MentionTriggerMatch,
  MentionInsertResult,
} from './types.js';

export { ALL_CATEGORY_FILTER, DEFAULT_TRIGGER_CHAR, DEFAULT_MAX_RESULTS_PER_CATEGORY } from './constants.js';

export {
  readMentionTrigger,
  buildMentionToken,
  insertMentionToken,
  filterMentionItems,
  groupItemsByCategory,
  isCategoryVisible,
  mentionSelectionKey,
  hasAnyResults,
} from './rules.js';
export type { MentionResultGroup } from './rules.js';

export { useMentionAutocomplete } from './react/hooks/useMentionAutocomplete.js';
export type {
  UseMentionAutocompleteParams,
  UseMentionAutocompleteResult,
} from './react/hooks/useMentionAutocomplete.js';

export { MentionCategoryTabs } from './react/components/MentionCategoryTabs.js';
export type { MentionCategoryTabsProps } from './react/components/MentionCategoryTabs.js';
export { MentionResultItem } from './react/components/MentionResultItem.js';
export type { MentionResultItemProps } from './react/components/MentionResultItem.js';
export { MentionResultsList } from './react/components/MentionResultsList.js';
export type { MentionResultsListProps } from './react/components/MentionResultsList.js';
export { SelectedMentionChips } from './react/components/SelectedMentionChips.js';
export type { SelectedMentionChipsProps } from './react/components/SelectedMentionChips.js';
export { MentionAutocomplete } from './react/components/MentionAutocomplete.js';
export type { MentionAutocompleteProps } from './react/components/MentionAutocomplete.js';
