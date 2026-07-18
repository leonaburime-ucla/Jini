# Session handoff — 2026-07-18

## Read this first

The user lost trust in this session's reporting partway through, after finding
`packages/daemon/src` looked nothing like a port of Open Design's real daemon
(460 files / 174K lines there vs. 14 files / 2.5K lines here). That reaction
was **correct about `daemon` specifically** — see "The daemon finding" below.
It is **not correct that no real work exists** — see "Verified state" below,
which is a real audit run at the end of this session, not a claim carried
over from earlier. Next session should not just take either side on faith;
re-verify anything load-bearing before building on it.

## Verified state (measured 2026-07-18, not asserted)

Real line/test counts across `packages/*/src`, via `find` + `wc -l`, run live:

| Package | src lines | test lines | test files |
|---|---|---|---|
| ui | 30,091 | 33,063 | 255 |
| agent-runtime | 14,159 | 16,463 | 87 |
| platform | 4,750 | 2,588 | 10 |
| renderers-react | 3,879 | 4,248 | 25 |
| chat-react | 3,083 | 3,146 | 23 |
| daemon | 2,523 | 2,833 | 14 |
| chat-core | 2,817 | 732 | 5 |
| desktop-host | 2,072 | 2,117 | 28 |
| sidecar | 1,160 | 329 | 1 |
| media | 1,175 | 1,061 | 9 |
| deploy | 1,473 | 502 | 5 |
| memory | 998 | 856 | 5 |
| core | 921 | 665 | 5 |
| http | 848 | 1,309 | 10 |
| registry | 686 | 841 | 5 |
| cli | 647 | 824 | 9 |
| diagnostics | 624 | 753 | 7 |
| sqlite | 513 | 634 | 4 |
| protocol | 432 | 179 | 2 |
| capability-providers | 442 | 415 | 7 |
| metatool | 202 | 277 | 2 |
| node-host | 1 | 0 | 0 |

**Total: ~73,500 src lines + ~73,800 test lines, 518 test files.** This is real
code on disk, independently confirmed this session by: running full test
suites for `ui` (2,811 tests), `agent-runtime` (1,636 tests), `http` (157
tests), `daemon` (108→237 across the two merges), `renderers-react`, `memory`,
`registry` — all green, with measured (not claimed) coverage numbers. Also
confirmed by reading actual file contents directly (not listings) for several
files, e.g. `packages/ui/src/features/file-dropzone/react/components/
FileDropzone.tsx`, `packages/daemon/src/tool-executor.ts`.

## The daemon finding (the thing that triggered the trust break)

