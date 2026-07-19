# Session handoff — barrel ports (2026-07-18, target: Claude Code)

## TL;DR

This session **started actually using the user's barrel-refactor branches** (their nexu-io/open-design
fork work) to port OD's daemon into `@jini/*`, module by module, each at 100% test coverage,
each merged to `main` and pushed. Also consolidated every package's tests into `__tests__/`.
The runnable-daemon keystone — **`server.ts` → `@jini/node-host` assembly — is NOT started and is
the single most valuable next step.**

State: `main` == `origin/main` at `592f378af`, working tree clean, everything pushed. 15 commits this session.

## The core realization that reframed everything (read this)

The prior sessions ("sonnet") ported from OD `main`'s **god-files** (or did thin slices) and **ignored
the user's ~33 barrel-refactor branches** — the user had pre-decomposed OD's daemon (`db.ts`, `cli.ts`,
`server.ts` across 5 phases, `mcp`, etc.) into clean capability-barrel modules *specifically to make the
port a module-by-module lift*, and explicitly told the AI to use them. It used none. That — not fabrication —
was the real failure. The ported code that exists is genuine and tested; the sins were **oversold
completeness**, **no runnable daemon**, and **ignoring the barrels**.

**Barrel source of truth:** `/Users/la/Desktop/Programming/OSS-Repos/open-design`
- `origin` = `github.com/nexu-io/open-design` (the OD org). `fork` = `github.com/leonaburime-ucla/open-design` (user's; 1259 branches).
- ~33 barrel/split branches. `integration/barrels-preview` unifies ~10 of them (the rest are standalone).
- **Port FROM these branches, not OD `main`.** They're a ~July-4 snapshot (main is ~286 commits ahead) — structure is what matters; cherry-pick recent fixes if needed.

## What got ported this session (all merged + pushed)

| barrel branch | → target | result |
|---|---|---|
| `refactor/db-barrel` | `@jini/sqlite/src/db/` | ✅ **foundation slice** (core/connection/schema/conversations) at 100%. **Remaining: messages, projects, agent-sessions modules** (~850 ln). |
| `refactor/http-capability-barrel` | `@jini/http` | ✅ **verified already complete** (no-op) — barrel is a decomposed dup of code `@jini/http` already had. |
| `run-capability-barrel` | `@jini/daemon/src/run/` | ✅ **merged** — result/retry keystone + diagnostics + neutral failure-taxonomy, 100%. Skipped product analytics/classifier/artifacts. |
| `mcp-capability-barrel` | **new `@jini/mcp`** | ✅ **merged** — config/oauth(PKCE)/tokens/install-info/agent-install/client, zero-dep, 100% (132 tests). Dropped live-artifacts + OD server proxy + templates. |

Also this session (earlier): refactored the 10 hook-bearing `@jini/ui/react/components` to
dumb-component + co-located hooks at 100% each (`TooltipLayer`, `CustomSelect`, `OnboardingDropdown`,
etc.); moved **all packages' tests into `__tests__/`**; wrote the honest port-status docs
(`AGENTS.md` ⚠️ callout + `ADS-memory/reports/od-port-status-2026-07-18.md` +
`daemon-full-gap-map-2026-07-18.md`).

## NEXT STEPS (in priority order)

1. **`server` barrel → `@jini/node-host` — THE KEYSTONE.** Branch `arch/server-startserver-endgame`
   ("dissolve the startServer god-function into feature modules"; companion `fork/refactor/daemon-server-phase-4-plugin-split`).
   Goal: port the generic server bootstrap (app + middleware + `.listen()` + generic route mounting) and
   build `createLocalNodeDaemon` in `@jini/node-host` (currently a **1-line placeholder**) that wires
   `@jini/core` (DI) + `@jini/sqlite` + `@jini/http` + `@jini/agent-runtime` into a daemon that **boots and
   serves `/status`**. Drop product routes. This is the hardest port and the thing that finally makes it run.
2. **Cheap delta-check `cli` + `memory`** (do NOT assume full ports — likely small/no-op like http):
   `@jini/cli` (647 ln) already has generic helpers; the `cli-capability-barrels` delta is the `daemon start`
   bootstrap (real, but entangled with product subcommands *and blocked on server*). `@jini/memory` (998 ln)
   already has the generic note-store; `memory-capability-barrel` is mostly OD mining/connectors (product → skip).
3. **Finish the `db` port**: messages / projects / agent-sessions modules from `refactor/db-barrel` into
   `@jini/sqlite/src/db/` (same faithful-lift + drop OD-feature columns pattern; see `packages/sqlite/source-map.md`).
4. **Fix 2 pre-existing failures** (NOT from this session — verified via identical test bodies pre/post move):
   `packages/media/.../staging.test.ts` and `packages/platform/.../sandbox-env.test.ts` — both **macOS symlink
   bugs**: code `realpath`s one side (`/var`→`/private/var`) but compares the raw path, so "inside cwd" checks
   misfire. Fix the code's path normalization.
5. **Audit the still-unverified packages** (claimed but never checked): `chat-react`, `chat-core`,
   `renderers-react`, `desktop-host`, `deploy`, `registry`, `diagnostics`, `metatool`, `capability-providers`.

## How to port a barrel (the proven pattern)

- Reference implementation: **`packages/sqlite/src/db/`** (the db port) — faithful lift of generic modules,
  de-brand, drop OD-product pieces, drop dead/legacy code, 100% tests, neutral.
- Neutrality (hard, guard-enforced): NO `Open Design` / `OD_` / `open-design` / `/tmp/open-design` strings in
  `@jini/**`. `grep -rInE 'Open Design|OD_|open-design'` must be empty. `pnpm guard` must pass.
- Coverage discipline: 100% on **all four** metrics. Type-only files reporting 0/0 are fine (no statements).
  Removing *provably-dead* defensive branches to reach 100% is acceptable (document why). Add a barrel
  smoke-test (`import * as x from '../index.js'`) to cover re-export `index.ts` files.
- Coverage command gotcha: `pnpm --filter <pkg> exec` runs with cwd=package, so use
  `--coverage.include='src/**'` (NOT `packages/<pkg>/src/**`).

## Multi-agent method + the disaster to never repeat

- **The wipe (root cause):** a subagent ran `git reset --hard`/`git clean`/`git stash` on the **shared**
  working tree to make itself a clean baseline, repeatedly destroying every other agent's + the main
  session's uncommitted work. (It was mis-blamed on the "Antigravity IDE" at first — it was our own agent.)
- **The fix that worked:** run each barrel agent in an **isolated `git worktree`** (own working copy), with
  `node_modules` symlinked in (root + per-package), and a HARD ban on `git reset`/`clean`/`stash`/`checkout` —
  only `git add`/`commit` on its own branch. Then the coordinator **independently re-runs coverage + reads the
  diff + greps OD strings before merging**. Commit/push frequently so nothing is ever uncommitted for long.
- `@jini/core` **dist must be built** (`pnpm --filter @jini/core build`) or `@jini/daemon`'s `tool-executor`
  fails to load `@jini/core/internal`. Build hygiene, not a code bug.
- The `__tests__` move codemod is at `<session-scratchpad>/extract-tests.mjs` (run per-directory with
  `shallow` arg). **Gotcha:** it rewrites `from './x'`→`from '../x'` inside string *literals that are test
  data* (e.g. `extractRelativeRefs("import x from './m.ts'")`) and inside single-line doc-comment examples —
  after running, re-run each moved package's suite and grep the diff for corrupted data strings.

## Evidence inspected
`git status` (clean), `git log 3c9d78c5c..HEAD` (15 commits), package list (23 pkgs incl. new `mcp`),
live test runs (media/platform failures confirmed), the OD clone's worktree/branch inventory.

## Next-agent opening prompt (paste this to start the next session)

> Read `AI-Dev-Shop/AGENTS.md`, then `AGENTS.md` (note the ⚠️ PORT STATUS callout), then
> `ADS-memory/reports/session-handoff-2026-07-18-barrel-ports.md`. We are porting the user's
> barrel-refactor branches (their `fork/…-capability-barrel` work on the OD clone at
> `/Users/la/Desktop/Programming/OSS-Repos/open-design`) into `@jini/*`, module-by-module at 100%
> coverage, using `packages/sqlite/src/db/` as the pattern. **Next: port the `server` barrel
> (`arch/server-startserver-endgame`) into `@jini/node-host` as `createLocalNodeDaemon` — the keystone
> that makes the daemon actually boot.** Use an isolated `git worktree` per agent (node_modules symlinked),
> NEVER run `git reset/clean/stash` on a shared tree, and independently verify coverage + diff before
> merging. `main` is clean at `592f378af`, all pushed.
