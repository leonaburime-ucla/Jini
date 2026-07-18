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
