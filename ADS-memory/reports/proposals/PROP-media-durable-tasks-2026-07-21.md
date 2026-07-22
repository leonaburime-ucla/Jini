# Proposal: where should `createSqliteMediaTaskStore` live long-term?

**Status:** Proposal only — not a blocker for the current implementation. `createSqliteMediaTaskStore` is implemented and tested today at `packages/media/src/sqlite-task-store.ts`, exported from `@jini/media`'s barrel, 100% covered. This document is about whether that's the *permanent* home, not whether the feature should exist — it should, and does.

**Referenced from:** `packages/media/src/sqlite-task-store.ts`'s module doc comment, and `packages/media/source-map.md`'s 2026-07-21 (round 3) dated section.

## The problem

`@jini/media`'s task brief asked for a durable adapter for `task-store.ts`'s `MediaTaskStore` port — several already-ported and future vendors (video generation, Leonardo's poll loop, any future async-polling vendor) are submit-then-poll-then-fetch jobs, so a job's state has to survive a process restart, not just live in `createInMemoryMediaTaskStore`'s `Map`.

This repo already has exactly one precedent for "a port defined in one package, with a durable `better-sqlite3` adapter implementing it": `@jini/daemon`'s `EventLog` port, with its adapter (`createSqliteEventLog`) living in the separate `@jini/sqlite` package. That's the "natural" placement a reader would expect for `MediaTaskStore`'s own durable adapter too.

But `@jini/sqlite` is one of `scripts/check-engine-boundaries.ts`'s fourteen *locked* packages (`extraction-plan.md` §3), and rule **R7** (`scripts/check-engine-boundaries.ts:13-14`) forbids a locked package from importing a package listed in `UNLOCKED.md` unless that entry's `status` is `"stable"`. `@jini/media`'s `UNLOCKED.md` entry says:

```json
"@jini/media": {
  "status": "incubating",
  "consumers": [],
  "lockedPackagesMayImport": false,
  "signOff": "PENDING",
  "note": "Multi-provider image/video/audio generation gateway substrate. Not named anywhere in extraction-plan.md."
}
```

So `@jini/sqlite` depending on `@jini/media` for `MediaTaskStore`'s types (to implement the port there, `EventLog`-style) would fail `pnpm guard` outright today. That's not a workaround-able technicality — `@jini/media` itself isn't in the locked architecture yet at all, and per `AGENTS.md`, needs Coordinator/Software-Architect sign-off before it's treated as such.

## What was actually implemented (and why it's a legitimate interim answer, not a punt)

`createSqliteMediaTaskStore` lives inside `@jini/media` itself (`src/sqlite-task-store.ts`), not `@jini/sqlite`. Since `@jini/media` is itself unlocked, it has no R7-style restriction on what it may depend on (`better-sqlite3` was added as a direct dependency), so this doesn't trip any boundary check — confirmed by `pnpm guard` passing clean. It reproduces the **exact same conventions** `@jini/sqlite`'s `createSqliteEventLog` already established (`new Database(dbPath)`, `db.pragma('journal_mode = WAL')`, idempotent `CREATE TABLE IF NOT EXISTS`, `db.transaction()` for atomic writes, `Promise`-returning methods despite synchronous `better-sqlite3` underneath, a `close(): Promise<void>` beyond the port interface) — so a future move is a relocation, not a redesign.

This is not "we didn't know where it should go so we guessed" — it's "the correct home is contingent on a promotion decision (`@jini/media` -> `"stable"`) that only the Coordinator/Software-Architect can make, and blocking the durable-adapter deliverable on that decision would leave the task's own explicit ask (survive a restart) undelivered for no functional reason." The adapter works correctly and is fully tested regardless of which package file it sits in.

## Open questions for the architect

1. **Should `MediaTaskStore` + `createSqliteMediaTaskStore` eventually move to `@jini/sqlite`**, mirroring the `EventLog` precedent exactly, once `@jini/media` is promoted past `"incubating"`? Or is "the durable adapter lives beside the port it implements, inside the same package" actually the better long-term convention in general (i.e. should `EventLog`'s split-package precedent itself be reconsidered, rather than `MediaTaskStore` being made to match it)? These are two different defaults for future ports and this is a real fork, not just a `MediaTaskStore`-specific question.
2. **If it does move to `@jini/sqlite`**: does `@jini/sqlite` then need to depend on `@jini/media`'s *types* only (a type-only import, potentially satisfiable even under R7 if the rule is refined to distinguish type-only imports from runtime ones — worth checking whether `check-engine-boundaries.ts` already makes that distinction anywhere else), or does the whole `MediaTaskStore`/`MediaTask`/`MediaTaskPatch`/etc. port definition move out of `@jini/media` into a more neutral location (`@jini/core`? `@jini/sqlite` itself?) so `@jini/sqlite` doesn't need to depend on `@jini/media` at all?
3. **Is `@jini/media`'s promotion to `"stable"` even on a realistic near-term path?** Its own `UNLOCKED.md` entry lists zero consumers today. If promotion is far off, is it worth a smaller interim fix — e.g. explicitly widening R7 for this one case, or accepting the current placement as durably correct rather than "temporary" — rather than leaving a standing TODO that may never resolve?

## What this document is not

Not a request to change `scripts/check-engine-boundaries.ts`, `UNLOCKED.md`, or move any file — no code changes accompany this proposal. The current placement (`@jini/media/src/sqlite-task-store.ts`) is fully functional, tested, and `pnpm guard`-clean; this is purely flagging the long-term placement question for whoever next reviews `@jini/media` for promotion.
