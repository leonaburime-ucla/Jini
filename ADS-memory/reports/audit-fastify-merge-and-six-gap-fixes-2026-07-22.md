# Deep-dive audit: Fastify-transport merge + the "six-gap fix" round — 2026-07-22

## Audit target and verdict

- **Scope:** the two rounds of work claimed complete tonight: (1) the merge of `feat/fastify-http-backend` into `main` (`9296bd6`, 2026-07-22 20:00 UTC) claiming full dual-transport parity for runs/agents/host-tools; (2) the follow-up pass fixing six gaps a prior audit round named (journalEventLog leak, unexported delegated-tools route pack, disconnected retry classifier, orphaned media dispatch engine, six un-auto-wired HTTP route packs, 100%-coverage push with `packages/deploy` flagged at 85% branch).
- **Method:** zero-trust re-verification. Every load-bearing claim was re-run or re-read directly: live daemon boots on both transports with real HTTP requests and SSE reads, dry-run merges, package coverage re-runs on both `main` and the fix branch, call-graph reading for every spot-checked "documented-unreachable" branch, and one runnable repro for a new bug found during the audit. Nothing below is taken from a commit message or a prior report.
- **Mid-audit movement:** while this audit was running, `main` moved from `9296bd6` to `27443b1` (authored 2026-07-22 20:23 UTC, `LA <la@LAs-MacBook-Pro.lan>`, i.e. a local session — not either cloud task), which independently re-implemented **3 of the six fixes**. All observations below are against `main @ 27443b1` unless marked otherwise.
- **Verdict: NOT finished as claimed — round 1 is genuinely done and verified; round 2 is real work stranded on an unmerged, diverged branch, now partially duplicated on `main` with a *contradictory* second implementation of the retry classifier.** Details and the exact remediation list are at the end.

### Score card (claim → observed)

