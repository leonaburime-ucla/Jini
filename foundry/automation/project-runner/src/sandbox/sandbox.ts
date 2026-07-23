import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Creates an isolated filesystem working directory for one job attempt, so a
 * failed or partial attempt can never corrupt the live repo tree (bootstrap
 * requirement: "each job attempt runs inside an isolated working directory").
 *
 * The directory is namespaced by WorkItem id and attempt number so retries of
 * the same WorkItem never collide with (or overwrite evidence from) a prior
 * attempt.
 *
 * @param input.sandboxRoot - Root directory under which sandboxes are
 *   created. Callers must pass the gitignored `.sandbox/` path — this
 *   function does not know or assume a default, per coding-foundations rule 1
 *   (no hidden globals for filesystem roots).
 * @param input.workItemId - The WorkItem this attempt belongs to.
 * @param input.attemptNumber - 1-based attempt number for this WorkItem.
 * @returns The absolute path of the created (empty) sandbox directory.
 * @throws {Error} Propagates any `node:fs` error unchanged (e.g. permission denied).
 * @example
 * const { path } = await createSandbox({ sandboxRoot: '.sandbox', workItemId: 'm1-impl', attemptNumber: 1 });
 */
export async function createSandbox({
  sandboxRoot,
  workItemId,
  attemptNumber,
}: {
  sandboxRoot: string;
  workItemId: string;
  attemptNumber: number;
}): Promise<{ path: string }> {
  const path = join(sandboxRoot, workItemId, `attempt-${attemptNumber}`);
  await mkdir(path, { recursive: true });
  return { path };
}

/**
 * Recursively removes a sandbox directory. Not called automatically on
 * failure so a failed attempt's working directory survives for postmortem —
 * callers decide when cleanup is safe (e.g. after a `succeeded` outcome).
 *
 * @throws {Error} Propagates any `node:fs` error unchanged.
 * @example
 * await cleanupSandbox({ path: '.sandbox/m1-impl/attempt-1' });
 */
export async function cleanupSandbox({ path }: { path: string }): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
