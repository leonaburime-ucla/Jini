import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { computeExtractionPlanHash, extractMilestonesSection } from '../../dag/hash.js';
import { EXTRACTION_PLAN_PATH } from '../../cli/paths.js';

const FIXTURE_PLAN = `
# Extraction Plan

## 8. First 10 extraction tasks

1. Do the thing.

## 9. The 2-year rot vector + guardrail

Not part of the section.
`;

describe('extractMilestonesSection', () => {
  it('slices exactly the text between the §8 and §9 markers', () => {
    const section = extractMilestonesSection({ planText: FIXTURE_PLAN });
    expect(section).toContain('## 8. First 10 extraction tasks');
    expect(section).toContain('Do the thing.');
    expect(section).not.toContain('Not part of the section.');
  });

  it('throws if the §8 marker is missing (fail loud on structural drift)', () => {
    expect(() => extractMilestonesSection({ planText: 'no markers here' })).toThrow(
      /Could not locate the §8 milestones section/,
    );
  });
});

describe('computeExtractionPlanHash', () => {
  it('is deterministic for identical input', () => {
    const first = computeExtractionPlanHash({ planText: FIXTURE_PLAN });
    const second = computeExtractionPlanHash({ planText: FIXTURE_PLAN });
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('changes when the §8 section text changes (drift is detectable)', () => {
    const changed = FIXTURE_PLAN.replace('Do the thing.', 'Do a different thing.');
    expect(computeExtractionPlanHash({ planText: FIXTURE_PLAN })).not.toBe(
      computeExtractionPlanHash({ planText: changed }),
    );
  });

  it('is unaffected by edits outside the §8 section', () => {
    const changedElsewhere = FIXTURE_PLAN.replace('Not part of the section.', 'Something else entirely.');
    expect(computeExtractionPlanHash({ planText: FIXTURE_PLAN })).toBe(
      computeExtractionPlanHash({ planText: changedElsewhere }),
    );
  });

  it('successfully hashes the real extraction-plan.md (markers still match the live doc)', async () => {
    const planText = await readFile(EXTRACTION_PLAN_PATH, 'utf8');
    expect(() => computeExtractionPlanHash({ planText })).not.toThrow();
  });
});
