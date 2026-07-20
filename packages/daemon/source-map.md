# `@jini/daemon` — provenance

Origin: fork `leonaburime-ucla/open-design`, branch `arch/server-startserver-endgame`
(local reference clone `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`,
tracked read-only as `refs/remotes/fork/server-endgame`), commit
`f1aabe9e5ac24b48894b135031a65f893a443b2d` (2026-07-03). **This branch closed
PR #5152 without merging** — it is real, complete work (the 4-slice
decomposition of `apps/daemon/src/server.ts` from 8,616 to 3,399 lines), just
not upstream. Every file/line citation below is against this commit, read via
`git show fork/server-endgame:<path>` — the clone itself was never checked out
or modified. All content read: `apps/daemon/src/runtimes/start-chat-run.ts`
(3,715 lines), `apps/daemon/src/runtimes/runs.ts` (473 lines),
`apps/daemon/src/routes/runs.ts` (1,432 lines),
`apps/daemon/src/runtimes/chat-run-lifecycle.ts` (228 lines),
`apps/daemon/src/run-failure-classification.ts` (788 lines),
`apps/daemon/src/run-event-analytics.ts` (204 lines),
`apps/daemon/src/runtimes/run-artifacts.ts` (331 lines),
`apps/daemon/src/run-telemetry.ts` (190 lines),
`apps/daemon/src/runtimes/fire-pipeline-for-run.ts` (94 lines), plus
`git diff main fork/server-endgame --stat -- apps/daemon/src` for the full
touched-file inventory.

Per extraction-plan.md §8 task 5: "RunLifecycle + replayable EventLog
(`@jini/daemon`), runs keyed on `contextRef`." Per §12 C1: the durable
`EventLog` must be a **kernel port**, not assumed in-memory-only.

