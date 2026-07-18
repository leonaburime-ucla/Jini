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

## artifacts/ — generic artifact-store kernel port (2026-07-18)

Origin: `apps/daemon/src/artifacts/` (6 files) on the real fork clone
`leonaburime-ucla/open-design`, read directly from `/tmp/od-source` for this
task. Per `docs/jini-port/recon/r1-daemon.md` TASK 1's MIXED-classification
entry for `artifacts/`: "the artifact store concept is a generic engine
port, but OD's artifact = HTML prototype / design output. Extract the store
interface; keep OD's file-kind classification as adapter."

**Home decision: `@jini/daemon`, not `@jini/core`.** Both packages' existing
scope was checked first per the task brief. `@jini/core` (per
`docs/jini-port/extraction-plan.md` §3) owns `ProviderRegistry`/
`ToolRegistry`/DI tokens+resolver/`Principal`/`Authorizer` — pure
registries and composition machinery, not stateful storage. `@jini/daemon`
already owns `RunLifecycle` + the durable `EventLog` kernel port
(extraction-plan §12 C1) via the exact async-port-plus-in-memory-reference-
implementation shape (`event-log.ts` / `createInMemoryEventLog`) this task
needed to mirror for `ArtifactStore` / `createInMemoryArtifactStore`. The
extraction-plan's own §10 roadmap-appendix text also describes artifacts as
tied to runs producing output — kernel-adjacent, matching `@jini/daemon`'s
existing charter. `ArtifactStoreToken` was added to `src/tokens.ts`
alongside `RunLifecycleToken`/`EventLogToken`, same pattern.

