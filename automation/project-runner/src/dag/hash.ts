import { createHash } from 'node:crypto';

const SECTION_START_MARKER = '## 8. First 10 extraction tasks';
const SECTION_END_MARKER = '## 9. The 2-year rot vector';

/**
 * Extracts the exact §8 text region from the full extraction-plan.md
 * contents, so hashing is scoped to the section this DAG is derived from —
 * unrelated edits elsewhere in the doc must not force a spurious drift
 * warning.
 *
 * @throws {Error} If either marker is missing, since that means the doc's
 *   structure changed enough that slicing would be unreliable — safer to
 *   fail loudly than hash the wrong region.
 */
export function extractMilestonesSection({ planText }: { planText: string }): string {
  const startIndex = planText.indexOf(SECTION_START_MARKER);
  const endIndex = planText.indexOf(SECTION_END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(
      `Could not locate the §8 milestones section between "${SECTION_START_MARKER}" and ` +
        `"${SECTION_END_MARKER}" in extraction-plan.md. The doc's structure changed — update ` +
        `src/dag/hash.ts's markers and src/dag/extraction-milestones.ts together.`,
    );
  }
  return planText.slice(startIndex, endIndex);
}

/**
 * Computes a stable hash of the §8 milestones section, used to key the
 * generated DAG and detect drift between the committed DAG and the current
 * extraction-plan.md.
 *
 * @returns A `sha256:<hex>` prefixed digest string.
 * @example
 * const hash = computeExtractionPlanHash({ planText: await readFile('docs/jini-port/extraction-plan.md', 'utf8') });
 */
export function computeExtractionPlanHash({ planText }: { planText: string }): string {
  const section = extractMilestonesSection({ planText });
  return `sha256:${createHash('sha256').update(section).digest('hex')}`;
}