| Claim | Where claimed | Observed | Status |
|---|---|---|---|
| Dual-transport parity: same `JsonRouteSpec` objects, both transports serve runs/agents/host-tools + SSE | merge `9296bd6` | Verified live: booted both transports, `GET /api/agents` 200, `POST /api/runs` 201, SSE `text/event-stream` with a real replayed `start` event on **both**; `fastify/{runs,agents,host-tools}.ts` import the identical spec objects from `../*.js`; spec-identity is itself unit-tested | ✅ TRUE |
| 875 http / 78 node-host / 28 agui tests, 100% cov on fastify subtree + node-host, typecheck/guard clean | merge `9296bd6` | Re-ran: 875/78/28 pass (876 http after `27443b1`); fastify subtree and node-host 100/100/100/100; guard clean | ✅ TRUE |
| journalEventLog closed on `stop()` + bind-failure | fix round | On `main` **only since `27443b1`** (landed mid-audit, without the branch's regression tests); branch `fd97945` has the same fix **with** tests | ⚠️ landed twice, tests only on the unmerged branch |
| `registerDelegatedToolRoutes` exported from `@jini/http` barrel | fix round | On `main` only since `27443b1` ([index.ts:243](../../packages/http/src/index.ts#L243)); branch `6dd3497` adds the same export independently → guaranteed merge collision | ⚠️ landed twice |
| Real `classifyFailure` wired; `decideSafeRunRetry` really called | fix round | On `main` since `27443b1` via `resumableFromProcessExit`; **branch `ab62065` wires a same-named classifier with the opposite policy** (see AUD-002) | ⚠️ landed twice, **contradictory semantics** |
| Media dispatch engine has a real caller | fix round | **Not on `main`.** Only branch `76e8f68` (`packages/http/src/media.ts` + auto-wire); verified live on the branch (202 → background dispatch → redacted `failed`); also has a confirmed crash bug (AUD-003) | ❌ not landed |
| Six route packs auto-wired zero-config | fix round | **Not on `main`.** Only branch `305923a`; verified live on the branch (memory 200, db-ops 403-by-policy, terminals denied); wiring is **Express-only** (AUD-004) | ❌ not landed |
| Genuine 100% coverage push; deploy flagged at 85% branch | fix round | http/memory/mcp closed to real 100% **on the branch only**; `main`'s http still has the runs.ts/terminals.ts branch gaps; **`packages/deploy` untouched by every round — still 85.41% branch on `main`, re-measured** (AUD-005) | ❌ deploy not addressed; rest branch-only |

---

## Findings, ranked

### AUD-001 — Critical (process/integrity): the "six-gap fix" round never landed on `main`; its work sits on a diverged branch that now conflicts with `main` in 6 files

The fix round's 12 commits (`fd97945`..`41672d2`, 2026-07-22 18:46–20:11 UTC) exist only on `origin/fix/audit-6-fixes-20260722`. That branch forked from `d3d0c88` — **before** the Fastify merge — so every one of its changes to `create-local-node-daemon.ts` was written against a file that has no transport switch.

Reproduce the divergence:

```
$ git merge-base origin/main origin/fix/audit-6-fixes-20260722   # → d3d0c88 (pre-Fastify)
$ git merge --no-commit --no-ff origin/fix/audit-6-fixes-20260722
CONFLICT: packages/daemon/source-map.md
CONFLICT: packages/http/source-map.md
CONFLICT: packages/http/src/__tests__/index.test.ts
CONFLICT: packages/node-host/package.json
CONFLICT: packages/node-host/source-map.md
CONFLICT: packages/node-host/src/create-local-node-daemon.ts
```

(4 conflicting files before `27443b1` landed; 6 after.) If that session reported its scope "finished", the completeness claim is false in the only sense that matters here: none of it is reachable from `main`, and merging it is now a real reconciliation task, not a click. The branch also committed **no session handoff or report into `ADS-memory/`** (checked: `git diff --stat d3d0c88..fix/audit-6-fixes-20260722 -- ADS-memory` is empty), so without this audit the work would be invisible.

The three gaps still absent from `main` after `27443b1`: the media route pack (dispatch engine still has zero callers on `main` — `grep -rn "createMediaDispatchEngine" packages --include=*.ts` outside `packages/media` returns nothing), the six-route-pack auto-wiring, and the http/agent-runtime/cli/memory/mcp coverage closes.

### AUD-002 — High (correctness/API): two same-named retry classifiers with opposite verdicts now exist in the repo's two live lines

`main @ 27443b1` added [`classifyProcessExitFailure`](../../packages/daemon/src/run/core/retry.ts#L123) in `run/core/retry.ts`: **any** signal-terminated child → `{failure_detail: 'signal_killed', retryable: true}` ("an OOM-kill or infra eviction is presumptively transient"), and extended the shared policy allowlist so `signal_killed` is a retryable category ([retry.ts:203](../../packages/daemon/src/run/core/retry.ts#L203)).

Branch commit `ab62065` added a **different** `classifyProcessExitFailure` in `agent-executor.ts`: only `SIGPIPE` → retryable (as `upstream_unavailable`/`network_error`); SIGKILL/SIGTERM → `{signal_killed, retryable: false}`, with a long source-map argument for exactly the opposite presumption (`packages/daemon/source-map.md` on that branch, "a real default for gap 4's classifyFailure port").

Consequences, verified by reading [`decideSafeRunRetry`](../../packages/daemon/src/run/core/retry.ts#L216):

- For the same SIGKILL'd run, `main` says `resumable: true`, the branch says `resumable: false`. Both are internally consistent, tested, and documented; they cannot both be the product's policy.
- The explicit `if (!failure.retryable) return suppress('not_retryable')` check runs before the allowlist grants a retry, so after a naive textual merge the branch's classifier would still win wherever *it* is the one wired — meaning behavior would silently depend on which wiring survives conflict resolution in `create-local-node-daemon.ts`.
- Both files export the same symbol name from the `@jini/daemon` package surface (`run/index.ts` re-exports the retry module; the branch exports its version from `agent-executor.ts`), so an unreconciled merge risks a duplicate/ambiguous export at the barrel.

Whoever merges the branch must consciously pick one policy and delete the other implementation — nothing in the tree forces that decision to happen, and the merge conflict markers in `create-local-node-daemon.ts` will not even touch `retry.ts`/`agent-executor.ts` (different files, both merge cleanly textually).

Shared limitation of both implementations, worth keeping on record: `attemptCount` is hardcoded to `0` and `sideEffects` is never supplied, so `decideSafeRunRetry`'s attempt-cap and side-effect-suppression guards (`user_visible_output_seen`, `tool_call_seen`, …) remain dead code in every real wiring. `main`'s version documents this honestly ([retry.ts:145–155](../../packages/daemon/src/run/core/retry.ts#L145)); it is still true that "the classifier is connected" overstates how much of the retry policy is exercisable.

### AUD-003 — Medium-High (bug, confirmed by repro): an in-flight media generation at daemon shutdown crashes the process via an unhandled rejection (branch only)

Branch `76e8f68`, `packages/http/src/media.ts`, `runMediaGenerationInBackground`: the `catch` arm's terminal-state write —

```ts
} catch (error) {
    const apiError = reportInternalError(deps, 'media-generate-dispatch', error, taskId, ownerRef);
    await deps.taskStore.update(taskId, { status: 'failed', ... });   // ← not itself guarded
}
```

— is not wrapped, and the whole function is invoked as `void runMediaGenerationInBackground(...)` from `mediaGenerateRoute.handle`. If the sqlite task store is already closed when a still-in-flight `engine.generate()` settles (the auto-wire commit `305923a` closes `media-tasks.db` in `stop()`, and vendor calls "can take tens of seconds" per this module's own doc), *both* the success path's update and the catch path's update throw — and the catch path's throw escapes into an unhandled rejection, which kills a default-configured Node process mid-shutdown.

Reproduced against the branch's real built packages (fake engine held pending, real `createSqliteMediaTaskStore`, real Express app; store closed, then the generate rejected):

```
generate -> 202 {"task":{"id":"005a9cef-...","status":"queued",...
unhandledRejection observed: TypeError: The database connection is not open
```

Fix shape: wrap the catch-arm update (route the secondary failure to `onInternalError` and stop), and/or track in-flight generations and drain them in `stop()` before closing the store (the same discipline `RunLifecycle` already applies to runs). Note `MediaTaskStore.update` returning `null` for a deleted task is already handled implicitly (no throw — verified in `packages/media/src/task-store.ts`), so the delete-while-generating race is fine; only the closed-store window is not.

### AUD-004 — High (parity regression by construction): the branch's route-pack auto-wiring is Express-only, and `@jini/http` has no Fastify mounting for 7 of its 10 route packs

Branch `305923a` wires memory/terminals/model-proxy/active-context/db-ops/media into `createLocalNodeDaemon` by calling the flat (Express) registrars directly — correct against its pre-Fastify base, but on today's `main` those calls belong inside the Express transport branch, and there is **no Fastify equivalent to put in the other branch**: `packages/http/src/fastify/` contains mounting siblings only for runs, agents, host-tools, and daemon-status ([fastify/index.ts](../../packages/http/src/fastify/index.ts)). Memory, routines, db-ops, terminals (including its SSE event stream), model-proxy (SSE), active-context, delegated-tools, and media have none.

So the reconciled merge, done naively, ships a `transport: 'fastify'` daemon that silently lacks six route packs — regressing the *"real dual-transport parity, not a reduced set"* property `9296bd6`'s merge message and `packages/node-host/source-map.md`'s 2026-07-22 entry just established, with no test to catch it: the existing spec-identity/parity tests cover only the four packs that have Fastify siblings. There is no automated cross-transport route-inventory parity check.

The auto-wired defaults themselves verified genuinely safe live on the branch (zero-config boot): `POST /api/terminals` → denied via `denyAllWorkspaceRoots` (404, no fabricated root), `GET /api/daemon/db` and `POST /api/daemon/db/vacuum` → `403 TOOL_OPERATION_DENIED` (deny-by-default `ToolPolicy`), `GET /api/memory` → 200 with a real note-store under `dataDir`, media → AUD-003's flow. The two packs left caller-supplied have real, specific blockers, verified against the code: `RoutinePersistence.list(): Routine[]` is synchronous vs `RoutineStore`'s async CRUD ([types.ts:118](../../packages/daemon/src/routines/types.ts#L118)), and `delegated-tools.ts`'s `resolvePrincipal` is a mandatory host-owned identity dep with no safe default ([delegated-tools.ts:65](../../packages/http/src/delegated-tools.ts#L65)). This is exactly the honest-blocker documentation the standing rule asks for — the failure here is transport scope, not the defaults.

### AUD-005 — Medium (coverage claims): `packages/deploy` — the named worst offender — was not touched by any round; its 85% branch coverage is now codified in a self-chosen 78% gate

Re-measured on `main` (`pnpm --dir packages/deploy run test:coverage`, 172/172 pass):

```
All files      99.78 stmts | 85.41 branch | 100 funcs | 99.78 lines
cloudflare-pages.ts        77.09 branch
vercel.ts                  81.70 branch
reachability.ts            87.95 branch
netlify.ts                 97.77 branch
github-pages.ts            99.13 branch
```

Neither the fix branch (no deploy commit in `fd97945..41672d2`) nor `27443b1` touched deploy. The committed threshold ([vitest.config.ts](../../packages/deploy/vitest.config.ts)) is 98/**78**/98/98, self-described as a "ratchet baseline, NOT a final target", with cloudflare-pages' ~82 and vercel's ~15 uncovered branch outcomes explicitly named "stretch goals … not closed here". That is a documented deferral, not a hidden one — but it means the package the audit prompt flagged as most concerning is exactly where it was, and the 78% branch gate would accept further regression of ~7 points from today's number.

Spot-checks of 3 documented-unreachable claims (all verified accurate by reading every call site, per the claims' own instructions):

1. [netlify.ts:164](../../packages/deploy/src/netlify.ts#L164) — `fallback || …` right-hand operand: all 5 `netlifyError` call sites pass non-empty literals. TRUE.
2. [netlify.ts:306](../../packages/deploy/src/netlify.ts#L306) — `if (!json) continue;`: the single caller passes two always-non-null responses. TRUE.
3. [github-pages.ts:185](../../packages/deploy/src/github-pages.ts#L185) — same `fallback` pattern: all call sites pass non-empty literals. TRUE.

Caveat on all three: these are module-private helpers whose "unreachable" branches are unreachable *via current callers*, not untestable — the branch's own `045ca0d` demonstrated the correct pattern for exactly this situation (export `actionResultToApiResult` for direct unit testing). The same one-line export refactor would convert all three from documented-away to genuinely covered. The standing rule ("refactor to make things reachable and tested") points at the refactor, not the essay.

### AUD-006 — Low (test gap on `main`): the journal-close fix landed without its regression tests

`27443b1` changed `stop()`/`failToBind` in [create-local-node-daemon.ts](../../packages/node-host/src/create-local-node-daemon.ts#L380) to close `journalEventLog`, but added no node-host test (diffstat touches no `__tests__` file; suite count unchanged at 78). Coverage stays 100% because existing stop-path tests execute the line — but nothing asserts the journal handle actually closes, so a regression (e.g. dropping it from the `Promise.all`) would pass the full suite. The branch's `fd97945` has exactly the missing assertions (three `createdJournal.close` checks in `create-local-node-daemon.test.ts`); they should survive the merge reconciliation.

### AUD-007 — Info (positive): where the fix round's work exists, its quality is genuinely high

Zero-trust re-runs on the branch tip (`41672d2`): guard clean; http **755/755 tests, 100/100/100/100** (the runs.ts:69 / terminals.ts branch gaps really closed — and closed the right way: `runId` made required to delete a dead branch, `actionResultToApiResult` exported and directly tested, real guard-clause tests); node-host 76/76 at 100%; memory 212/212 and mcp 302/302 at 100%; cli 317/317 at 100/99.84/100/100 with the one remaining branch documented against Node's `Readable` 'end'/'error' mutual-exclusivity contract and the threshold honestly set to 99, not suppressed; daemon 500/500 at 99.92% branch; agent-runtime 1712 passed at 99.96/99.95 including a genuinely diagnosed v8 phantom-branch artifact (`try/catch/finally` with dual early returns).

Sampled test files contain zero `toBeDefined()`/`toBeTruthy()` padding (checked `media.test.ts`, `terminals.test.ts` additions, `fastify/runs.test.ts`); assertions are exact-shape (`toEqual` on full error envelopes, `toMatchObject` on precise field values), and the Fastify parity test asserts spec-object identity, not just route-path strings. Both spot-checked "genuinely unreachable" re-verification claims held up under independent re-derivation: [schedule.ts:219](../../packages/daemon/src/routines/schedule.ts#L219) (the unguarded `partsInTimezone` two lines earlier proves the timezone valid before `tzWallToUtcGapFallback`'s only null path could trigger — confirmed by reading both implementations) and registry `trust.ts:337-338`.

The same holds for round 1: the merge's conflict-resolution engineering (the `express-index.ts` re-export barrel preserving ~118 commits of flat imports, the `raw-sse.ts` rename, the agui encoder fix onto the real `eventId/kind/payload` envelope) all checks out in the tree, and every numeric claim in both `9296bd6`'s and `27443b1`'s messages reproduced exactly (875→876/78/28 tests, 500 daemon, guard/typecheck/build clean).

---

## Overall verdict

**Round 1 (Fastify merge): genuinely finished and production-shaped as claimed.** Dual-transport parity for the four wired route packs is real — observed live over HTTP on both transports including SSE event flow — the SSE core is truly transport-agnostic (shared `handleRunEventStreamRequest` over raw `ServerResponse`), and every stated number reproduces.

**Round 2 (six-gap fixes): real, high-quality work that is NOT landed, and the repo is now in a genuinely hazardous three-way state.** Three of six gaps got a second, independent fix on `main` (`27443b1`) with a retry policy that *contradicts* the branch's version of the same-named function; the other three gaps (media caller, auto-wiring, the http/agent-runtime/cli/memory/mcp coverage closes) exist only on a branch that conflicts with `main` in 6 files, wires everything Express-only, and contains one confirmed process-crash bug (AUD-003).

### What has to happen next, in order

1. **Reconcile the branch onto `main` deliberately** — rebase or merge `fix/audit-6-fixes-20260722`, resolving the 6 conflicts *and* the invisible semantic ones: keep exactly one `classifyProcessExitFailure` (decide the SIGKILL/SIGTERM policy question explicitly — `main`'s "signals are presumptively transient" vs the branch's "SIGPIPE-only"; record the decision in `daemon/source-map.md`), keep one delegated-tools export block, and carry the branch's journal-close regression tests over (AUD-006).
2. **Restore dual-transport parity for the newly wired packs** — either build `fastify/` mounting siblings for memory/terminals/model-proxy/active-context/db-ops/media/delegated-tools (they are thin: the route logic is already transport-neutral `JsonRouteSpec`s) or hoist pack mounting to a transport-agnostic mechanism; then move the auto-wiring calls into both transport branches, and add an automated cross-transport route-inventory parity test so this cannot silently regress again (AUD-004).
3. **Fix AUD-003** before the media pack ships: guard the catch-arm `taskStore.update`, and drain or abandon in-flight generations in `stop()` before closing `media-tasks.db`.
4. **Do the deploy coverage work that was flagged and skipped** — cloudflare-pages.ts (~82 branch outcomes) and vercel.ts (~15) need real tests, and the three verified-accurate-but-refactorable "unreachable" helpers should get the `045ca0d`-style export treatment; then raise the 78% branch ratchet to match reality (AUD-005).
5. **Process:** cloud tasks that finish scope must either land on `main` (merge, verified, pushed) or say plainly that they did not; and every such session must leave its report in `ADS-memory/reports/` — the six-fix branch left neither, and only this audit surfaced the divergence.

## Provenance

Audit run 2026-07-22 ~20:10–21:00 UTC in an isolated cloud session against `origin/main @ 27443b1` and `origin/fix/audit-6-fixes-20260722 @ 41672d2`; Node v22.22.2 (repo engines want ~24 — everything passed regardless, worth a CI pin note), pnpm 10.33.2. All commands quoted above are re-runnable from the repo root.
