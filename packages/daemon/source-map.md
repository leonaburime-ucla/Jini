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
