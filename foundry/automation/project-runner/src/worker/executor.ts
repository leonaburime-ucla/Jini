import type { JobAttempt, WorkItem } from '../domain/types.js';

/** Everything a JobExecutor needs to actually perform one attempt. */
export interface JobExecutionContext {
  workItem: WorkItem;
  attempt: JobAttempt;
  /** Isolated working directory this attempt must confine its side effects to. */
  sandboxPath: string;
}

/** Outcome a JobExecutor reports back to the worker loop. */
export interface JobExecutionResult {
  outcome: 'succeeded' | 'failed';
  summary: string;
  error?: string;
}

/**
 * Pluggable seam for actually doing the work behind a WorkItem. The worker
 * loop (`src/worker/worker.ts`) is agnostic to what an executor does — it
 * only needs a settled {@link JobExecutionResult}.
 *
 * SEAM FOR FUTURE WORK (explicitly not wired in this bootstrap): a real
 * extraction-task executor spawns a coding-agent CLI by consuming
 * `@jini/agent-runtime` **only as a pinned, published leaf subprocess/stream
 * library** — see foundry/docs/jini-port/extraction-plan.md §12 C5/C6 and root
 * AGENTS.md's vocabulary firewall. It must never import
 * `RunLifecycle`/`ToolRegistry`/event schemas from `@jini/core` or
 * `@jini/daemon`. `@jini/agent-runtime` is itself still a stub package today
 * (`packages/agent-runtime/src/index.ts` is a placeholder), so wiring a real
 * subprocess integration against it now would fake an integration that does
 * not exist yet. The next task that drives real extraction work should add a
 * new `JobExecutor` implementation here once `@jini/agent-runtime` ships a
 * real subprocess/stream API — this interface is the seam it plugs into.
 */
export type JobExecutor = (context: JobExecutionContext) => Promise<JobExecutionResult>;

/**
 * Bootstrap-only executor: proves the lease → sandbox → attempt → state
 * transition loop end-to-end without doing any real extraction work. Always
 * succeeds. Never use this once real executors exist.
 */
export const noopJobExecutor: JobExecutor = async (context) => ({
  outcome: 'succeeded',
  summary: `noop executor: acknowledged "${context.workItem.title}" in sandbox ${context.sandboxPath}`,
});