## File map

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/event-log.ts` | `apps/daemon/src/runtimes/runs.ts` lines ~28-96 (ring buffer: `run.events`/`run.nextEventId`, `emit()`'s push-then-evict), lines ~232-258 (`stream()`'s `Last-Event-ID`/`?after=` replay loop) | **Generalized, not lifted verbatim** — OD's ring is a bare array field on a bigger `run` object with no port boundary; this is a from-scratch `EventLog` port + `createInMemoryEventLog` reference implementation reproducing the same FIFO-cap-at-2000 behavior, plus two things OD's version does **not** have: (1) `dedupeKey` idempotency dedup on `append()` — OD's own `clientRequestId` is threaded through but never deduplicated against (confirmed absent by exhaustive grep of the researched source; new work, not a lift), and (2) a distinguishable `'replay-gap'` result when a reconnect cursor references already-evicted events — OD's `stream()` loop (`record.id > lastEventId`) silently resends whatever is still buffered with no gap detection at all (verified: a client reconnecting with a stale cursor gets no error, no signal, just a truncated-looking-contiguous stream with a real hole in it). This is exactly the neutrality risk extraction-plan §12 C1 flags; closing it was treated as in-scope for a "kernel port," not an OD behavior to preserve bug-for-bug. |
| `src/close-status.ts` | `apps/daemon/src/runtimes/chat-run-lifecycle.ts` — `classifyChatRunCloseStatus` (lines 44-72), `resolveChatRunInactivityTimeoutMs`/`resolveChatRunArtifactQuietPeriodMs` (env>agentDefault>default, clamped cascade) | `classifyRunCloseStatus`: kept only the generic skeleton (cancel-requested → cancelled; exit code `0` → succeeded; else failed). **Dropped** the ACP-forced-shutdown-but-actually-clean escape hatch (SIGTERM/exit-130 with a clean ACP completion flag) and the artifact-quiet-shutdown/non-zero-exit-but-artifact-was-produced escape hatches — both are OD-specific nuance (a specific agent protocol's clean-shutdown signature; OD's design-artifact domain concept) layered on top of a generic tree, not the tree itself. `resolveTimeoutMs`: same env>agentDefault>default>clamp cascade, generalized (caller supplies its own env var name and injects the env source for testability, rather than reading `process.env` and an OD-specific var name implicitly). `createInactivityWatchdog` (new, not a direct lift) extracts the reset-on-activity-then-fire-once *pattern* used throughout `start-chat-run.ts`'s inactivity watchdog — the origin's SIGTERM-then-SIGKILL subprocess escalation on fire is deliberately not included (that's subprocess-signaling detail belonging to `@jini/agent-runtime`, task 7; `onTimeout` is where a driver plugs that in). |
| `src/run-lifecycle.ts` | `apps/daemon/src/runtimes/runs.ts` (`createChatRunService`'s `create/get/list/stream/cancel/wait/emit/finish` — the `design.runs` object) + the terminal-decision half of `apps/daemon/src/runtimes/start-chat-run.ts` (`send()` lines ~1082-1115; `finishWithRetryDecision`/resume-on-failure lines ~1220-1406; the `child.on('close', ...)` handler lines ~3228-3677) | See "Design decisions" below for the full accounting — this is the file that needed the most judgment, not a mechanical port. |
| `src/tokens.ts` | *(new)* | `RunLifecycleToken`/`EventLogToken` via `@jini/core`'s `token()`, following the exact naming convention `packages/core/src/index.test.ts` already established (`RunStoreToken`/`EventLogToken`, suffixed `Token` — not the bare names extraction-plan §2.2's illustrative pseudocode used, since that would shadow the interface names in this codebase's actual test precedent). |
| `src/index.ts` | *(new — barrel)* | Re-exports all four modules above. |

## Design decisions (judgment calls the task brief explicitly asked for)

**1. `RunLifecycle` does not spawn or signal subprocesses.** OD's `cancel()`
(`runs.ts:361-401`) does real tiered signal escalation (ACP `.abort()` → RPC
grace → `SIGTERM` on the process group → grace → `SIGKILL`, all
env-var-tunable). That is deeply subprocess/agent-CLI-adapter-specific and is
explicitly `@jini/agent-runtime`'s territory (task 7), not this task's. This
package's `cancel()` only records intent (`cancelRequested` + notifies
`onCancelRequested` listeners, an `AbortSignal`-shaped but framework-neutral
callback registry) and never itself forces a terminal transition — a driver
observes the signal and calls `finish()` once it knows the real outcome,
exactly mirroring OD's actual invariant that `finish()`/`design.runs.finish`
is the only path to a terminal state, called from the child's real `close`
event, never synchronously from `cancel()` itself.

**2. `resume()` is a generalization, not a literal port.** OD has two
unrelated "resume" concepts (see the research notes cited in the handoff
report): (a) resuming the *external agent CLI's own* session via
`--resume <id>`/ACP `session/load`, persisted in OD's SQLite schema — a
real subprocess/vendor-CLI concern out of scope here — and (b) a
`run.resumable` flag surfaced to the client so a *next user turn* can invoke
(a). Neither is "resume an interrupted daemon-side run object" — that
concept doesn't exist in OD. `@jini/daemon`'s `resume()` builds that concept
fresh: a terminal run with `resumable: true` (set by whoever called
`finish()`) can transition back to `'running'` on the **same `runId`**,
continuing the **same `EventLog` cursor sequence** unbroken — no new `'start'`
event, no cursor reset. This was a deliberate choice to make `resume()`
meaningful and testable at the kernel layer without a real subprocess/session
concept to hang it on; see `characterization.test.ts` for the two-segment
proof (start→agent*→end(failed,resumable)→resume→agent*→end(succeeded), ids
monotonically increasing across the whole thing).

**3. No `RunStore` port was extracted.** Extraction-plan §2.2's illustrative
composition example lists `RunStore` and `EventLog` as siblings a pack
depends on. This task's charter (§8 task 5) names only `RunLifecycle` +
`EventLog` as deliverables. `RunLifecycle`'s own run-status registry
(`Map<runId, RunRecord>`) is therefore an internal implementation detail of
this package's `createRunLifecycle`, not a separately swappable port — a
persistent run registry (surviving a daemon restart, not just an event
replay) is not implemented. **Flagged as a real follow-up**: a future task
(likely task 8, alongside the `@jini/sqlite` durable `EventLog` adapter)
should decide whether `RunLifecycle`'s registry needs its own `RunStore`
port for restart-durability parity with §2.2's example, or whether
`RunLifecycle` itself becomes the thing `@jini/sqlite` backs directly.

**4. The `RunState`/`RunEndPayload.status` spelling mismatch is bridged, not
fixed.** `@jini/protocol`'s `RunState` uses `'cancelled'` (2 L) while
`RunEndPayload.status` uses `'canceled'` (1 L) — this is extraction-plan §12
C5's own cited vocabulary-firewall canary, already present in `@jini/protocol`
before this task started. `packages/protocol` is explicitly out of scope for
this task, so `run-lifecycle.ts` bridges the two spellings with an explicit
`TERMINAL_OUTCOME_TO_END_STATUS` lookup table (with a comment citing this)
rather than silently letting them drift or fixing the upstream package.
`run-lifecycle.test.ts`'s finish() test asserts the bridge explicitly.

**5. Driver-emittable events are a closed, explicit union
(`DriverEmittableInput`)**, not `RunProtocolEvent` minus `'start'`/`'end'`
derived mechanically — `'start'` is only ever produced by `start()`, `'end'`
only by `finish()`; a driver calling `emit()` can only ever produce
`'agent'`/`'stdout'`/`'stderr'`/`'error'`. This mirrors OD's actual invariant
(`'start'` emitted once by the engine right before spawn, `'end'` only from
`design.runs.finish`) as a compile-time-enforced contract rather than a
runtime convention.

**6. `emit()` throws (fails fast) on an unknown or already-terminal run**,
rather than silently no-op'ing. OD's own code pattern is the caller checking
`run.cancelRequested || design.runs.isTerminal(run.status)` defensively
*before* emitting (repeated ~10 times in `start-chat-run.ts` per the
research), i.e. OD treats "don't emit after terminal" as the caller's job,
not something `emit()` itself silently absorbs. This package makes that the
same explicit contract, but surfaces a violation as a thrown error (a driver
bug) instead of a silently-observed defensive check, per this codebase's
fail-fast-defaults convention.

**7. A cancel listener that subscribes after `cancel()` already fired still
receives the notification immediately** (`onCancelRequested` replays the
last request if `cancelRequested` is already true at subscribe time). This
was found and fixed during this task's own mandatory score-skepticism pass
(a plain forward-only listener registry has no memory of past firings, so a
driver attaching late — e.g. after being constructed asynchronously — would
otherwise silently never learn a cancellation was already requested). No OD
equivalent exists to compare against; this is new, `AbortSignal`-inspired
behavior.

## Characterization test methodology

`src/characterization.test.ts` is the extraction-plan §8 task 5 gate's
"OD characterization tests emit the same ordered event sequence" deliverable.
**No live OD daemon or captured event-stream fixture was available in this
environment** to diff against byte-for-byte — the test file's own header
comment documents this explicitly and cites the exact researched-source line
ranges each asserted invariant is drawn from (start-always-first,
`'agent'` sub-payload field-name shapes, end-always-last-and-idempotent,
resume-continues-the-cursor-sequence). This proves `@jini/daemon` reproduces
OD's *documented* ordering contract; it is not a claim of byte-for-byte wire
parity. Full byte-for-byte parity would require either a running OD instance
in this environment or a recorded fixture neither of which existed — flagged
as a real gap for whoever next has access to a live/recorded OD run to
upgrade this test with an actual captured transcript diff.

## Not ported / explicitly out of scope

The overwhelming majority of `start-chat-run.ts`'s 3,715 lines were read and
deliberately **not** ported — see the research notes folded into this
report's companion Programmer handoff for the itemized breakdown. In summary,
dropped as OD-product-specific (not a kernel concern): project/cwd/plugin/
design-system resolution, prompt composition and skill/memory injection,
tool-token minting and MCP config injection, the ~20-vendor-CLI
auth/quota/failure-text pattern library in `run-failure-classification.ts`
(kept only its `isResumableFailure` **category** shape, generalized into
`FinishRunInput.resumable`, not its OD-CLI-specific pattern-matching body),
artifact/asset snapshotting (`run-artifacts.ts`), session-resume persistence
to OD's SQLite schema, Langfuse/PostHog analytics (`run-telemetry.ts`), and
the "plugin pipeline" firing (`fire-pipeline-for-run.ts`, which carries its
own `// @ts-nocheck` + explicit "do not copy this" warning in the origin).
`run-event-analytics.ts`'s pure event-scanning mechanics (tool_use/tool_result
pairing, "did anything visible happen" side-effect detection) were noted as
the most reusable part of that file but were not ported in this task —
they're a reasonable candidate for a future analytics/telemetry extension
point layered on top of `EventLog`, not part of the `RunLifecycle`/`EventLog`
charter itself.

