# TestRunner report — backend coverage push

Date: 2026-07-20  
Revision verified: `7a4a94159129c3056336f51228c69c6bdb11cf58`  
Scope: `agent-runtime`, `chat-core`, `core`, `daemon`, `deploy`, `http`, `node-host`, `platform`, `protocol`, `sidecar`  
Agent: TestRunner  
Disposition: **COVERAGE_TRIAGE_REQUIRED**

## Executive result

- Root guard: **PASS** — zero package-boundary violations; 9.32s. The guard itself reports that vocabulary-firewall and residual-JS-allowlist checks remain TODO.
- Root typecheck: **PASS** — all 28 participating workspace projects reported `Done`; `tsc -p scripts/tsconfig.json --noEmit` independently exited 0 in 2s. The orchestration capture detached before emitting its timing footer, so no exact aggregate duration is claimed.
- Full affected-package tests at the final revision: **3,075 passed, 0 failed, 1 skipped** across 153 test files. The skipped test is the explicitly excluded download-lane case, `resumes a partial download when the server supports Range`.
- Unit-profile approximation from honest package-wide coverage: seven packages pass all four 98% gates; `deploy`, `platform`, and `sidecar` fail at least one metric.
- Explicit integration suite: 1/1 test passed, but package-wide integration-only coverage is **25.65/42.51/50.00/25.65**, below the 90% integration profile.
- E2E: **N/A** — backend-only scope with no browser surface.
- Mutation: **N/A** — `mutation_tests` remains an undeclared draft placeholder in computational controls.

This is advisory evidence, not formal acceptance certification. No active feature `tasks.md`, spec hash, test certification, expected test-count inventory, or approved test-directory/naming override exists in `ADS-memory`. Requirement traceability and formal convergence therefore cannot be certified.

## Commands and suite evidence

Root checks:

```text
pnpm guard
pnpm typecheck
pnpm exec tsc -p scripts/tsconfig.json --noEmit
```

Affected-package full suites were run as `pnpm --dir packages/<package> test`. Coverage used the equivalent explicit command below, with one isolated report directory per package under `/tmp/jini-tr-backend-coverage.uKS5ak/`:

```text
pnpm --dir packages/<package> exec vitest run --coverage \
  --coverage.include='src/**' \
  --coverage.reporter=text \
  --coverage.reporter=json-summary \
  --coverage.reporter=json \
  --coverage.reportsDirectory=/tmp/jini-tr-backend-coverage.uKS5ak/<package>
```

The explicit integration command was:

```text
pnpm --dir packages/daemon exec vitest run \
  src/__tests__/agent-executor-acp.integration.test.ts \
  --coverage --coverage.include='src/**' \
  --coverage.reporter=text --coverage.reporter=json-summary --coverage.reporter=json \
  --coverage.reportsDirectory=/tmp/jini-tr-backend-coverage.uKS5ak/daemon-integration
```

| Package | Test files | Passed | Failed | Skipped | Wall duration | Result |
|---|---:|---:|---:|---:|---:|---|
| agent-runtime | 87 | 1,648 | 0 | 0 | 29.03s | PASS |
| chat-core | 6 | 258 | 0 | 0 | 2.92s | PASS |
| core | 5 | 88 | 0 | 0 | 2.47s | PASS |
| daemon | 15 | 267 | 0 | 0 | 11.64s | PASS |
| deploy | 6 | 94 | 0 | 0 | 12.83s | PASS |
| http | 13 | 254 | 0 | 0 | 19.09s | PASS |
| node-host | 3 | 52 | 0 | 0 | 28.97s | PASS |
| platform (final full coverage run) | 15 | 362 | 0 | 1 | 12.81s | PASS WITH EXCLUSION |
| protocol | 2 | 10 | 0 | 0 | 3.12s | PASS |
| sidecar | 1 | 42 | 0 | 0 | 3.97s | PASS |
| **Total** | **153** | **3,075** | **0** | **1** | — | **Functional suites green, exclusion noted** |

The daemon integration test drives a real ACP child through permission handling, streamed prompting, and successful lifecycle completion. It passed in 2.96s including coverage collection.

## Excluded concurrent download lane

The user explicitly assigned the platform download bug to another worker. During concurrent changes, the full platform suite temporarily failed:

```text
managed download engine > falls back to a full download when Range is not honored
packages/platform/src/__tests__/download.test.ts:288
expected true, received false
```