`packages/daemon/src`'s 7 top-level items: only **2 are literal ports** from
OD (`artifacts/` ↔ OD's `apps/daemon/src/artifacts/`, 6 files/1,075 lines;
`legacy-data-migration.ts` ↔ OD's `migration/`, 3 files/713 lines). The other
5 (`close-status.ts`, `event-log.ts`, `run-lifecycle.ts`, `tokens.ts`,
`tool-executor.ts`) are **new architecture invented for this project**, not
ports — `tool-executor.ts`'s own doc comment says so explicitly ("This is new
design work, not a port... there is no upstream source to lift here").

This is *consistent with* `extraction-plan.md`'s own stated intent (daemon =
"the kernel," 3-4 new primitives; full backend-apps vendoring is explicitly
task #10 of 10, not started) — but that framing itself has never been
independently re-examined this session, only cited. Worth deciding
deliberately whether that's still the right call, not just assuming the doc
is right because it says so.

**Real gap, not a doc-framing question:** `packages/cli`, `packages/sqlite`,
`packages/node-host` all have *some* real content now (cli: 647 lines,
sqlite: 513 lines — both more than `AGENTS.md` currently claims, that doc is
stale and should be fixed), but nothing wires them together into an actual
runnable daemon. `db.ts` (86KB in OD), `server.ts`+`cli.ts` (775KB combined in
OD, the actual bootstrap), `mcp.ts`+related (~180KB, generic MCP protocol
support, not OD-specific) have zero presence in any `@jini/*` package. There
is no assembled, runnable Jini daemon yet — only independently-tested pieces.

## Trust caveat — do not skip this

PR #13's own independent audit (see `ADS-memory/reports/port-refactor-audit-
canary-2026-07-17.md` — **note: that file currently lives only on the
unmerged branch `docs/od-source-of-truth-and-r7-recon`, not main; check there
or merge that branch first**) found a branch's own `source-map.md` falsely
claiming i18n was complete, MCP enable/edit behavior silently dropped but
mislabeled as tested, and a coverage claim that didn't hold at the
full-package aggregate. All caught only because someone went and checked,
not from the branch's own reporting. **No comprehensive, adversarial audit
of all 22 packages' claims has been done.** Only what's been reactively
checked in response to a direct question should be trusted; everything else
is an unverified claim, including this document's own "Verified state" table
above beyond what it explicitly says was independently run.

## Pending PRs — exact state, verified just now

- **PR #34** (`feature/renderers-react-preview-modal`) — GitHub shows
  CLEAN/MERGEABLE (unmerged). **A merge-with-main was done in
  `/tmp/jini-merge-34` (zero conflicts) but never committed** — `git status`
  there still shows the merge staged. Typecheck passed clean pre-interrupt;
  test suite run was started but its output was never captured before the
  session moved on. Next session: go into that worktree, re-run
  `pnpm --filter @jini/renderers-react exec vitest run --coverage`, confirm
  the aggregate, run `pnpm guard` + a purity grep, then commit/push/merge —
  or start the merge fresh if picking this worktree back up feels risky.
- **PR #35** (`feature/jini-ui-file-dropzone`) — fully resolved, verified
  (264/264 test files, 2,811/2,811 tests, 96.38/94.87/95.48/96.38 coverage,
  guard/purity clean), merge commit `7f8e6b0b9` pushed. **Never actually
  `gh pr merge`'d — just run `gh pr ready 35 && gh pr merge 35 --merge
  --delete-branch=false`.**
- **PR #36** (`feature/jini-ui-small-atoms-batch`) — a PR got opened (by the
  cloud session itself) while only 3 of 5 items were done (EditorIcon,
  iframe-pool, command-palette shipped; tab-launcher-menu + DesignSystemFlow
  remainder not yet). Currently DIRTY/CONFLICTING against main. Check whether
  the cloud session finished the remaining 2 items before doing anything
  else with it.
- **PR #13** (`port/source-config-list-resource-dashboard`) — the
  audit-fix subagent finished. 6 of 7 required findings fixed in full
  (i18n, BYOK test-before-save, MCP enable/edit, mutation error handling,
  run-history race safety, provenance SHA), each independently verified
  (typecheck clean, 167 files/1,675 tests green, purity clean). **Finding
  #1 (coverage ≥99%) explicitly NOT achieved** — real aggregate is
  93.87/92.17/93.25/93.87%, though every file this task touched is 100%; the
  gap is 41 pre-existing files elsewhere in `@jini/ui` (`Icon.tsx` 41%,
  `TooltipLayer.tsx`, `notifications.ts`, `CustomSelect.tsx`,
  `useConnectorAuthorization.ts` account for 66.5% of it). Merge decision
  was left open — pending user call on whether to merge with the disclosed
  coverage gap or require a coverage-focused follow-up first.
- **`feature/jini-ui-rich-text-input`** — code complete per its commit log
  (Lexical editor, mention node, caret layer, serialize/deserialize, hooks +
  tests), but **no PR opened**. Check whether the cloud session is still
  running or stalled before opening one.

## Other loose ends

- `docs/od-source-of-truth-and-r7-recon` branch is pushed but **not merged** —
  holds real doc fixes (AGENTS.md/README pointer to the real OD clone at
  `/Users/la/Desktop/Programming/OSS-Repos/open-design`) plus the r7 backend
  recon doc and this repo's copy of the port-refactor audit reports. Merge or
  at least read it before trusting anything that cites those files by path.
- `refactor/ui-flat-components-under-react` (PR #33) is merged; local main
  checkout is current as of commit `3342e1cdc`.
- Several `/tmp/jini-*` git worktrees still exist (`jini-merge-34`,
  `jini-merge-35`, plus older `jini-cov-*`/`jini-fix-agent-runtime` ones
  marked `prunable`) — clean up with `git worktree remove --force <path>`
  once their PRs are resolved.
- `AGENTS.md`'s package-status prose (which packages are "stubs" vs. "real")
  is stale in multiple places — confirmed wrong for at least `cli` and
  `sqlite` tonight. Don't trust it without checking the actual `src/`
  contents first.

## Recommended next step

Before dispatching any more new feature-extraction work: run one real,
adversarial audit across all 22 packages — not a reactive spot-check, a
deliberate pass checking every `source-map.md`'s claims against actual
file contents, test results, and coverage numbers. The PR #13 audit is the
template for what this should look like. Given the trust break this
session, that audit is worth more right now than another PR.
