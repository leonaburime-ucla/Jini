import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Package root: `automation/project-runner/`. */
export const PACKAGE_ROOT = join(HERE, '..', '..');

/** Repo root, four levels up from `src/cli/`. */
export const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');

/** The locked architecture doc this DAG is derived from. */
export const EXTRACTION_PLAN_PATH = join(REPO_ROOT, 'docs', 'jini-port', 'extraction-plan.md');

/** Committed SQLite ledger — the executable source of truth (see README.md). */
export const LEDGER_DB_PATH = join(PACKAGE_ROOT, 'ledger', 'runner.db');

/** Committed generated view — regenerate via the `seed` script, never hand-edit. */
export const TASKS_MD_PATH = join(PACKAGE_ROOT, 'ledger', 'tasks.md');

/** Committed generated view — regenerate via the `seed` script, never hand-edit. */
export const PIPELINE_STATE_MD_PATH = join(PACKAGE_ROOT, 'ledger', 'pipeline-state.md');

/** Gitignored root for per-attempt sandbox directories. */
export const SANDBOX_ROOT = join(PACKAGE_ROOT, '.sandbox');
