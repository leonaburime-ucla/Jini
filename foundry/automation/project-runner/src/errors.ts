/**
 * Typed error contracts for project-runner. Per the testable-design-patterns
 * skill's Test Seam Rules, module boundaries must throw typed errors — never
 * raw `Error` or opaque strings — so callers (CLI scripts, the worker loop,
 * tests) can branch on `instanceof` instead of parsing messages.
 */

/** Thrown when a lookup targets a WorkItem id that does not exist in the ledger. */
export class WorkItemNotFoundError extends Error {
  constructor(public readonly workItemId: string) {
    super(`No WorkItem with id "${workItemId}" exists in the ledger.`);
    this.name = 'WorkItemNotFoundError';
  }
}

/**
 * Thrown when a requested state transition is not legal from the WorkItem's
 * current state (e.g. approving a WorkItem that is not `waiting_for_human`,
 * or completing an attempt for a WorkItem that is not `running`).
 */
export class InvalidWorkItemTransitionError extends Error {
  constructor(
    public readonly workItemId: string,
    public readonly fromState: string,
    public readonly attemptedAction: string,
  ) {
    super(
      `Cannot ${attemptedAction} WorkItem "${workItemId}" while it is in state "${fromState}".`,
    );
    this.name = 'InvalidWorkItemTransitionError';
  }
}

/** Thrown when a lease-scoped operation targets a lease that is not the current holder. */
export class LeaseNotHeldError extends Error {
  constructor(
    public readonly workItemId: string,
    public readonly leaseId: string,
  ) {
    super(`Lease "${leaseId}" is not the active lease for WorkItem "${workItemId}".`);
    this.name = 'LeaseNotHeldError';
  }
}

/** Thrown when the committed extraction DAG's recorded plan hash no longer matches the source doc. */
export class PlanHashDriftError extends Error {
  constructor(
    public readonly expectedHash: string,
    public readonly actualHash: string,
  ) {
    super(
      `foundry/docs/jini-port/extraction-plan.md §8 has drifted: DAG was seeded from ` +
        `${expectedHash} but the source doc now hashes to ${actualHash}. ` +
        `Re-derive the DAG (see src/dag/build-dag.ts) before trusting the ledger.`,
    );
    this.name = 'PlanHashDriftError';
  }
}