That run produced 361 passed, 1 failed, and 1 skipped. Two immediate exact-test retries failed identically, so the state observed at that point was deterministic rather than a one-off pass/fail fluctuation. After HEAD advanced to `7a4a94159`, the final full coverage run produced 362 passed and 1 skipped. The committed skip is the named, user-excluded `resumes a partial download when the server supports Range` test at line 254. No download code or tests were modified by TestRunner, and this lane is excluded from the remaining-backend verdict.

## Coverage report

Active profiles supplied by the Coordinator:

- Unit: statements/branches/functions/lines each >= 98%.
- Integration: statements/branches/functions/lines each >= 90%.
- E2E: N/A.

Metrics below are the Big Four in the repository's required order: **statements / branches / functions / lines**. Coverage was parsed from each package's V8 `coverage-summary.json`; `coverage-final.json` supplied uncovered statement, branch, and function locations.

| Package | Statements | Branches | Functions | Lines | Unit-profile result |
|---|---:|---:|---:|---:|---|
| agent-runtime | 99.96% | 99.63% | 99.79% | 99.96% | PASS |
| chat-core | 100% | 100% | 100% | 100% | PASS |
| core | 100% | 100% | 100% | 100% | PASS |
| daemon | 99.86% | 99.71% | 100% | 99.86% | PASS |
| deploy | 99.68% | **79.73%** | 100% | 99.68% | **FAIL — branches** |
| http | 100% | 100% | 100% | 100% | PASS |
| node-host | 100% | 100% | 100% | 100% | PASS |
| platform | 99.47% | **92.50%** | 100% | 99.47% | **FAIL — branches** |
| protocol | 100% | 100% | 100% | 100% | PASS |
| sidecar | 98.15% | **91.71%** | **97.95%** | 98.15% | **FAIL — branches/functions** |

Integration-only daemon coverage is **25.65% statements, 42.51% branches, 50.00% functions, 25.65% lines**. The single explicit integration test passes behaviorally but does not satisfy the 90% integration coverage profile, whether evaluated package-wide or against `agent-executor.ts` alone (42.11/42.85/56.52/42.11).

### Coverage gap list

Priority reflects runtime risk: High for core execution, deploy/API, file/network/process, and IPC paths.

| Priority | File | S/B/F/L | Uncovered counts | Uncovered executable locations | Status |
|---|---|---|---|---|---|
| High | `packages/deploy/src/cloudflare-pages.ts` | 99.54/77.09/100/99.54 | 3 statements, 82 branches, 0 functions, 3 lines | lines 139-140, 195; 82 uncovered branch outcomes across validation, DNS, polling, and response-shape paths | Below |
| High | `packages/deploy/src/reachability.ts` | 100/87.50/100/100 | 0 statements, 9 branches, 0 functions, 0 lines | branch lines 93, 95, 127, 130, 153, 175, 178, 187 | Below |
| High | `packages/deploy/src/vercel.ts` | 100/81.70/100/100 | 0 statements, 15 branches, 0 functions, 0 lines | branch lines 99, 104, 108, 116, 120, 153, 181, 198-200, 206, 212 | Below |
| High | `packages/platform/src/asset-cache.ts` | 99.28/79.77/100/99.28 | 2 statements, 36 branches, 0 functions, 2 lines | statement lines 125-126; 36 uncovered branch outcomes | Below |
| High, excluded lane partly overlaps | `packages/platform/src/download.ts` | 98.60/83.17/100/98.60 | 11 statements, 52 branches, 0 functions, 11 lines | statement lines 312-313, 364-365, 711, 950-951, 965-966, 973-974 | Below |
| High | `packages/platform/src/fs.ts` | 100/90.62/100/100 | 0 statements, 3 branches, 0 functions, 0 lines | branch lines 16, 18, 23 | Below |
| High | `packages/platform/src/proxy-env.ts` | 99.35/97.29/100/99.35 | 2 statements, 4 branches, 0 functions, 2 lines | statement lines 408-409; branch lines 176-177, 194, 407 | Below |
| High | `packages/sidecar/src/json-ipc.ts` | 98.06/88.09/100/98.06 | 6 statements, 10 branches, 0 functions, 6 lines | statement lines 173-178; branch lines 53, 55, 81, 118, 142, 205, 297, 365, 370, 385 | Below |
| High | `packages/sidecar/src/net.ts` | 100/90/100/100 | 0 statements, 1 branch, 0 functions, 0 lines | branch line 18 | Below |
| High | `packages/sidecar/src/port.ts` | 91.37/85.18/83.33/91.37 | 5 statements, 4 branches, 1 function, 5 lines | lines 39-41, 72-73; branch lines 31, 33, 54, 71; function line 39 | Below |
| Medium | `packages/agent-runtime/src/defs/antigravity.ts` | 100/100/85.71/100 | 0 statements, 0 branches, 1 function, 0 lines | function line 85 | Below per-file 98%, aggregate package passes |
| Medium | `packages/daemon/src/delegated-tool-bridge.ts` | 100/96.77/100/100 | 0 statements, 1 branch, 0 functions, 0 lines | branch line 118 | Below per-file 98%, aggregate package passes |

