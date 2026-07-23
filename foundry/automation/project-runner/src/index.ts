/**
 * @jini-automation/project-runner — the execution runtime for Jini's
 * agent-driven extraction (see README.md and
 * foundry/docs/jini-port/extraction-plan.md §12 C6). Bootstrap scope: local SQLite
 * ledger, one worker, filesystem sandbox, manual approval gate — not a
 * distributed scheduler.
 *
 * This module re-exports the programmatic API for tests and future CLI/
 * scheduler callers. This package is `private: true` and is not consumed by
 * `packages/@jini/**` (vocabulary firewall — see `src/domain/types.ts`).
 */
export * from './domain/types.js';
export * from './errors.js';
export { openLedgerDb } from './ledger/db.js';
export { ProjectRunnerLedger } from './ledger/ledger.js';
export { createSandbox, cleanupSandbox } from './sandbox/sandbox.js';
export type { JobExecutor, JobExecutionContext, JobExecutionResult } from './worker/executor.js';
export { noopJobExecutor } from './worker/executor.js';
export { runWorkerTick, drainWorkerQueue } from './worker/worker.js';
export type { WorkerTickResult } from './worker/worker.js';
export { EXTRACTION_MILESTONES } from './dag/extraction-milestones.js';
export type { ExtractionMilestone } from './dag/extraction-milestones.js';
export { buildExtractionDag, EXTRACTION_DAG_ID } from './dag/build-dag.js';
export { computeExtractionPlanHash, extractMilestonesSection } from './dag/hash.js';
export { verifyDagFreshness } from './dag/verify-freshness.js';
export { renderTasksMarkdown } from './render/render-tasks-md.js';
export { renderPipelineStateMarkdown } from './render/render-pipeline-state-md.js';
