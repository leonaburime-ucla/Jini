// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as RevisionReviewFeature from './index.js';

describe('revision-review index barrel', () => {
  it('re-exports the rules and components it advertises', () => {
    const runtimeExports = ['diffAddedLines', 'formatRevisionTimestamp', 'RevisionDiffCard', 'RevisionHistoryList'] as const;

    for (const name of runtimeExports) {
      expect(RevisionReviewFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