Additional aggregate-pass gaps remain in agent-runtime (`auth.ts:274`, `detection.ts:76`, `json-event-stream.ts:56-57`, `launch.ts:189`, `prompt-budget.ts:183`, `defs/amr.ts:246`, `providers/model-catalog.ts:415`) and daemon (`run-lifecycle.ts:249-250`). They do not fail the suite aggregate but have no active certification rationale. **No valid justification is established by the current pipeline artifacts — coverage triage or an explicit technical exemption is required.**

Pure type/interface files with zero executable counters are treated as exempt rather than uncovered runtime code: chat-core `events.ts` and `artifacts/types.ts`, core `principal.ts`, daemon `run/core/failure-taxonomy.ts`, and protocol `common.ts`.

No touched-file baseline exists in `tasks.md`, so a historical non-regression comparison could not be performed.

## Coverage configuration audit

- `agent-runtime`, `core`, and `node-host` have package-wide coverage includes and machine-readable reporters. Their type-only/typecheck exclusions are documented and technically credible.
- `daemon/vitest.config.ts` measures only `src/tool-executor.ts`; this is a misleading package gate. Honest package-wide coverage currently passes, but the config would not detect future regressions in the rest of daemon.
- `platform/vitest.config.ts` measures only four files (`home-expansion.ts`, `sandbox-env.ts`, `resource-paths.ts`, `terminal.ts`). It omits the lower-covered runtime files responsible for the 92.50% honest branch result.
- `chat-core`, `deploy`, `http`, `protocol`, and `sidecar` have no committed package coverage gate/script. Explicit V8 commands work, but CI/package scripts do not enforce the results. This hides deploy's 79.73% branch result and sidecar's 91.71% branches/97.95% functions.
- Tests are mostly flat `*.test.ts` files. Only daemon's ACP subprocess test is explicitly named as integration. Several suites use real HTTP, TCP, subprocess, filesystem, and OS process behavior but are not classified as integration tests, making independent unit/integration gates ambiguous.

## Test-quality assessment

Strengths observed from execution evidence:

- The suites exercise real components rather than only mocks: Express over real HTTP, ACP child-process transport, TCP/IPC, filesystem state, detached processes, signal escalation, retry behavior, and provider error paths.
- Failure-path depth is substantial in daemon, deploy, HTTP security/origin handling, platform process/file behavior, and agent-runtime stream parsing.
- Test counts are non-zero and substantial; no empty-suite success was observed.

Open quality risks:

- The skipped download-resume regression is a live reliability gap, even though it is excluded from this review at the user's direction.
- Branch assertions are materially incomplete in deploy, platform, and sidecar despite near-100% line coverage. The gap is therefore not cosmetic: execution reaches code without distinguishing many decision outcomes.
- The single explicit integration test is high-signal but far below the active integration coverage profile.
- Missing certification means the suite proves current encoded behavior, not traceability to an approved spec or complete acceptance criteria.
- The platform download lane demonstrated a concurrent-state deterministic failure before the final revision passed, reinforcing that the skipped/racy fixture needs stabilization rather than repeated retries.

## Coordinator classification

- Functional test failures outside the excluded download lane: none.
- `COVERAGE_TRIAGE_REQUIRED`: deploy, platform, sidecar unit-profile gaps; daemon integration-profile gap; per-file high-priority branch gaps.
- `TDD_RECERTIFICATION_REQUIRED` before treating this as pipeline-certified: no active test certification, expected count, spec hash, or requirement-to-test matrix exists.
- Formal convergence: **UNAVAILABLE**, not failed or passed, because expected P1 acceptance tests/invariants are not defined. Observed executable pass rate is 100% outside the one approved skip/excluded lane.

