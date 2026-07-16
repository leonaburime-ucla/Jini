import type { ProjectRunnerLedger } from '../ledger/ledger.js';
import { PlanHashDriftError } from '../errors.js';

/**
 * Asserts that a DAG already recorded in the ledger still matches the plan
 * hash it was derived from. Callers that need a hard stop on drift (e.g. a CI
 * check before trusting the ledger) should use this instead of re-deriving
 * silently.
 *
 * @throws {PlanHashDriftError} If the DAG is known to the ledger and its
 *   recorded plan hash differs from `currentPlanHash`.
 * @remarks Does nothing if `dagId` has never been recorded — an unknown DAG
 *   is not drift, it is simply not yet seeded.
 */
export function verifyDagFreshness({
  ledger,
  dagId,
  currentPlanHash,
}: {
  ledger: ProjectRunnerLedger;
  dagId: string;
  currentPlanHash: string;
}): void {
  const recordedHash = ledger.getDagPlanHash({ dagId });
  if (recordedHash !== null && recordedHash !== currentPlanHash) {
    throw new PlanHashDriftError(recordedHash, currentPlanHash);
  }
}
