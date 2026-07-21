# Code Review: backend coverage push (2026-07-20)

## Review target and verdict

- Commit reviewed: `7a4a94159` (`HEAD^..HEAD`), 50 files, 7,370 insertions / 115 deletions.
- Scope: backend package source and tests in the commit. Frontend is out of scope. The known `packages/platform/src/__tests__/download.test.ts` resume flake and its associated `download.ts` lane are explicitly excluded because another agent owns that bug.
- Mode: advisory review. There is no active-spec ID/version/hash, test certification, Programmer function-quality table, or Coordinator verification packet for this commit.
- Verdict: **NOT SHIP-READY**. The new tests materially improve backend coverage, but one production SSE defect can corrupt run-lifecycle completion, the OpenCode change contradicts its own anti-masquerade rule, deploy calls can hang indefinitely, several asserted invariants are not actually tested, one sidecar test is intentionally OS-allocation-dependent, and the checked-in coverage gates do not substantiate the commit's “whole backend / real 100%” claim.

## Required findings

### R1 — Critical: an SSE client write failure leaks its subscription and can make later run operations reject or hang

**Classification:** `IMPLEMENTATION_FIX_REQUIRED`  
**Coordinator route:** Programmer, then TDD recertification

`registerRunEventStream` subscribes before flushing replay events. If `res.write` throws during that flush, the catch ends the response but does not invoke `unsubscribe` ([packages/http/src/runs.ts](../../../packages/http/src/runs.ts#L179), lines 179-220). A later live event invokes the leaked callback; its `res.write` exception propagates synchronously through the lifecycle subscriber loop ([packages/daemon/src/run-lifecycle.ts](../../../packages/daemon/src/run-lifecycle.ts#L220), lines 220-226). On `finish`, subscriber notification occurs before terminal waiters are resolved ([packages/daemon/src/run-lifecycle.ts](../../../packages/daemon/src/run-lifecycle.ts#L428), lines 428-436), so the leaked callback can reject `finish` and leave `waitForTerminal` callers unresolved.

The new test deliberately creates the failure but asserts only `res.end()` ([packages/http/src/__tests__/runs.test.ts](../../../packages/http/src/__tests__/runs.test.ts#L556), lines 556-574). It therefore passes while the resource leak and lifecycle corruption remain.

Required fix:

- make stream shutdown idempotent and always unsubscribe before/while closing after any header/write failure;
- isolate response-writer failures so a transport subscriber cannot throw through `RunLifecycle.emit` or `finish`;
- add a test that fails a replay/live write, then emits and finishes the run, asserts both operations still resolve, terminal waiters resolve, and no further write is attempted.

### R2 — High: `pickServiceErrorMessage` now returns arbitrary embedded `message` content despite its stated security/correctness invariant

**Classification:** `IMPLEMENTATION_FIX_REQUIRED` + `TDD_RECERTIFICATION_REQUIRED`  
**Coordinator route:** Programmer; Security Agent should review the log trust-boundary decision

The comment says unrelated tool-schema or prompt `message` keys must not masquerade as service failures, but the implementation now returns the first nonmatching message as a fallback ([packages/agent-runtime/src/opencode-log.ts](../../../packages/agent-runtime/src/opencode-log.ts#L80), lines 80-104). That arbitrary value is then passed to the broader generic classifier ([packages/agent-runtime/src/opencode-log.ts](../../../packages/agent-runtime/src/opencode-log.ts#L141), lines 141-149), whose patterns include phrases not present in the local keyword gate, such as `billing hard limit`, `bad gateway`, `internal server error`, and `provider error` ([packages/agent-runtime/src/auth.ts](../../../packages/agent-runtime/src/auth.ts#L243), lines 243-266). Thus embedded request content can be mislabeled as an auth/rate/upstream provider failure.

The new/retained test at [packages/agent-runtime/src/__tests__/opencode-log.test.ts](../../../packages/agent-runtime/src/__tests__/opencode-log.test.ts#L183) (lines 183-186) does not pin the changed behavior: it uses text that both old and new implementations classify as `null`.

Required decision/fix: conservatively restore `return null`, or define and parse the actual OpenCode error-object boundary rather than scanning every `message` key. If the divergence is intentionally retained, document it as an upstream divergence and add both positive fixtures and anti-masquerade cases using prompt/tool-schema messages containing every broader classifier-only phrase.

### R3 — High: deploy provider operations have no timeout or cancellation contract and can hang forever

**Classification:** `IMPLEMENTATION_FIX_REQUIRED` + `ARCHITECTURE_REVIEW_REQUIRED`  
**Coordinator route:** Software Architect for the public port, then Programmer/TDD

`DeployTarget.publish` and `checkReachability` expose no `AbortSignal` or deadline ([packages/deploy/src/types.ts](../../../packages/deploy/src/types.ts#L44), lines 44-79). Vercel creation and polling use global `fetch` without a signal ([packages/deploy/src/vercel.ts](../../../packages/deploy/src/vercel.ts#L74), lines 74-112; lines 145-157). Cloudflare performs many sequential and batched calls with the same omission, including project lookup/create, upload-token retrieval, asset checks/uploads, hash upserts, DNS, domain, and deployment calls ([packages/deploy/src/cloudflare-pages.ts](../../../packages/deploy/src/cloudflare-pages.ts#L301), lines 301-397; additional calls at lines 423-460, 601-613, and 809).

An upstream socket that never settles leaves publishing permanently pending; the fixed Vercel poll count does not bound the duration because each individual fetch is unbounded. The extensive new provider tests mock only settling responses and contain no hung-request/cancellation contract.

Required fix: establish an architect-approved deadline/cancellation contract on the deploy port, apply a bounded signal to every provider call and poll delay, define the resulting `DeployError`, and test timeout/caller-abort behavior without wall-clock sleeps. This is especially important because `@jini/deploy` still awaits sign-off for inclusion in the locked package architecture.

### R4 — High: coverage evidence does not support the commit's whole-backend / 100% claim

**Classification:** `TEST_EVIDENCE_INVALID` + `COVERAGE_TRIAGE_REQUIRED`  
**Coordinator route:** TestRunner/TDD Agent

The commit message and handoff claim real measured 100% backend coverage, but no coverage artifact, expected/executed inventory, test-file hashes, or verification packet is retained. More importantly, the gates are structurally incomplete:

- platform's threshold includes only `home-expansion.ts`, `sandbox-env.ts`, `resource-paths.ts`, and `terminal.ts`, explicitly excluding the newly tested `command.ts`, `http.ts`, `process.ts`, `proxy-env.ts`, `toolchain.ts`, and `asset-cache.ts` ([packages/platform/vitest.config.ts](../../../packages/platform/vitest.config.ts#L5), lines 5-28);
- daemon's threshold includes only `src/tool-executor.ts`, not the newly expanded lifecycle/event-log/bridge/executor coverage ([packages/daemon/vitest.config.ts](../../../packages/daemon/vitest.config.ts#L5), lines 5-23);
- chat-core, deploy, HTTP, protocol, and sidecar have no package coverage threshold configuration;
- core's new package-wide 99% gate is useful, but it cannot certify other packages ([packages/core/vitest.config.ts](../../../packages/core/vitest.config.ts#L3), lines 3-27).

Required fix: define the exact backend denominator, extend package gates to all executable source in that denominator with documented zero-runtime exclusions only, retain machine-readable summaries, and provide a certification/verification packet matching the reviewed commit hash. Until then, percentages are informative local measurements, not a release gate.

### R5 — High: the sidecar exhaustion test is nondeterministic and its title overstates what its setup guarantees

**Classification:** `TDD_RECERTIFICATION_REQUIRED`  
**Coordinator route:** TDD Agent

The test claims every ephemeral port returned across all 20 attempts is already reserved, but it actually probes one OS-assigned port and assumes rapid future `bind(0)` allocations will be sequential within the next 1,000 port numbers ([packages/sidecar/src/__tests__/index.test.ts](../../../packages/sidecar/src/__tests__/index.test.ts#L384), lines 384-400). The comment admits this is empirical and platform-specific. Different kernels, concurrent processes, allocator randomization, or a probe near 65535 can return a port outside the set, making `allocatePort` succeed and the test fail.

Required fix: inject the ephemeral-listen seam (or extract the bounded selection loop) and feed 20 deterministic reserved ports, then a 21st free case. Do not use real OS allocation to force an internal retry-budget branch.

### R6 — Medium: several tests claim cleanup/single-flight invariants but would pass if the relevant production guard were deleted

**Classification:** `TDD_RECERTIFICATION_REQUIRED`  
**Coordinator route:** TDD Agent

- The delegated-tool test says it verifies listener removal, then calls `AbortController.abort()` a second time ([packages/daemon/src/__tests__/delegated-tool-bridge.test.ts](../../../packages/daemon/src/__tests__/delegated-tool-bridge.test.ts#L270), lines 270-310). `abort()` dispatches only once and the production listener was registered with `{ once: true }`; the assertion still passes if the explicit `removeEventListener` cleanup at [packages/daemon/src/delegated-tool-bridge.ts](../../../packages/daemon/src/delegated-tool-bridge.ts#L91) (lines 91-120) is removed. Instrument `addEventListener`/`removeEventListener` and test normal completion before abort, which is the path where explicit cleanup matters.
- The rehydrate test calls the method concurrently and again after completion, but only asserts the final reconstructed state ([packages/daemon/src/__tests__/run-lifecycle.test.ts](../../../packages/daemon/src/__tests__/run-lifecycle.test.ts#L124), lines 124-140). Reprocessing an idempotent terminal log yields the same assertion. Gate `listRunIds`/`replay` and assert exactly one hydration pass for overlap and post-completion calls; include failure/retry semantics.
- The real-process SIGTERM/SIGKILL tests spawn long-lived children without a `finally` cleanup or a bounded readiness wait ([packages/platform/src/__tests__/process.test.ts](../../../packages/platform/src/__tests__/process.test.ts#L499), lines 499-548). A failed assertion or an early rejection can leave a child behind; the “ready” promise itself can wait forever. Track spawned PIDs and force cleanup in `afterEach`/`finally`, with a bounded readiness promise.

### R7 — Medium: model tests manufacture impossible typed states solely to cover dead defensive branches

**Classification:** `TDD_RECERTIFICATION_REQUIRED` + `IMPLEMENTATION_FIX_REQUIRED`  
**Coordinator route:** Programmer/TDD Agent

Two tests cast `fallbackModels` to `undefined` and to `[0, ...]`, explicitly acknowledging that real definitions are well-formed ([packages/agent-runtime/src/__tests__/models.test.ts](../../../packages/agent-runtime/src/__tests__/models.test.ts#L163), lines 163-180). The production contract requires an array of runtime model options; the `Array.isArray` and falsy-first-item branches exist only for states TypeScript excludes ([packages/agent-runtime/src/models.ts](../../../packages/agent-runtime/src/models.ts#L72), lines 72-94). The protection is also incomplete: other malformed entries such as `null` can still throw inside `.some(m => m.id ...)`.

Required fix: either validate unknown plugin/runtime definitions once at their boundary with a complete malformed-input contract, or remove the unreachable guards and coverage-only casts. Selective impossible-state tests inflate branch coverage without certifying a real supported behavior.

## Recommended findings

### M1 — Replace coverage-padding barrel/internal-helper assertions with stable public-contract tests

The new daemon barrel test checks a hand-picked subset with `toBeDefined` while claiming the full top-level value surface ([packages/daemon/src/__tests__/index.test.ts](../../../packages/daemon/src/__tests__/index.test.ts#L1), lines 1-53). The deploy barrel test begins with similarly shallow runtime-kind assertions ([packages/deploy/src/__tests__/index.test.ts](../../../packages/deploy/src/__tests__/index.test.ts#L1), lines 1-19), though its publish behavior tests are valuable. Chat artifact tests directly import deliberately internal `markdown-context` helpers for trivial branch coverage ([packages/chat-core/src/__tests__/artifacts.test.ts](../../../packages/chat-core/src/__tests__/artifacts.test.ts#L870), around lines 870 onward).

Prefer an exact, intentional public export contract (plus compile-time type imports) and behavior through public entry points. Internal pure helpers should be exercised through parser outcomes unless they own an independently meaningful contract.

### M2 — Trim compiler-proof and line-by-line narration comments after the coverage pass

The source changes add many comments that explain non-null assertions, regex capture facts, and exact branch mechanics rather than durable domain invariants—for example [packages/agent-runtime/src/defs/amr.ts](../../../packages/agent-runtime/src/defs/amr.ts#L59) and several artifact parser/validator helpers. Some are useful, but the volume makes the small transformations harder to scan and substitutes prose for stronger types in places. Keep comments that explain upstream divergence, trust boundaries, or non-obvious invariants; remove comments that merely restate the next expression.

## Package-level test-quality verdict

| Package | Verdict | Review note |
|---|---|---|
| `agent-runtime` | **Needs changes** | Good retry/cache/ACP edge coverage; blocked by the unpinned OpenCode divergence and impossible-state model tests. |
| `chat-core` | **Pass with recommendations** | Broad parser, recovery, validation, streaming, and answer-format coverage with strong observable assertions. A few internal-helper tests are coverage padding. Property-based parser/serializer invariants would add value. |
| `core` | **Pass for package** | Small public-surface tests plus a useful package-wide 99% gate; does not establish backend-wide coverage. |
| `daemon` | **Needs changes** | Many meaningful lifecycle, event-log, cancellation, error, and concurrency tests. Cleanup and single-flight claims need assertions that fail when guards are removed. |
| `deploy` | **Needs changes** | Exceptional breadth across Cloudflare/Vercel happy and error paths. Missing the highest-risk hung-request/cancellation behavior and lacks a package threshold. |
| `http` | **Blocked** | Strong route/error/reconnect breadth, but its new SSE failure test exposes rather than prevents a lifecycle-corrupting subscription bug. In-memory Express doubles also need at least one real transport contract test. |
| `node-host` | **Pass** | Focused error/listen coverage; existing package-wide 100% gate is the strongest evidence in this set. |
| `platform` | **Needs changes** | Excluding the separately owned download flake, the new command/process/proxy/toolchain/asset tests are mostly behavior-rich and include real subprocess/filesystem checks. Process cleanup is unsafe and the coverage gate excludes most newly tested files. |
| `protocol` | **Pass** | Appropriate small runtime barrel/token assertions; type purity remains primarily a typecheck/guard concern. |
| `sidecar` | **Needs changes** | Good path, IPC, filesystem, and real socket coverage; the exhaustion case is intrinsically flaky. |

## Function Quality Assessment

- Status: **BLOCKED**
- Assessment units reviewed: **18 materially changed units**, with related tiny helpers grouped under their parent transformation where appropriate.
- Lowest score: **55/100** — `registerRunEventStream` (transport failure cleanup and failure isolation).
- Critical findings: **1**
- High findings: **4** (`pickServiceErrorMessage`, deploy publish/poll effect boundaries, coverage/test-evidence design, deterministic sidecar retry testing).
- Missing assessments: **18 in the Programmer handoff table**. Source-level `@overallScore` tags exist on some older deploy functions, but there is no commit-scoped assessment inventory tying scores to the changed units.
- Missing handoff-table evidence: **yes**.
- Missing score-skepticism evidence: **yes**. Several functions retain or claim `100/100` while this review found unbounded I/O and unsupported test evidence.
- Missing adversarial aggregate/cross-item evidence: **partial**. Parser/retry/event-log suites contain good adversarial examples; subscriber failure propagation, deploy hangs, and deterministic retry exhaustion are missing.
- Required fixes: R1-R7 above.
- Recommended refactors: exact public export contracts, property-based parser invariants, concise invariant-focused comments.
- Suggested Coordinator classification: `IMPLEMENTATION_FIX_REQUIRED`, `TDD_RECERTIFICATION_REQUIRED`, `TEST_EVIDENCE_INVALID`, `ARCHITECTURE_REVIEW_REQUIRED`, and `SECURITY_REVIEW_REQUIRED` for the OpenCode log boundary.

Representative reassessment:

| Unit | Score | Main reason below 100 |
|---|---:|---|
| `registerRunEventStream` | 55 | leaked subscription; writer exceptions cross the lifecycle boundary and can strand terminal waiters |
| `pickServiceErrorMessage` / extraction fallback | 65 | contradicts its anti-masquerade invariant and lacks a test that distinguishes the behavior change |
| Vercel `publish` + polling | 78 | global effects, no injected fetch/clock, no per-call deadline/cancellation |
| Cloudflare publish/upload workflow | 78 | many unbounded sequential external effects and no caller cancellation contract |
| `fetchVelaRemoteModelsWithRetry` | 92 | improved retry evidence; hidden timing/effect dependencies remain but are bounded |
| `detectAgents` / probing helpers | 93 | readable and well covered; orchestration still depends on process/environment effects |
| artifact manifest/parser/recovery/strip/validation changes | 92-97 | broad adversarial examples; some direct internal-helper coupling and prose-heavy proof comments |
| question-form parsing helpers | 94 | strong examples and edge cases; generative round-trip/termination properties remain absent |

## Verification evidence and limitations

- Review evidence source: `git show` / `git diff HEAD^..HEAD` for commit `7a4a94159`, direct source reads, locked architecture docs, package source maps, and the handoff at `ADS-memory/reports/session-handoff-2026-07-20-coverage-push.md`.
- Codebase graph: graph-first discovery was attempted. The current Jini artifact was present under `.codebase-memory`, but the configured CLI/MCP project registry could not query that project, so the review fell back to the authoritative commit diff and direct source reads as permitted by repository instructions.
- Targeted local execution by Code Review: `@jini/http` `runs.test.ts` — **50/50 passed**; `@jini/sidecar` `index.test.ts` — **42/42 passed**. These green runs do not invalidate R1 or R5; they demonstrate the current assertions pass.
- Full executed vs expected count: **not supplied to Code Review; owned by TestRunner**.
- Active spec hash: **missing**.
- Certified test-file hashes: **missing**.
- Required-suite status: **not supplied**.
- Coverage status: **invalid as a release gate** for the reasons in R4; claimed local measurements are not retained/commit-scoped verification evidence.
- Flaky-test status: the separately owned download flake is excluded; the sidecar exhaustion test remains an unapproved deterministic-risk finding.
- Review gate verdict: **BLOCKED / advisory only** until required implementation and TDD findings are fixed and a same-commit verification packet is supplied.

## Security surface summary

- **Requires focused Security Agent review:** the OpenCode log parser treats agent/provider logs and embedded request content as a trust boundary; the fallback currently permits content masquerading as a provider failure.
- Asset-cache SSRF coverage is one of the stronger suites in the commit: it covers literal private addresses, DNS-rebinding shape, redirects/connection-time validation seams, size caps, and stream cancellation. This review did not identify a new SSRF regression in that lane.
- HTTP same-origin tests cover create/cancel mutation routes, but the route suite is built on an in-memory app/response double. Preserve at least one real Express/socket integration test for header, close, and streaming semantics.
- The win32 download hardening and known download flake were not reassessed because that entire bug lane was explicitly assigned elsewhere.