## Dependencies

`@jini/core` (workspace) for `token()` — see `src/tokens.ts`. `@jini/protocol`
(workspace) for `RunEvent`/`RunProtocolEvent`/`RunState`/`RunStatus`/
`RunCancelRequest`/`RUN_PROTOCOL_VERSION`/`isTerminalRunState` — this package
produces/consumes exactly those types, not parallel ones, per the task
brief. `node:crypto` (`randomUUID`) — Node built-in, no new external
dependency.

## artifacts/ — MOVED to `@jini/artifacts` (2026-07-19)

Originally ported here 2026-07-18 as a generic artifact-store kernel port (6 files from OD's
`apps/daemon/src/artifacts/`). Moved out into a standalone `@jini/artifacts` package on
2026-07-19 after the swarm-consensus architecture debate found `ArtifactStoreToken` had been
declared alongside this package's genuine kernel tokens — a real violation of the locked
kernel-noun set (extraction-plan.md §2.1: "NO ... artifacts ... in the kernel"). Full original
provenance, file map, and validation record preserved unedited at
`packages/artifacts/source-map.md`.

## Addendum: `legacy-data-migration.ts` (2026-07-18, Part D of the backend
registry/memory/services/migration task)

Origin: `leonaburime-ucla/open-design`'s `refactor/web-memory-slice` branch
(cloned fresh to `/tmp/od-source`), `apps/daemon/src/migration/` (3 files:
`index.ts` barrel, `legacy-data-migrator.ts`, `update-apply-observations.ts`).
Per `docs/jini-port/recon/r1-daemon.md` TASK 1's `migration/` row: "Legacy-data
migration is generic mechanism but hardcodes OD data layout (inference)." Read
all 3 files in full to confirm/correct that inference:

- **`legacy-data-migrator.ts` — confirmed generic, ported** (as
  `src/legacy-data-migration.ts`). The mechanism (refuse-if-no-proof,
  refuse-if-destination-populated, refuse-if-already-migrated, reject
  symlinks, stage-then-atomically-promote, rollback-on-any-failure) has zero
  OD-specific logic; only the module-level `PAYLOAD_ENTRIES` constant
  (`app.sqlite`, `media-config.json`, `projects`, `artifacts`, ...) and the
  hardcoded `app.sqlite` "proof of real data" check were OD-specific.
  Generalized both into a host-supplied `LegacyDataMigrationConfig`
  (`payloadEntries` + `proofEntry`), threaded through every exported function
  (`dataDirIsEmptyOrFresh`, `legacyDirHasPayload`, `dataDirHasExistingPayload`,
  `migrateLegacyDataDirSync`) instead of a hardcoded module constant. Also
  generalized: the marker file name (`.migrated-from` is now a default, not
  hardcoded), the staging-dir naming prefix (`.od-migrate-` → `.migrate-`),
  and the thrown-error message text (dropped "OD_LEGACY_DATA_DIR"/"Open
  Design"/relaunch-specific wording, kept the operator-actionable structure).
  Simplification: the logger contract's unused `warn` method was dropped —
  the module never calls it (verified: `grep -n 'log.warn'` had zero hits in
  the origin either), so carrying it forward would be untested dead surface,
  not a behavior the port owes callers.
- **`update-apply-observations.ts` — NOT ported, correctly classified
  OD-PRODUCT, not "generic with OD hardcodes."** This is Electron-installer
  apply-across-version-upgrade telemetry: it reads `@open-design/release`'s
  `ReleaseChannel`/`releaseChannelFromVersion`, imports
  `@open-design/contracts/analytics`'s `TrackingUpdateApply*` event-schema
  types, and submits a PostHog `update_apply_observed` analytics event via
  this package's own `analytics.ts`/`app-config.ts` (OD's daemon-local
  telemetry/config modules, not ported). The recon's "generic mechanism but
  hardcodes OD data layout" inference was written for the whole `migration/`
  directory as one row; on a full read this file is not a data-layout
  migration at all — it observes and reports on the *desktop updater's*
  apply-outcome, a product-specific concern (release channels, installer
  artifact types, a fixed analytics event name/property schema) with no
  generic-mechanism core to extract. Skipped, not forced.

## New home decision

Ranked alongside `RunLifecycle`/`EventLog` in `@jini/daemon` because, like
those, it is a daemon-startup-lifecycle concern — the origin's own doc
comment states it runs "at module import time in server.ts, before
`openDatabase` opens SQLite," i.e. before any daemon service starts, which is
exactly this package's charter ("stateful" lifecycle, not a pure-interfaces
package like `@jini/core`).
## `ToolExecutor` — the tool-execution boundary (2026-07-18, port continuation task — Part 3)

**No upstream source. This is original design work, not a port.** Per
extraction-plan.md §2.5/§8 task 6 and confirmed by direct research the same
evening this was built: OD's `apps/daemon/src/runtimes/tool-loop-guard.ts`
only *observes* `tool_use` events to detect runaway repetition — it never
gates a call before it runs, and no admission-control/confirmation/audit
layer exists anywhere in the researched OD source for tool invocation. This
file builds that invariant fresh, against the shape extraction-plan.md §2.5
specifies almost verbatim: `{descriptor, handler, policy}` registration,
`ToolExecutor.execute(principal, run, tool, input, signal)` as the sole
invocation path, an audit trail covering
`requested→authorized→confirmed→started→completed→timed-out→cancelled`,
resumable confirmation, and a transport-injected `ExecutionDelegate`.

### Package split: `ToolRegistry` in `@jini/core`, `ToolExecutor` in `@jini/daemon`

