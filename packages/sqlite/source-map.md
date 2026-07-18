# `@jini/sqlite` — provenance

Per extraction-plan.md §8 task 8 ("Store ports + `@jini/sqlite`... a Postgres
*stub* compiles against the async ports; conformance suite has no OD schema
nouns") and §2.6 ("`@jini/sqlite` is the default adapter... an adapter
conformance suite covers transactions/ordering/cursor-durability/
cancellation/migrations"): a `better-sqlite3`-backed implementation of
`@jini/daemon`'s existing `EventLog` port (`packages/daemon/src/event-log.ts`),
proven behaviorally equivalent to that package's own
`createInMemoryEventLog` reference adapter.

This is **not a new interface.** `EventLog`/`EventLogEntry`/
`EventLogAppendInput`/`EventLogReplayResult` are defined once, in
`@jini/daemon`, and `@jini/sqlite` implements that exact contract — same
method signatures, same `dedupeKey` idempotency semantics, same
distinguishable `'replay-gap'` result, same never-reused monotonic per-run
cursor allocation, same FIFO-at-`maxEntriesPerRun` eviction (default 2000,
matching the in-memory adapter's default). `packages/daemon/src/event-log.ts`'s
own module doc literally names this package as the intended future durable
adapter (see that file's header comment).

## File map

| Jini file | Origin / grounding | Transform |
|---|---|---|
| `src/event-log.ts` | *(new — implements `@jini/daemon`'s `EventLog` port; grounded in OD's `apps/daemon/src/db.ts` and `apps/daemon/src/storage/{daemon-db,db-inspect}.ts` on `open-design`'s `main` branch for real-world `better-sqlite3` schema/SQL conventions — `new Database(file)`, `db.pragma('journal_mode = WAL')`, `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`, `db.transaction()` for atomic multi-statement writes — not copied verbatim; OD's actual tables (`projects`, `conversations`, `messages`, etc.) are product schema with no event-log equivalent to lift)* | `createSqliteEventLog(dbPath, options?)` opens (or creates) a `better-sqlite3` database and returns an `EventLog` + `close()`. Two tables: `jini_event_log_runs` (`run_id` PK, `next_cursor` — the durable monotonic cursor counter, so ids are never reused even across eviction or a restart) and `jini_event_log_entries` (`run_id`, `cursor`, `event`, `data` as a JSON-serialized TEXT column, `recorded_at`, `dedupe_key` nullable, PK `(run_id, cursor)`), plus a partial index on `(run_id, dedupe_key)` for O(log n) dedupe lookups. `append` runs inside a `db.transaction()` (dedupe check → insert → cursor-counter bump → eviction, atomically). `replay`/`drop` are plain synchronous reads/deletes (single-statement, no transaction needed). Every public method is still `async`/`Promise`-returning per extraction-plan §2.6, even though `better-sqlite3` itself is fully synchronous under the hood — this is what makes a future non-sqlite adapter (e.g. Postgres) a drop-in swap with no port change. |
| `src/index.ts` | *(new — barrel)* | Re-exports `event-log.ts`. |

## Design decisions

**1. Durable cursor counter, not `MAX(cursor)+1`.** The in-memory reference
adapter keeps a `nextId` field on each run's log that only ever increments,
independent of how many entries are currently retained — so a cursor is
never reassigned even after older entries are evicted. Deriving the next
cursor from `MAX(cursor)` on the entries table would reintroduce reuse the
moment a run's entries are ever fully evicted (e.g. a very small
`maxEntriesPerRun`, or after `drop()` if a new run reused the same id). The
`jini_event_log_runs.next_cursor` column is the durable equivalent of the
in-memory `nextId` field, updated in the same transaction as every insert.

**2. `EntryRow.data` is stored as `JSON.stringify`'d TEXT, not a live
reference.** The in-memory adapter stores whatever value was passed to
`append()` by reference; a durable store obviously cannot do that. This is a
real, documented behavioral difference (not a parity gap in the tested
contract): payloads must be JSON-serializable for the sqlite adapter, and a
round-trip through `JSON.stringify`/`JSON.parse` loses non-JSON values
(`undefined` inside objects, functions, `Map`/`Set`, etc.) exactly as any
durable JSON-backed store would. Every port method signature and every
tested behavior (ordering, dedup, replay-gap, eviction) is unaffected, since
all conformance-test payloads are plain JSON-safe values — matching what
`@jini/protocol`'s wire-event payloads actually are in practice.

**3. `close(): Promise<void>` is an addition beyond the `EventLog`
interface, not a port change.** `@jini/daemon`'s `EventLog` interface has no
lifecycle/disposal method (the in-memory adapter needs none — its state is
garbage-collected with the process). A real file-backed `better-sqlite3`
connection needs an explicit close to release its file handle/WAL files
cleanly, so `SqliteEventLog extends EventLog` adds exactly that one extra
method. Callers that only care about the `EventLog` port itself can ignore
it; the durability-across-restart tests use it directly to prove data
survives a close+reopen cycle.

**4. `db.transaction()` erases the wrapped callback's own generic
parameter.** `better-sqlite3`'s TypeScript types return a non-generic
`Transaction` from `db.transaction(fn)`, so a `<Payload>`-generic callback
passed to it loses that generic at the call site. `appendTxn` is therefore
written against `EventLogAppendInput<unknown>`/`EventLogEntry<unknown>`
internally, and the public `append<Payload>()` method casts across that
boundary — the identical pattern `createInMemoryEventLog` already uses for
its dedupe-hit early return (`existing as EventLogEntry<Payload>`), not a
new relaxation introduced by this adapter.

**5. WAL journal mode**, matching OD's own `db.ts` (`db.pragma('journal_mode
= WAL')`) — better concurrent-reader behavior and durability characteristics
than the default rollback-journal mode, and the convention this codebase's
only other real `better-sqlite3` user already established.

## Conformance test methodology

`src/event-log.test.ts` runs the same test *shape* as
`packages/daemon/src/event-log.test.ts` (ordering, `replay(afterCursor)`,
unknown-run, invalid-cursor, `drop()`, dedupe-hit/dedupe-miss, eviction,
replay-gap, contiguous-cursor-is-not-a-gap, first-replay-after-eviction) —
same inputs, same expected `EventLogEntry`/`EventLogReplayResult` shapes —
against `createSqliteEventLog` instead of `createInMemoryEventLog`, proving
behavioral parity rather than merely "this compiles against the interface."
A separate "durability across a restart" section (no in-memory equivalent is
possible) opens a fresh `createSqliteEventLog` connection to the same file
after `close()` and confirms: appended entries are visible, the cursor
counter is not reset (no id reuse across a reopen), dedupe state survives a
restart (a retried append after reopen still returns the original entry),
and `drop()` is durable (a fresh connection also reports `unknown-run`).

## Not ported (explicitly out of scope)

`apps/daemon/src/storage/project-storage.ts` was **not** read or ported per
this task's explicit instruction — it is OD's own project-model persistence,
product-specific and out of scope for a generic engine adapter.
`apps/daemon/src/storage/aws-sigv4.ts` (S3-compatible signing for a separate
OD feature) and the rest of `apps/daemon/src/db.ts`'s ~2268 lines (project/
conversation/message/deployment/routine schema) were only skimmed for
`better-sqlite3` usage conventions (see the `src/event-log.ts` file-map row
above), not read in full or ported — none of it is event-log-shaped.
`apps/daemon/src/storage/daemon-db.ts`'s Postgres-adapter-selection stub
(`resolveDaemonDbConfig`, `OD_DAEMON_DB`/`OD_PG_*` env vars) was read for
context (it is the closest thing OD has to acknowledging a second backend)
but not ported — extraction-plan §8 task 8's Postgres-stub gate is a
`@jini/sqlite`-adjacent follow-up task, not part of implementing the sqlite
adapter itself, and OD's stub is env-var selection glue with no adapter
logic behind it yet (`throws when used`, per its own header comment).

## Dependencies

`@jini/daemon` (workspace) — the `EventLog` port + `EventLogEntry`/
`EventLogAppendInput`/`EventLogReplayResult` types this package implements.
`better-sqlite3` (`^11.10.0`, new runtime dependency, native module — added
to root `package.json`'s `pnpm.onlyBuiltDependencies` so its install-time
native build runs under pnpm's default script-blocking policy) +
`@types/better-sqlite3` (devDependency).

## 2026-07-18 addition — `backend-config.ts` + `db-inspect.ts`

Task brief: port `apps/daemon/src/storage/{daemon-db,db-inspect}.ts` and
`apps/daemon/src/{metrics,logging}/` from the real `leonaburime-ucla/open-design`
fork (cloned fresh to `/tmp/od-source`; `apps/daemon/src` on `main`), per
`docs/jini-port/recon/r1-daemon.md`'s TASK 1 classification
(`storage/`: "`aws-sigv4.ts`, `daemon-db.ts`, `db-inspect.ts` generic; only
`project-storage.ts` leans OD"; `metrics/`+`logging/`: "generic observability
primitives").

**This supersedes the note above** ("`daemon-db.ts`'s Postgres-adapter-selection
stub... was read for context... but not ported") — that decision was scoped to
the earlier `EventLog`-focused porting session; this task's brief explicitly
targets `daemon-db.ts`/`db-inspect.ts` as first-class port items, and both
files are, independently verified by reading them in full, generic and
storage/backend-selection-shaped with no OD product coupling beyond `OD_*`
env-var names and comment mentions of `od daemon db status`/`od doctor`
CLI subcommands.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/backend-config.ts` | `apps/daemon/src/storage/daemon-db.ts` | `resolveDaemonDbConfig`→`resolveSqliteBackendConfig`, `DaemonDbConfig`→`SqliteBackendConfig`, `DaemonDbKind`→`SqliteBackendKind`, `DaemonDbConfigError`→`SqliteBackendConfigError`; logic verbatim. **Identity-stripped**: `OD_DAEMON_DB`→`JINI_SQLITE_BACKEND`, `OD_PG_HOST`→`JINI_PG_HOST`, `OD_PG_PORT`→`JINI_PG_PORT`, `OD_PG_DATABASE`→`JINI_PG_DATABASE`, `OD_PG_USER`→`JINI_PG_USER`, `OD_PG_SSL_MODE`→`JINI_PG_SSL_MODE` (same `JINI_*` substitution convention `@jini/http`'s `origin-validation.ts` already established for `OD_ALLOWED_ORIGINS`/etc). Comment referencing "the OD daemon" reworded to "v1 ships local SQLite" (no product name). |
| `src/db-inspect.ts` | `apps/daemon/src/storage/db-inspect.ts` | `inspectSqliteDatabase`/`verifySqliteIntegrity` + their types, logic verbatim (no renames — already product-neutral names). **Identity-stripped**: header comment's `` `od daemon db status` `` / `` `od doctor` `` CLI references reworded to "a host daemon's own ops CLI (a `db status` subcommand)" / "a diagnostics aggregator" — prose only, no behavior change. |

Both files ported with zero logic changes beyond the identity strips above —
verified against the Phase 0 "no behavior changes in the same PR" guardrail
in `docs/jini-port/skills/fixing-open-design.md` (the file that skill doc
governs is a capability-barrel *refactor* template, not a strict fit for a
first-time *port* like this one, but the same discipline applies).

**Phase 6.6 note:** the task brief that requested this port also referenced
a "Phase 6.6" async/network test-category checklist in
`docs/jini-port/skills/fixing-open-design.md`, said to have been "added
tonight." That file was read in full before this port began (quoted its
actual Phase 6.5 coverage-bar line as instructed) and **contains no Phase
6.6 section — the document ends at Phase 7.** This is a discrepancy between
the task brief and the actual file contents; no Phase 6.6 was fabricated to
satisfy the brief. The underlying advice the brief describes (malformed
responses, races, missing error handling, stale state on retry) is sound
practice regardless, and was applied in spirit to `db-inspect.ts` anyway:
`src/db-inspect.test.ts` covers a throwing `user_version` pragma, a
non-numeric pragma return, a throwing `sqlite_master` query, a throwing
per-table `count(*)` (simulating a corrupted table), an identifier that
fails `sanitizeTableName`, a missing primary DB file, a throwing
`integrity_check`/`foreign_key_check` pragma, and malformed pragma row
shapes (non-string message, missing named key, missing FK-violation
fields) — via a fake `Database.Database`-shaped object for the
otherwise-unreachable error paths, plus real `better-sqlite3` instances
(including a genuine FK-violation row via `PRAGMA foreign_keys = OFF`) for
the happy paths.

### `metrics/` + `logging/` — NOT ported (recon classification was wrong)

The task brief's premise — "`metrics/` (1) and `logging/` (1)... generic
observability primitives," per `r1-daemon.md`'s TASK 1 table — does not
hold up against the actual file contents. Both files
(`apps/daemon/src/metrics/index.ts`, `apps/daemon/src/logging/critique.ts`)
are **100% Critique Theater domain content**, not generic daemon
observability:

- `metrics/index.ts`: a `prom-client` registry whose nine series are all
  literally namespaced `open_design_critique_*` (`open_design_critique_runs_total`,
  `..._round_duration_ms`, `..._composite_score`, `..._must_fix_total`, etc.),
  with label sets (`panelist`, `dim`, `adapter`, `skill`, `round`) that are
  closed enums specific to the Critique Theater panelist/scoring model.
- `logging/critique.ts`: a `CritiqueLogEvent` discriminated union
  (`run_started`/`round_closed`/`run_shipped`/`degraded`/`parser_recover`/
  `run_failed`) whose every field is Critique-Theater-domain vocabulary
  (`composite`, `mustFix`, `panelist` semantics implied by `round`/`decision`).

This is the *same* OD feature `r1-daemon.md`'s own TASK 1 table separately
and correctly classifies as OD-PRODUCT under `critique/` (21 files,
"Design-critique orchestrator/scoreboard/ratchet/conformance. Product.") —
the recon simply missed that `metrics/`+`logging/` are that feature's
telemetry, not standalone generic infrastructure. There is no generic core
to extract: every constant, label, and event-type name is Critique-Theater-
specific, and porting either file into `packages/@jini/**` under any
renaming would violate root `AGENTS.md`'s hard boundary (no
`Open Design`/`OD_`-branded content in the engine) while also misrepresenting
product-feature telemetry as engine-neutral. **Correct action: dropped,
not ported.** If Jini ever wants a generic Prometheus-registry or
JSON-line-logger *primitive*, that would be new engine-shaped code
designed from scratch against real cross-consumer metrics — not a
rename of this file.

### `project-storage.ts` — split: generic core ported to `@jini/platform`, OD-specific factory dropped

Read in full (`apps/daemon/src/storage/project-storage.ts`, 437 lines).
Verified the recon's "leans OD" flag against the actual content: the
`ProjectStorage` interface + `LocalProjectStorage` + `S3ProjectStorage`
implementations are ~90% generic blob-storage logic with no OD nouns in
their own bodies; the only OD-coupled piece is the bottom-of-file
`resolveProjectStorage()` factory, which reads `OD_PROJECT_STORAGE`/
`OD_S3_BUCKET`/`OD_S3_REGION`/`OD_S3_PREFIX`/`OD_S3_ENDPOINT`/
`OD_S3_ACCESS_KEY_ID`/`OD_S3_SECRET_ACCESS_KEY`/`OD_S3_SESSION_TOKEN` env
vars directly. See `packages/platform/source-map.md`'s corresponding
section for the full file map — landed in `@jini/platform`, not
`@jini/sqlite`, because it is a filesystem/network blob-storage primitive
with no SQL/sqlite involvement (parallel to `fs.ts`'s existing role in that
package), and `aws-sigv4.ts` (its S3-signing dependency) lives there too.
`resolveProjectStorage()` itself was **not ported** — it is OD adapter
wiring (env-var names, and the choice to key storage on "project," a
product noun extraction-plan.md §Task-4-Port-2 already flags as OD's model,
not the engine's) — a Jini host application supplies its own equivalent
composition (`new LocalBlobStorage(root)` / `new S3BlobStorage({...})`
directly, or its own env-var convention) rather than inheriting OD's.
