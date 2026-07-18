// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as MentionAutocompleteFeature from '../index.js';

describe('mention-autocomplete index barrel', () => {
  it('re-exports the constants, rules, hook, and components it advertises', () => {
    const runtimeExports = [
      'ALL_CATEGORY_FILTER',
      'DEFAULT_TRIGGER_CHAR',
      'DEFAULT_MAX_RESULTS_PER_CATEGORY',
      'readMentionTrigger',
      'buildMentionToken',
      'insertMentionToken',
      'filterMentionItems',
      'groupItemsByCategory',
      'isCategoryVisible',
      'mentionSelectionKey',
      'hasAnyResults',
      'useMentionAutocomplete',
      'MentionCategoryTabs',
      'MentionResultItem',
      'MentionResultsList',
      'SelectedMentionChips',
      'MentionAutocomplete',
    ] as const;

    for (const name of runtimeExports) {
      expect(MentionAutocompleteFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