**No duplicate primitive.** `@jini/agent-runtime` already has an
`ArtifactTaxonomy` (`isArtifact`/`classify` — a pure path-classification
predicate, ported from OD's `runtimes/run-artifacts.ts` in an earlier task)
whose own doc comment explicitly deferred `ArtifactStore` (actual
create/read/manifest persistence) as "a later storage/sqlite task's
concern" — confirmed by reading that file before starting this one. This
task's `ArtifactStore` is exactly that deferred follow-up, a different
concern (storage, not classification) in a different package — not a
duplicate of `ArtifactTaxonomy`.

### File map

| Jini file | OD origin file(s) | Transform |
|---|---|---|
| `artifacts/manifest.ts` | `artifacts/manifest.ts` | De-branded: `ALLOWED_KINDS`/`ALLOWED_RENDERERS`/`ALLOWED_EXPORTS` (including a literal `'design-system'` kind — OD's own product concept) were hardcoded module constants; now a caller-supplied `ArtifactManifestTaxonomy`. `status` (`'streaming'\|'complete'\|'error'`) kept as a fixed literal union — a generic artifact-lifecycle concept, not a product taxonomy. `sourceSkillId`/`designSystemId` fields collapsed into one generic `sourceContextId` (opaque to the engine). Two coverage-driven refactors (Phase 6.5 category 4): the redundant `typeof manifest.kind/renderer !== 'string'` re-checks after `validateBoundedString` already returned for any non-string value, and the `typeof JSON.stringify(...) !== 'string'` check (always a string for a plain-object argument) — all three replaced with type assertions + comments. `inferLegacyManifest` (OD's HTML/deck/markdown/svg extension-based inference) is **not ported** — see `ManifestInferrer` below. |
| `artifacts/store.ts` | `artifacts/create.ts` | Not a lift: the origin's `createProjectArtifactFile` took OD's own product-shaped workspace/file-tree writer as an injected dependency, and a companion `postCreateArtifactRequest` built a request body for OD's own per-workspace HTTP upload route — neither is a generic engine concern. Defines `ArtifactStore` (create/get/list) + `createInMemoryArtifactStore` reference implementation directly, mirroring `event-log.ts`'s `EventLog`/`createInMemoryEventLog` shape. `resolveArtifactManifest` ports the origin's require-explicit-OR-infer-OR-throw resolution logic (`ArtifactManifestRequiredError`/`ArtifactManifestInvalidError` kept, same codes). `ManifestInferrer` is the injection seam replacing OD's `inferLegacyManifest` call — a no-op default (`noopManifestInferrer` in `manifest.ts`) until a host supplies its own file-kind classification, per the task brief's explicit instruction to keep that OD-owned. |
| `artifacts/publication-guard.ts` | `artifacts/publication-guard.ts` | De-branded: the origin hardcoded `UNRESOLVED_ARTIFACT_PLACEHOLDERS` (5 literal strings lifted from one bundled example template's pitch-deck fill-in-the-blank convention) and `PUBLICATION_GUARDED_ARTIFACT_KINDS = {'html','deck'}`. Both are now a caller-supplied `PublicationGuardConfig` (`guardedKinds` + `blockedPlaceholders`), empty by default (blocks nothing until configured) — the guard *mechanism* is generic, the marker strings were 100% one template's own content. API also folds the kind-gate into `assertArtifactPublicationAllowed` itself (`isPublicationGuardedKind` check now inside the assert) rather than leaving it a separate check the caller must remember to run first, as the origin did — a deliberate port-time design improvement, not a preserved-behavior requirement. |
| `artifacts/runtime-compat.ts` | `artifacts/runtime-compat.ts` | **Not a lift — the seam only.** The origin, `normalizeArtifactRuntimeImports`, is entirely a fix for one specific CDN-bundle bug (rewriting a vanilla Motion UMD `<script>` tag to the `framer-motion` bundle when React-hook usage is detected) that OD's own system prompt steers models toward hitting — pure product/library-specific knowledge, explicitly out of scope per the task brief ("keep OD's specific logic as adapter"). This module defines only the generic `RuntimeCompatNormalizer` hook type + `noopRuntimeCompatNormalizer` default + a `composeRuntimeCompatNormalizers` helper for layering several a host might need; the Motion-CDN fix itself is not ported anywhere. |
| `artifacts/stub-guard.ts` | `artifacts/stub-guard.ts` | De-branded: `STUB_GUARDED_MANIFEST_KINDS = {'html','deck'}` and a literal `.html`/`.htm` sibling-matching extension were hardcoded; `siblingExtensions` is now a caller-supplied config field (`extensionAlternation` builds the regex generically from it). `readArtifactStubGuardConfigFromEnv` read three `OD_ARTIFACT_STUB_GUARD*` env vars (see `source-map.md` for exact original names); renamed `ARTIFACT_STUB_GUARD*` (no product prefix), same three-var shape/defaults. Two coverage-driven refactors (Phase 6.5): a `candidateIdentifiers.length === 0` guard made dead by the preceding regex-match precondition was removed (the next line's `.some()` on an empty array already produces the same `continue`); a `largest === null` guard after a loop that (given the already-checked non-empty `priors`) always assigns on its first iteration was replaced with a non-null assertion + comment. |
| `artifacts/text-suppression.ts` | `artifacts/text-suppression.ts` | The core (`createTaggedTextSuppressor`) was already fully generic in the origin (open/close regex + predicates as parameters, no product coupling) — ported verbatim. De-branded the origin's two pre-built instances: `createDsmlArtifactTextSuppressor` hardcoded OD's own "DSML" two-word tag-family (`<\|DSML artifact>...<\|/DSML\|>`); replaced with `createXmlTagTextSuppressor(tagNames)`, a generic factory over a caller-supplied tag-name list supporting both `<tagName>...</tagName>` and a `<\|tagName>...<\|/tagName\|>` bracket-pipe variant (a different, simpler bracket-pipe convention than OD's own two-word "DSML tagname" form, which doesn't generalize to arbitrary tag names). `createToolCallTextSuppressor` (`<tool_call>`/`<edit>` blocks) is a generic agent-protocol convention, not OD-branded, and is kept as a named instance. Two coverage-driven refactors (Phase 6.5): `compactTagCandidate`'s and the tool-call predicates' `!text.startsWith('<')` checks were dead — their only caller (`possibleTagStart`) always passes a tail slice starting at a `<` position — removed with a comment, keeping only the (real, reachable) `.includes('>')` check. |
| `artifacts/index.ts` | *(new — barrel)* | Re-exports every module above. |

### Not ported / explicitly out of scope

- `artifacts/create.ts`'s `buildCreateArtifactRequestBody`/`postCreateArtifactRequest` — OD's own HTTP request-shape builder for its `/api/projects/:id/files` route; an HTTP route shape is a product/transport-layer surface, not a kernel port concern (an OD adapter's own `@jini/http` pack would own the equivalent request handling against this port).
- `artifacts/manifest.ts`'s `inferLegacyManifest` (the HTML/deck/markdown/svg extension-based classification logic) — OD's own file-kind taxonomy; the `ManifestInferrer` injection seam replaces it, per the task brief's explicit instruction.
- `artifacts/publication-guard.ts`'s `UNRESOLVED_ARTIFACT_PLACEHOLDERS` literal strings — one bundled example template's own pitch-deck content, not a generic mechanism.
- `artifacts/runtime-compat.ts`'s Motion/Framer-Motion CDN-bundle rewrite logic in full — a third-party-library-specific fix, not a generic engine concern.

### Validation

- `pnpm --filter @jini/daemon typecheck` (src + tests): zero errors, zero TS2307.
- `pnpm --filter @jini/daemon test` (full package): 178/178 passing, including the pre-existing `identifier-lint.test.ts` vocabulary-firewall check (a doc-comment `projectId` mention was caught and genericized by this exact lint during this task — the lint earning its keep).
- **Coverage** (`json-summary`+`json` reporters, `pnpm exec vitest run --root . src/artifacts/ --coverage`, real aggregate for the whole `src/artifacts/` folder): **statements 100%, branches 100%, functions 100%, lines 100%** — every individual file at 100% on all four metrics, no exceptions, no coverage-suppression comments anywhere in this task's files.
- **Purity**: `grep -rniE "open[- ]design|\bod_|--od-stamp|/tmp/open-design|@open-design" src/artifacts/` — zero matches. `pnpm guard` (repo root) passes (skeleton, rules pending implementation — see the agent-runtime source-map's identical caveat).