extraction-plan.md §3's locked package table already answers "which
package" precisely, and this port follows it rather than picking a new
answer: `@jini/core` owns `ProviderRegistry, ToolRegistry, DI tokens +
resolver, Principal/Authorizer, pure interfaces`; `@jini/daemon` owns
`RunLifecycle, EventLog/EventSink, AgentExecutor, ToolExecutor, createDaemon
(stateful)`. Concretely: `ToolRegistry` (registration/enumeration, no
timers, no per-call state — a `Map` plus a couple of methods) is exactly
the "pure interface" shape `@jini/core`'s existing `token.ts`/`pack.ts`/
`bindings.ts` already establish. `ToolExecutor` (the audit-record map, the
pending-confirmation map, the per-call `AbortController`/timeout — genuine
runtime state that outlives a single function call) matches
`RunLifecycle`/`EventLog`'s existing shape in this package far better than
it matches anything in `@jini/core`. New files:

| File | Package | Contents |
|---|---|---|
| `packages/core/src/principal.ts` | `@jini/core` | `Principal { id, roles? }` — deliberately minimal per §3 ("Principal/Authorizer, pure interfaces"); anything richer is a consumer concern. |
| `packages/core/src/tool-registry.ts` | `@jini/core` | `RunRef` (a structural `{ id: string }` — no import needed to satisfy it; `@jini/protocol`'s `RunStatus` already has `id: string` and structurally satisfies it, so `@jini/core` gains no new dependency), `ToolDescriptor`, `ToolExecutionContext`, `ToolHandler`, `ToolPolicy`/`AuthorizationDecision`, `ToolRegistration`, the public `ToolRegistry` interface (`register`/`has`/`list` — descriptors only), `createToolRegistry()`, and the package-internal `getToolRegistration(registry, toolId)`. |
| `packages/core/src/internal.ts` | `@jini/core` | Re-exports **only** `getToolRegistration` — see "Handlers never publicly retrievable" below. |
| `packages/core/src/tool-tokens.ts` | `@jini/core` | `ToolRegistryToken`, alongside the service per this package's own token-placement convention. |
| `packages/daemon/src/tool-executor.ts` | `@jini/daemon` | `ExecutionDelegate`, the audit-trail types, `ToolExecutionResult`, the `ToolExecutor` interface, `createToolExecutor()`. |
| `packages/daemon/src/tokens.ts` (edited) | `@jini/daemon` | Added `ToolExecutorToken` alongside the pre-existing `RunLifecycleToken`/`EventLogToken`. |

### "Handlers never publicly retrievable" — how it's actually enforced

The task brief's own words. A `ToolRegistry`'s public methods
(`register`/`has`/`list`) never return a `handler` or `policy` — `list()`
returns `ToolDescriptor`s only. But `ToolExecutor` (a different package)
genuinely needs the full `{descriptor, handler, policy}` triple to do its
job. The registrations themselves live in a module-private `WeakMap<ToolRegistry,
Map<string, ToolRegistration>>` in `tool-registry.ts` — unreachable from the
returned `ToolRegistry` object's own methods — and `getToolRegistration`
is the one function that can read it back out. That function is exported
from `./internal.ts`, **not** from `./index.ts`'s public barrel (verified
by a test: `'getToolRegistration' in publicBarrel === false`), and
`internal.ts` is wired as a separate `./internal` entry in this package's
`package.json` `exports` map rather than a subpath TypeScript/Node would
resolve by accident. This is the realistic boundary a JS/TS package can
actually enforce (there is no language-level "friend package" access
modifier) — a consumer of `@jini/core`'s default entry point cannot reach
a handler; `@jini/daemon`'s `ToolExecutor` is the one caller that imports
`@jini/core/internal` on purpose, and that import is visible in its own
source (`tool-executor.ts`'s own import line), not hidden.

### Design decisions

**1. Authorization vs. confirmation are two distinct gates, not one.**
`ToolPolicy.authorize` (owned by the tool's registration) answers "is this
principal permitted to use this tool at all" — a rule-based decision.
`ExecutionDelegate.onConfirm` (owned by the transport, only consulted when
`ToolDescriptor.requiresConfirmation` is set) answers "does the user want
to proceed with *this specific* invocation right now" — an interactive,
per-call gate. `ExecutionDelegate.onAuthorize` exists too, but only as an
additional veto *after* the policy already allows (e.g. "does this session
actually hold an active grant") — it can turn an `'allow'` into a `'deny'`,
never the reverse, and is never consulted when the policy itself denies
(tested explicitly).

**2. Confirmation resumability is a real parked Promise, not a polling
flag.** When `ExecutionDelegate.onConfirm` doesn't supply a decision
synchronously (returns/resolves `undefined`), `execute()`'s returned
Promise is parked on an internal `Map<executionId, resolve>` and simply
does not settle — `resumeConfirmation(executionId, decision)` is the only
thing that can settle it, and it can be called from a completely separate
tick/request, arbitrarily far in the future, no polling required. This is
the concrete answer to "the headless kernel can't prompt, so the transport
injects an `ExecutionDelegate`": the kernel (`ToolExecutor`) never renders
anything; it hands the transport a notification (the `onConfirm` call) and
waits indefinitely for `resumeConfirmation`, exactly the shape a real UI
approval flow needs. One documented sharp edge: an `async` `onConfirm`
that itself resolves to `undefined` is treated as "the decision is
`undefined`" (i.e. denied) rather than "pending," since the code can only
tell "no decision yet" apart from "the Promise's inner value happens to be
undefined" by checking whether `onConfirm`'s *own return value* is
`undefined` before awaiting it — documented on the interface, not
silently surprising.

**3. Output truncation is a text-output concern, not a general
serialization limit.** `ToolDescriptor.maxOutputBytes` only truncates a
`string` handler result exceeding that length; non-string (structured)
output passes through untouched even when the limit is set. A real
byte-accurate UTF-8 truncation or a generic-JSON-payload cap was judged
out of scope for this task's gate ("output truncation" — proven, not
maximally engineered) — a reasonable follow-up if a real tool handler
starts returning large structured payloads.

**4. `execute()` throws (doesn't return a status) for an unknown tool
id.** Denial/confirmation-denial/timeout/cancellation/failure are all
legitimate business-domain outcomes modeled as `ToolExecutionResult`
variants; calling `execute()` with a `toolId` nothing registered is a
routing/programming bug, not a business outcome, so it's a thrown `Error`
instead — the same distinction OD's own `RunLifecycle`-equivalent code in
this package (`requireRun`) already draws between "unknown id" (throw) and
"legitimate terminal state" (return value).

**5. No persistence.** Like `EventLog`'s in-memory reference
implementation, `createToolExecutor`'s audit records and pending-
confirmation state live only in the process; a real host that needs audit
records to survive a restart, or confirmation to resume across a daemon
restart, layers a durable store behind `getAuditRecord`/`resumeConfirmation`
later. Out of this task's scope (the gate is "one allowed + one denied
tool call, resumable confirmation, timeout, cancellation, output
truncation, and an audit record — no HTTP involved," which this satisfies
in-process).

**6. A `finally` block was deliberately avoided around the handler's
try/catch.** An early draft cleaned up the timeout handle and the active-
`AbortController` map entry in a `finally` clause; istanbul/v8 instruments
try/finally with a synthetic "abrupt completion through finally" branch
that is unreachable here (nothing in the catch block can itself throw a
second exception past the catch), which the coverage-driven pass (Phase
6.5) couldn't close without a contrived test. Repeating the two-line
cleanup at each of the try/catch's own return points instead avoided
introducing that uncoverable branch — a "dead branch, refactor away"
call, same discipline as the agent-protocol port's (Part 1) precedent.

### Validation

`pnpm --filter @jini/core typecheck` / `pnpm --filter @jini/daemon
typecheck`: clean (src + tests). Coverage (`vitest run --coverage`, scoped
per each package's `vitest.config.ts` to this task's new files): `@jini/core`'s
`tool-registry.ts`/`internal.ts` and `@jini/daemon`'s `tool-executor.ts`
all 100% statements/branches/functions/lines. A dedicated test proves each
gate item: one allowed call (full audit trail), one denied call (policy
deny, and separately a delegate-vetoed allow), resumable confirmation
(parked `execute()` settled later by a separate `resumeConfirmation()`
call, proven via a captured `executionId` — both through a real
`ExecutionDelegate.onConfirm` and through `randomUUID` mocked to prove the
no-delegate-at-all path), a timeout (`descriptor.timeoutMs` outliving an
abort-aware handler), a cancellation (`cancel(executionId)` on an in-flight
call, plus an already-aborted and a mid-flight external `AbortSignal`),
output truncation (both the truncated and untruncated string cases, plus
non-string pass-through), and audit-record retrieval (including the
`null` case for an unknown id).

## run/ — generic run-orchestration primitives (2026-07-18)

Origin: `apps/daemon/src/run/` — OD's run capability-barrel
(`analytics/ artifacts/ core/ diagnostics/ tools/`). Only the product-neutral
run-*orchestration* primitives were ported; the execution engine
(`apps/daemon/src/runtimes/`) was already ported to `@jini/agent-runtime` and
is NOT re-ported here.

### File map (`src/run/`)

- `core/result.ts` — `RunResult`, `RunStatusForAnalytics`,
  `runResultFromStatus`, `deriveRunErrorCode`. Faithful lift; the
  "`failed` always carries a non-empty `error_code`" invariant and its
  `AGENT_SIGNAL_*` / `AGENT_EXIT_*` / `AGENT_TERMINATED_UNKNOWN` fallback chain
  are the load-bearing bit. Zero external deps.
- `core/failure-taxonomy.ts` — neutral string-literal unions
  (`RunFailureCategory` / `RunFailureDetail` / `RunFailureStage` /
  `RunFailureResult` / `RunRetryStrategy` / `RunRetrySuppressedReason`)
  replacing the `@open-design/contracts/analytics` `Tracking*` import. The
  single vendor-account-balance detail (`amr_insufficient_balance`) was dropped
  as product-specific; everything else is a generic failure vocabulary. This is
  a declaration-only module (emits no JS under `isolatedModules` /
  `verbatimModuleSyntax`), so it has nothing to cover.
- `core/retry.ts` — the safe-run retry policy: backoff constants,
  `computeRetryBackoffMs` (exponential + equal jitter, injectable `random`),
  and `decideSafeRunRetry` (transient-vs-non-retryable classification + the
  side-effect guards that suppress a retry once a run produced user-visible
  output / a tool call / an artifact). This is the run-orchestration keystone.
  Two redundant `?.` optional-chains on the already-null-checked `failure`
  were dropped (they compiled to an unreachable branch v8 could never cover —
  same dead-branch discipline as `tool-executor.ts`'s `finally` note above).
- `diagnostics/diagnostics.ts` — post-run stderr/stdout tail collection
  (line-count bucketing, last-20-lines + 4 KB byte cap, truncation flags) and
  `summarizeRunDiagnosticsForAnalytics` (scans the event stream for the
  diagnostic source, rpc-close reason, and observed-flag signals). **Genericized
  one dependency:** OD hard-imported `redactSecrets` from a daemon-local
  `redact.ts`; here the tail redactor is an injected `TailRedactor` (identity
  default) so the engine owns the tail *mechanism* while a consumer supplies the
  scrubbing *policy* (e.g. `@jini/core`'s `redactSecrets`). This also keeps the
  module dependency-free.
- `core/index.ts`, `diagnostics/index.ts`, `run/index.ts` — barrels; the root
  `run/index.ts` re-exports only the ported surface (explicit named exports).
  Wired into `src/index.ts`.

### Not ported / explicitly out of scope

- **`runtimes/`** — already ported to `@jini/agent-runtime`; not re-ported.
- **`run/diagnostics/failure.ts`** (the ~800-line `classifyRunFailure`) —
  SKIPPED as product-saturated. It depends on `integrations/vela-errors.ts`
  (a vendor account/auth product module) and `runtimes/auth.ts`, and its body is
  a wall of vendor-specific regex (a specific model-router service, named
  third-party agent CLIs, provider-specific non-English error strings). A
  faithful lift would drag product classification in. The retry keystone stands
  without it: `decideSafeRunRetry` consumes a `RunRetryFailureSignal` that a
  consumer's own classifier supplies. The neutral taxonomy those signals use is
  kept (`failure-taxonomy.ts`).
- **`run/analytics/`** (`analytics.ts`, `lifecycle-tracer.ts`) — SKIPPED as OD
  telemetry. `runtimeTypeForRunAnalytics` / `amrUserIdForRunAnalytics` bind to a
  vendor sign-in status and model-router runtime types; the timing/usage
  summarizers target that product's `run_finished` v2 analytics event and its
  provider-specific token-usage alias matrix. Product, not engine.
- **`run/artifacts/`** (`artifact-fs.ts`, `html-version-snapshots.ts`) —
  SKIPPED (overlap + product). `artifact-fs` depends on
  `runtimes/run-artifacts.ts`'s design-system/preview-module path taxonomy
  (`DESIGN.md`, `preview/*.html` — OD design-output concepts) and overlaps the
  already-ported `src/artifacts/`; `html-version-snapshots` depends on
  `@open-design/contracts` + a product project-file-versioning service.
- **`run/tools/tool-bundle.ts`** — SKIPPED (belongs to the MCP barrel). It is
  squarely MCP-config territory: it depends on `mcp-config.ts`'s
  `sanitizeMcpServer` / `McpServerConfig` (not present anywhere in `@jini/*`;
  a separate `port/mcp-barrel` branch owns that surface) and
  `runtimes/types.ts`'s `RuntimeAgentDef`. Porting it here would either
  duplicate the MCP-config port or create a cross-barrel dependency.

### Environment note

The worktree's `packages/daemon/node_modules` symlinks into the main checkout,
whose `@jini/core` **dist** is stale (missing `redact` / `tool-registry` /
`internal`), which is why the pre-existing `tool-executor.{ts,test.ts}` fail to
typecheck/run here. The ported `run/` modules are deliberately dependency-free
(only relative imports), so all three test files run and typecheck without
touching that stale cross-package dist.

### Validation

`pnpm --filter @jini/daemon typecheck`: no errors in `src/run/**` (the only
remaining errors are the pre-existing `tool-executor` ones from the stale main
dist described above). Coverage (`vitest run` over the three new test files,
`--coverage.include` scoped to the executable modules): `result.ts`,
`retry.ts`, and `diagnostics.ts` all 100% statements / branches / functions /
lines (66 tests). `failure-taxonomy.ts` is declaration-only (no executable
statements). `grep -rInE 'Open Design|OD_|open-design|/tmp/open-design'` over
the changed files: empty.

## `AgentExecutor` — wiring `@jini/agent-runtime` into `RunLifecycle` (2026-07-18)

`RunLifecycle`'s own module doc (this file's earlier "Design decisions" §1
and the file itself) has always named the gap: it owns the run *state
machine* and event log, but "does not spawn or signal a subprocess... A
driver... calls `emit()` for agent/stdout/stderr/error events, observes
cancellation via `onCancelRequested`, and calls `finish()` once it knows the
real outcome." Until this task, nothing in the repo was that driver —
`@jini/agent-runtime`'s registry/launch-resolution/stream-parsers had zero
callers anywhere outside its own package. `src/agent-executor.ts` is that
driver.

### Provenance — control-flow shape reference only, not a lift

OD's real equivalent is not one file: it is the inline `startChatRun`
closure inside `apps/daemon/src/server.ts` (main branch,
`leonaburime-ucla/open-design`, roughly lines 4197–7990 — a ~3,800-line fused
monolith), or the same logic mid-extraction on the
`arch/chat-run-extraction` branch's `apps/daemon/src/runtimes/start-chat-run.ts`.
Both were read (via `git show <ref>:<path>` against the read-only reference
clone at `/Users/la/Desktop/Programming/OSS-Repos/open-design`) for exactly
one purpose: confirming the generic control-flow shape — spawn → per-
`streamFormat` dispatch → `parser.feed`/`flush` → terminal classification →
cancellation escalation — and the exact stdin wire format for
`promptInputFormat: 'stream-json'` (`{"type":"user","message":{"role":"user",
"content":[{"type":"text","text":composed}]}}\n`, confirmed against
`server.ts`'s own `child.stdin.write` call site, ~line 7975). No OD-specific
code was copied; every line in `agent-executor.ts` is new, product-neutral
kernel code informed by that shape.

### File map

| Jini file | Contents |
|---|---|
| `src/agent-executor.ts` | `AgentExecutor` interface, `createAgentExecutor(...)` factory, `translateAgentRuntimeEvent` (the pure event-translation function), the stream-parser dispatch table, spawn/stdin/cancellation wiring. |
| `src/delegated-tool-bridge.ts` | **New, generic composition code** — adapts a Jini-owned delegated tool request to the existing `ToolExecutor`, with canonical run `tool_use`/`tool_result` events and run-cancellation propagation. It intentionally supplies no wire server. |
| `src/tokens.ts` (edited) | Added `AgentExecutorToken` alongside `RunLifecycleToken`/`EventLogToken`/`ArtifactStoreToken`/`ToolExecutorToken`, same convention. |
| `src/index.ts` (edited) | Re-exports `./agent-executor.js`; module doc updated to mention `AgentExecutor`. |
| `package.json` (edited) | Added `@jini/agent-runtime` and `@jini/platform` as direct dependencies (both previously zero-cross-referenced with `@jini/daemon`; `@jini/platform` added directly rather than relied on transitively through `@jini/agent-runtime`, per the task brief — no cycle: neither package imports `@jini/daemon`). |
| `packages/node-host/src/create-local-node-daemon.ts` (edited, different package) | `KernelBoundIds` extended to `'jini.eventLog' \| 'jini.runLifecycle' \| 'jini.agentExecutor'`; `AgentExecutorToken` bound automatically alongside `EventLogToken`/`RunLifecycleToken` via `createAgentExecutor({ lifecycle: runLifecycle })` — a genuine zero-config default (unlike `ToolExecutorToken`, deliberately NOT auto-bound, since it needs a caller-supplied `ToolRegistry` with no sensible default). |

### v1 scope: 18 of 24 registered agent defs

`@jini/agent-runtime`'s registry ships 24 built-in defs. Only the 9 using one
of the four `createXStreamHandler`-family JSON-stream parsers are wired:
`claude-stream-json` (amp, codebuddy, claude), `json-event-stream` (codex,
cursor-agent, opencode, mimo — `mimo` shares `opencode`'s `eventParser`
`kind`), `copilot-stream-json` (copilot), `qoder-stream-json` (qoder).
Confirmed by reading every one of the 9 defs' `buildArgs`/`promptViaStdin`/
`promptInputFormat` fields in full: **all 9 use `promptViaStdin: true`** —
`claude` and `codebuddy` use `promptInputFormat: 'stream-json'`, the
remaining 7 use the default `'text'`. Alongside those JSON-stream adapters,
all 9 `acp-json-rpc` defs (hermes, devin, amr, vibe, kimi, reasonix, kiro,
trae-cli, kilo) now use a separate branch: the real `attachAcpSession`
handshake owns prompt delivery and parsed events; the driver preserves raw
stdio, uses the controller's clean-prompt result rather than its expected
cleanup SIGTERM, and sends cancellation through both ACP and process-tree
termination. Its subprocess integration fixture proves launch → handshake →
audited permission choice → stream → lifecycle completion.

A non-ACP supported def still requires `promptViaStdin: true`; ACP does not,
because its prompt is the `session/prompt` JSON-RPC call.

**Deferred, not built this task** (all still callable/tested inside
`@jini/agent-runtime` itself — only the *driver* wiring is deferred):

- **The one pi-rpc def** (`pi`). It uses the separately-shaped
  `attachPiRpcSession` controller; no driver has been added for it yet.
- **`plain` (5 defs: antigravity, grok-build, aider, deepseek, qwen)** has
  zero existing consuming code anywhere in this codebase — no parser, no
  dispatch branch. The design space (a single final chunk on `flush()`? raw
  passthrough only?) is not decided. `AgentExecutor.run()` rejects these
  cleanly with `AgentExecutorError('AGENT_RUNTIME_UNSUPPORTED', ...)` rather
  than mishandling them silently.

### Design decisions

**1. `resumable` is always `false` in v1.** `RunRetryFailureSignal` (the
richer classification `decideSafeRunRetry`, in `run/core/retry.ts`,
consumes) has no producer anywhere in this codebase — OD's real
~20-vendor-CLI text-matching failure classifier
(`run-failure-classification.ts`, researched but never ported; see this
file's earlier "Not ported" section) was deliberately excluded as its own
substantial, unscoped task. Every `lifecycle.finish()` call
`AgentExecutor` makes — pre-spawn guard failures, spawn errors, and the
real `child.on('close', ...)` terminal transition alike — passes
`resumable: false`. A blanket "not retryable" default is the only honest
answer without a classifier; building one is a separate, unscoped
follow-up, not attempted here.

**2. `turn_end` is not forwarded as an `'agent'` event, and v1 has no
multi-turn stdin-injection loop.** `turn_end` is Claude-stream-specific
(synthesized from an assistant message's `stop_reason`) and has no
`RunAgentPayload` variant — `translateAgentRuntimeEvent` routes it to a
`'turn-end'` translation kind that `run()` reacts to directly (closing
stdin) rather than durably recording. **v1 unconditionally closes stdin on
the first `turn_end` regardless of `stopReason`** — including
`stop_reason: 'tool_use'`, which in a real multi-turn caller would instead
inject the tool's result back into the same open stdin and keep the turn
going. Without that injection loop, a `tool_use`-ending turn's stdin still
closes (rather than hanging forever waiting for a continuation that will
never come); the agent CLI is responsible for deciding how to behave when
its stdin closes mid-tool-use, which each of the 9 defs already handles
via its own inactivity/EOF behavior. Building the real tool-continuation
loop needs `ToolExecutorToken` wiring (deciding what to send back) and is
explicitly out of this task's scope — see the plan's "Explicitly out of
scope" section.

**3. Session-resume ids are an intentional, documented drop.** Some
parsers attach a resumable session handle to their `status` event
(OpenCode's `sessionID`, Codex's `thread_id`/`sess-*`, Qoder's
`session_id`+`qodercliVersion`) — `translateAgentRuntimeEvent`'s `status`
case only carries `label`/`model`/`ttftMs`/`detail` (the fields
`RunAgentPayload`'s `status` variant actually declares), so these ids are
silently dropped at translation time. This is unrelated to
`RunLifecycle.resume()`, which is run-level (does the daemon-side run
object transition back to `'running'`), not CLI-conversation-level (does
the underlying agent CLI continue its own multi-turn session) — persisting
and replaying these ids into a real `--resume`/`session/load` call on a
later turn is a downstream chat-composition concern with no current owner
in this codebase, matching the same "not this package's charter" boundary
this file's earlier §2's "resume" design decision draws.

**4. `translateAgentRuntimeEvent`'s `usage` payload drops every sub-field
`RunAgentPayload`'s narrow `usage` variant has no room for.** The 4 parsers
attach `thought_tokens`, `cached_read_tokens`/`cached_write_tokens`
(opencode/gemini/codex), `modelUsage`/`stopReason`/`isError` (qoder), and a
top-level `stopReason` (claude/copilot) that `RunAgentPayload['usage']`
(only `usage?: {input_tokens?, output_tokens?}`, `costUsd?`, `durationMs?`)
has no field for — dropped, not silently miscoerced. Widening
`RunAgentPayload`'s `usage` shape to carry these is a `@jini/protocol`
change, out of this task's scope (protocol is a separate package with its
own owner).

**5. `error` events carry a minimal `RunErrorPayload`** — `{message}`,
plus `error: {code, message}` only when the parser attached a string
`code` (currently only claude's error event does). The `raw` field some
parsers attach (opencode/gemini/qoder — a stringified copy of the whole
original event, for debugging) is not folded into the error payload; kept
minimal rather than speculatively enriched.

**6. Every `lifecycle.emit()` call is funneled through a per-run FIFO
queue (`enqueueEmit`, private to `wireChildLifecycle`), not fired
independently.** A single stdout `data` chunk can synchronously produce
several parsed events (one JSON line's `feed()` call may invoke a stream
parser's `onEvent` more than once — e.g. Codex's `item.completed` firing
both a `tool_use` guard-check and a `tool_result`), and successive `data`
events must not have their derived `emit()` calls race each other out of
order. Each queued task is individually try/caught (a single failing
`emit()` — e.g. a race against an already-terminal run — does not block
delivery of subsequently queued events), and the `close` handler awaits
the queue fully drained before computing the terminal outcome, so
`finish()`'s `'end'` event is always durably last.

**7. Cancellation escalates the child's full descendant process tree, not
just the direct child.** `@jini/platform`'s `collectProcessTreePids`
(cross-platform: POSIX `ps` / Windows `Get-CimInstance`) plus
`stopProcesses` (SIGTERM → poll-wait → SIGKILL escalation) were both
previously completely unused — zero callers anywhere in this codebase —
despite being an exact fit; `AgentExecutor` is their first real caller.
This catches MCP-server/tool-subprocess descendants an OD-style
POSIX-process-group-only kill would miss.

**8. Native-agent authorization and Jini tool execution are two explicit
paths.** ACP's `onPermissionRequest` seam receives the tool-call metadata and
offered option ids before the ACP agent executes its own tool; without an
injected policy it fails closed, while a runnable host records and chooses an
offered allow/reject/cancel outcome. The
autonomous JSON-stream CLIs still report `tool_use` only after their internal
execution, so their telemetry remains observational. Separately,
`createDelegatedToolBridge` is the actual Jini-tool path: it emits a matching
run event pair around `ToolExecutor.execute`, so registry policy,
confirmation, timeout, cancellation, and the executor audit all apply. It is
transport-neutral by design; an MCP or other server must decode a concrete
delegated request before calling it.

### Explicitly out of scope (same deferral discipline as the node-host keystone)

- `ExecutionDelegate`/`ToolExecutorToken`/HTTP wiring (`mountPackHttp`) —
  separate, already-deferred task per `packages/http/source-map.md`.
- The one pi-rpc def and the 5 `plain` defs — see "v1 scope" above.
- Retry-loop *orchestration* (deciding to start a second run) and
  retry-*signal production* (the failure classifier `decideSafeRunRetry`
  consumes) — both separate, unscoped tasks; `resumable` stays `false`
  throughout (see Design decision 1).
- A concrete HTTP/SSE-exposed "chat pack" wiring `AgentExecutorToken` +
  `RunLifecycleToken` into routes — the natural next layer beyond "create
  `AgentExecutor` and wire agent-runtime into it."
- A generic MCP stdio server shell, persistence, MCP-server injection, prompt composition (skill/memory
  injection, transcript recomposition), and telemetry — all OD-product or
  transport-layer concerns with no kernel-port home; `AgentExecutor`
  receives an already-composed `prompt` string and does nothing to it
  beyond the stdin wire-format wrapping described in Design decision 2's
  neighbor, the stream-json JSONL wrap.

### A pre-existing, unrelated type-emission gap surfaced (not fixed) by this task

`packages/node-host/src/__tests__/create-local-node-daemon.test.ts`'s new
"auto-binds `AgentExecutorToken`... with zero caller config" test could not
call `createLocalNodeDaemon` through its own overloaded compile-time
signature the way the pre-existing `GreeterToken` test does: `@jini/core`'s
`token<T, const Id extends string = string>(id, opts)` is meant to infer
each token's literal id type via the `const` type-parameter modifier, but
every kernel token this package exports — `EventLogToken`/`RunLifecycleToken`
included, not just the new `AgentExecutorToken` — round-trips through
`@jini/daemon`'s *compiled* `dist/tokens.d.ts` as `Token<T, string>`
(widened, confirmed by inspecting the emitted declaration file directly),
defeating `MissingTokenIds`'s literal-id-based exclusion for any pack
depending solely on a dist-imported kernel token. This has apparently never
been hit before because the existing `create-local-node-daemon.typecheck.ts`
proof only exercises a token declared *inline in the same compilation unit*
(`GreeterToken`), which infers its literal id correctly. The new node-host
test calls `createLocalNodeDaemon` through a narrowed function-type cast
(the same "bypass the compile-time generic gate to reach the runtime path"
pattern `packages/core/src/__tests__/index.test.ts`'s `createDaemonUnsafe`
already established) to prove the *runtime* wiring, which is what that test
is actually for. Fixing the underlying `@jini/core`/`@jini/daemon` type-
emission gap is out of this task's scope — flagged here as a real,
independently-actionable follow-up.

### Validation

- `pnpm --filter @jini/daemon exec tsc -p tsconfig.json --noEmit`: clean.
- `pnpm --filter @jini/daemon exec vitest run src/__tests__/agent-executor.test.ts --coverage --coverage.include='src/agent-executor.ts'`:
  46 tests, **100% statements/branches/functions/lines**.
  `pnpm --filter @jini/daemon exec vitest run --coverage --coverage.include='src/**'`
  (whole package, regression check): 350/350 tests pass, no regressions;
  `agent-executor.ts` itself still 100/100/100/100 (the run's aggregate
  threshold failure is entirely pre-existing gaps in files this task did
  not touch — `run-lifecycle.ts`/`close-status.ts`/`event-log.ts`,
  confirmed via `git diff --stat main` showing zero changes to those three
  — plus the top-level `index.ts`/`tokens.ts` barrel files' structural 0%,
  which predates this task and matches the same pattern the untouched
  `src/artifacts/index.ts` vs. non-barrel-file split already shows).
- `pnpm --filter @jini/node-host exec tsc -p tsconfig.json --noEmit` and
  `create-local-node-daemon.typecheck.ts`'s `@ts-expect-error` proofs:
  clean, unmodified.
- `pnpm --filter @jini/node-host exec vitest run --coverage --coverage.include='src/**'`:
  50/50 tests, 100% on all 4 metrics for every file including
  `create-local-node-daemon.ts`.
- `pnpm typecheck` (repo-wide): clean, every package "Done", exit 0.
- `pnpm guard`: `[guard] ok`.
- `grep -rInE 'Open Design|OD_|open-design' packages/daemon/src packages/node-host/src`: empty.
