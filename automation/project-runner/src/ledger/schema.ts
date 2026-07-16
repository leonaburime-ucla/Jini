/**
 * SQLite DDL for the project-runner ledger. Applied idempotently (all
 * statements use `IF NOT EXISTS`) so re-opening an existing ledger file never
 * destroys data — the ledger is the executable source of truth
 * (extraction-plan.md §12 C6), so schema application must never be destructive.
 */
export const LEDGER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS dag_meta (
  dag_id TEXT PRIMARY KEY,
  plan_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  dag_id TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  milestone INTEGER NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  depends_on TEXT NOT NULL,
  requires_approval INTEGER NOT NULL,
  state TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  max_retries INTEGER NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  next_attempt_earliest_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  released_at TEXT
);

CREATE TABLE IF NOT EXISTS job_attempts (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL,
  lease_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  sandbox_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT,
  summary TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items (state);
CREATE INDEX IF NOT EXISTS idx_leases_work_item ON leases (work_item_id, released_at);
CREATE INDEX IF NOT EXISTS idx_job_attempts_work_item ON job_attempts (work_item_id);
CREATE INDEX IF NOT EXISTS idx_state_transitions_work_item ON state_transitions (work_item_id);
`;
