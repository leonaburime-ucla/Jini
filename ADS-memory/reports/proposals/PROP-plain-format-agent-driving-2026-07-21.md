# Proposal: driving `plain`-format agent defs in `AgentExecutor` (antigravity, grok-build, aider, deepseek, qwen)

**Status:** Proposal only — not implemented. No code was written or changed in `packages/daemon/**` or
`packages/agent-runtime/**` as part of this document, per this task's explicit instruction. Requires
Coordinator/Software Architect sign-off before any dispatch branch is added to
`packages/daemon/src/agent-executor.ts`.

**Scope note:** this closes the research half of the one remaining gap `packages/daemon/source-map.md`'s
`AgentExecutor` section names in its module doc and its "v1 scope"/"Deferred, not built this task" notes:
19 of 24 registered `@jini/agent-runtime` defs are driven (9 JSON-stream, 9 ACP, 1 pi-rpc, the last closed
2026-07-21 per that file's own "driving the pi-rpc def" addendum); the 5 `streamFormat: 'plain'` defs
(antigravity, grok-build, aider, deepseek, qwen) have zero driving logic — `run()` rejects them cleanly
with `AgentExecutorError('AGENT_RUNTIME_UNSUPPORTED', ...)`. This document answers "what does OD's real
daemon actually do for these 5" and proposes design options for closing the gap; it does not close it.

## 1. The 5 defs, read in full

All 5 read from `packages/agent-runtime/src/defs/{antigravity,grok-build,aider,deepseek,qwen}.ts`. Every
one declares `streamFormat: 'plain'`; nothing else about them is uniform:

| def | prompt delivery | notable fields | source |
|---|---|---|---|
| `antigravity` | `promptViaStdin: true` (`agy -p -`) | writes `~/.gemini/antigravity-cli/settings.json` as a side effect of `buildArgs` when a concrete model is selected; a module-level `acquireAntigravityModelLock`/`waitForAgyToReadModel` pair (exported, not called by `buildArgs` itself) serializes concurrent spawns against that shared file; `--log-file` used only for post-exit diagnostic classification, not the actual reply | `defs/antigravity.ts:170-255` |
| `grok-build` | `promptViaFile: true`, `promptViaStdin: false` — `buildArgs` **throws** if `runtimeContext.promptFilePath` is absent | `reasoningOptions`, a `listModels` live-probe parser | `defs/grok-build.ts:52-108` |
| `aider` | neither — prompt goes straight into argv via `--message <text>` | `maxPromptArgBytes: 30_000` | `defs/aider.ts:5-64` |
| `deepseek` | neither — prompt is a positional argv value (`exec --auto <prompt>`) | `maxPromptArgBytes: 30_000`, `fallbackBins: ['codewhale']`; its own comment states streaming is left on deliberately: *"skipping `--json` keeps deltas streaming live instead of batched into one trailing summary object at end-of-turn"* | `defs/deepseek.ts:5-54`, streaming claim at lines 30-32 |
| `qwen` | `promptViaStdin: true` | simplest of the 5 — no file/argv concerns | `defs/qwen.ts:5-30` |

**Prompt delivery is not uniform across the 5**: 2 use stdin (antigravity, qwen — the one mechanism
`AgentExecutor` already supports for the 9 JSON-stream defs), 1 uses a staged prompt file (grok-build), 2
use raw argv with a byte-budget guard (aider, deepseek). `@jini/agent-runtime` already ships the generic
machinery for the latter two shapes — `packages/agent-runtime/src/prompt-file.ts`'s
`preparePromptFileForAgent` and `packages/agent-runtime/src/prompt-budget.ts`'s `checkPromptArgvBudget` /
`checkWindowsCmdShimCommandLineBudget` / `checkWindowsDirectExeCommandLineBudget` — but confirmed by
`grep -n 'promptViaFile\|maxPromptArgBytes' packages/daemon/src/agent-executor.ts`: **`AgentExecutor`
calls none of them.** Its current guard (`agent-executor.ts:910`, `if (streamFormat !== 'acp-json-rpc' &&
def.promptViaStdin !== true)`) rejects grok-build/aider/deepseek on prompt-delivery shape alone, before
even reaching the earlier `isSupportedStreamFormat` rejection on `streamFormat`. `qwen` is the only one of
the 5 that would already clear the stdin guard — it is the cheapest test case for the pure
"how do we consume plain stdout" question, decoupled from prompt-delivery plumbing.
`AgentExecutorRunInput` (`agent-executor.ts:327-333`) also has no `options`/`runtimeContext` field at
all today — `run()` calls `def.buildArgs(input.prompt, [])` with no third/fourth argument, so even a
`promptViaFile`-only fix would need `AgentExecutorRunInput` widened before `grok-build.buildArgs` (which
throws without `runtimeContext.promptFilePath`) could be called at all.

## 2. What OD's real daemon does for these 5 — ground truth

Read from `leonaburime-ucla/open-design`, branch `refactor/web-memory-slice`, via the pre-existing local
clone at `/Users/la/Desktop/Programming/OSS-Repos/open-design` (remote `fork`, ref
`fork/refactor/web-memory-slice` — already present locally, no fetch needed). `apps/daemon/src/server.ts`
is the same ~8,600-line fused monolith `packages/daemon/source-map.md`'s `AgentExecutor` section already
cites as `AgentExecutor`'s only real-world control-flow reference (a different branch/commit of the same
file); this section extends that citation specifically for the `plain` dispatch arm, which that earlier
research pass did not read in full.

### 2a. OD does drive all 5 — this is not a vestigial registry entry

Confirmed real, wired, non-dead code — not a "registered but unused" def:

- **A dedicated per-`streamFormat` dispatch chain exists** in `server.ts`'s big `if/else if` ladder
  (`claude-stream-json` → `qoder-stream-json` → `copilot-stream-json` → `pi-rpc` → `acp-json-rpc` →
  `json-event-stream` → ...), confirmed at `server.ts:7011,7113,7118,7133,7186,7269`. **There is no
  `else if (streamFormat === 'plain')` branch** — plain is the implicit final `else`, split into two
  sub-cases by `def.id`, not by `streamFormat`:
  - `server.ts:7282`: `} else if (def.id === 'antigravity') {` — bespoke handling, described below.
  - `server.ts:7298`: `// Plain / BYOK mode: guard raw stdout chunks (#3247).` — the generic fallback that
    grok-build, aider, deepseek, and qwen all fall into (nothing in this branch keys off `def.id`).

### 2b. The generic plain branch (grok-build, aider, deepseek, qwen) — live, per-chunk, no structured parsing

`server.ts:7298-7320` wires `child.stdout.on('data', ...)` directly (no `feed()`/`flush()` stream-parser
object the way the JSON-stream formats get). For each chunk, in order:

```
const strippedText = visibleStdoutControlStripper.write(text);   // strip ANSI/terminal control sequences
const visibleText = titleMarkerStripper.strip(strippedText);      // OD's own chat-title marker syntax
const safe = guardTextDelta(visibleText);                         // role-marker-fabrication contamination guard
if (safe.length > 0) {
  noteFirstTokenAt();
  send('stdout', { chunk: safe });
}
```

(`server.ts:7304-7312`; `guardTextDelta`/`runGuard` defined at `server.ts:6743,6756`, backed by
`createRoleMarkerGuard`.) Two findings this establishes directly, both load-bearing for §3 below:

1. **The 4 non-antigravity plain defs stream live, chunk-by-chunk, as the underlying CLI emits them —
   not buffered until close.** This matches the two defs whose own comments explicitly claim live
   streaming: deepseek's *"skipping `--json` keeps deltas streaming live instead of batched into one
   trailing summary object at end-of-turn"* (`defs/deepseek.ts:30-32`) and aider's *"`--no-stream` — left
   as default (streaming on)"* (`defs/aider.ts:35`). A design that buffers-until-close for these two would
   be a real regression relative to what both the underlying CLI and OD's own daemon already do.
2. **OD forwards plain-format assistant text over the `'stdout'` SSE channel, not `'agent'`/`text_delta`**
   — `send('stdout', { chunk: safe })`, not `send('agent', {type:'text_delta', ...})`, even though it runs
   the exact same `guardTextDelta` pipeline every other format's `emitGuardedTextDelta` helper
   (`server.ts:6762-6772`) uses before sending on the `'agent'` channel. OD's web client must therefore
   treat `'stdout'` as chat-visible content specifically for plain-format runs — a client-side special
   case, not a protocol-level distinction. This is the one place this research recommends **not** mirroring
   OD's literal behavior; see §3/§4.

### 2c. Antigravity is a genuine, documented special case — not representative of the other 4

`server.ts:7282-7297`, comment in full:

> *"Buffer stdout until close so the auth-prompt guard can suppress the OAuth URL before forwarding it to
> the client as assistant text. agy exits 0 after printing the auth URL on stdout, so the chunks would
> otherwise arrive before the close-time classifier detects them as an auth prompt."*

Concretely: `child.stdout.on('data', ...)` only pushes `{text, receivedAt}` into a `plaintextStdoutBuffer`
array (`server.ts:7291-7296`); nothing is sent to the client until the `close` handler
(`server.ts:7712-7726`) flushes the buffer through the same control/title strippers, in order, as `'stdout'`
chunks — explicitly so a leaked OAuth URL can still be caught and suppressed before the user ever sees it.
This is a real, narrow, agy-specific business requirement (a CLI that can print a live auth URL to stdout
and still exit 0), not a generic property of `streamFormat: 'plain'` — confirmed by the fact that the other
4 plain defs get none of this buffering.

**Antigravity also needs an entirely separate pre/post-spawn orchestration concern unrelated to
`streamFormat`:** a real, wired (not vestigial) model-selection lock chain, confirmed by
`git grep -n 'acquireAntigravityModelLock\|waitForAgyToReadModel' apps/daemon/src/server.ts`:

- `server.ts:5823-5826`: before `buildArgs` runs (which itself synchronously writes
  `~/.gemini/antigravity-cli/settings.json` as a side effect when a concrete model is selected —
  `defs/antigravity.ts:213-218`), the daemon calls `acquireAntigravityModelLock()` to serialize against a
  concurrent antigravity run racing the same shared settings file.
- `server.ts:6362-6383`: after spawn, `waitForAgyToReadModel(...)` polls agy's `--log-file` for the
  upstream-confirmed propagation line and releases the lock only once seen, or on child exit — "we hold
  the lock until child exit so a slow-cold-start agy can't be pre-empted by a concurrent settings.json
  rewrite from run B" (comment at `server.ts:6373-6376`).

This is real driving logic `AgentExecutor` has no equivalent seam for today (no `runtimeContext`, no
post-spawn-pre-first-token hook) — antigravity support is strictly more scope than "handle `plain`
streamFormat," and is the concrete evidence behind this document's title question "is `plain` one uniform
shape": **no.**

### 2d. Prompt-delivery plumbing (`promptViaFile`/`maxPromptArgBytes`) is fully generic in OD — no bespoke code

`git grep` for `def.id === 'grok-build'` / `'aider'` / `'deepseek'` / `'qwen'` in `server.ts` returns
nothing beyond the antigravity-specific lines already cited above. The actual call sites —
`server.ts:5578` (`checkPromptArgvBudget(def, composed)`), `server.ts:5779`
(`preparePromptFileForAgent(def, composed, run.id)`), `server.ts:5859/5887` (the two Windows
command-line-budget guards) — key **only** off the def's declared fields (`maxPromptArgBytes`,
`promptViaFile`), with zero per-agent-id branches. grok-build gets prompt-file staging "for free" by
declaring `promptViaFile: true`; aider/deepseek get the argv-budget guard "for free" by declaring
`maxPromptArgBytes`. This confirms these 3 defs need **no bespoke driving code** once the generic
mechanism is wired — unlike antigravity, whose two special cases (§2c) are hardcoded to `def.id ===
'antigravity'` in OD's own source, not generalized behind a reusable `RuntimeAgentDef` field.

### 2e. Post-run `<artifact>` tag extraction — confirmed OD-product, not relevant here

`apps/daemon/src/runtimes/plain-stream.ts` (a real, substantial file — `plainStdoutFromRunEvents`,
`extractPlainStreamArtifacts`, `persistPlainStreamArtifacts`) is **not** a stdout stream driver; it is a
post-run scan (`server.ts:7727-7770`, gated on `status === 'succeeded' && streamFormat === 'plain' &&
run.projectId`) that re-derives the full plain-text transcript by replaying already-recorded `'stdout'`
events from `run.events` (`plainStdoutFromRunEvents`) and looks for OD's own `<artifact type="..." ...>`
tag syntax to persist as project files. This is squarely OD-product (project/artifact-file concepts
`packages/daemon/source-map.md` already excludes from `@jini/daemon`'s charter) — not ported, not
proposed here. It does, however, corroborate one architectural fact worth keeping: OD reconstructs the
full plain-text output by replaying the EventLog's `'stdout'` records after the fact, exactly the same
shape `@jini/daemon`'s own `EventLog`/`RunLifecycle` already provide today, with zero new work needed to
support an equivalent replay in Jini.

### 2f. Independent corroboration from this repo's own prior research

`packages/agent-runtime/source-map.md:257-261` (written against a different OD branch/commit,
`refactor/runtimes-capability-barrel`, during the original `@jini/agent-runtime` port) independently found
the same shape without this task's server.ts read: *"No `plain-stream.ts` exists on this branch. OD's
`plain` `streamFormat` (used by `aider`, `antigravity`, `deepseek`, `qwen`) has no dedicated parser file —
those adapters' stdout is treated as an opaque text blob by the daemon's own chat-run driver, not run
through a structured event parser."* Two independent reads of two different OD commits agree: no
structured parser, opaque-text treatment. (That note predates `grok-build` existing in the registry, hence
its 4-not-5 list — not a discrepancy in the finding itself.)

## 3. What this means for `AgentExecutor` — design options

Three separable problems, not one: **(a)** generalizing prompt delivery (file-staging, argv-budget
guarding) so `buildArgs` can even be called for 3 of the 5 defs; **(b)** deciding the plain-stdout →
run-event translation policy (the part this document's title names); **(c)** antigravity's two extra,
`streamFormat`-unrelated special cases (auth-buffering, model-selection lock). (a) is a prerequisite for
grok-build/aider/deepseek regardless of which (b) option is picked, and is comparatively low-judgment —
`@jini/agent-runtime` already ships `preparePromptFileForAgent`/`checkPromptArgvBudget` fully built and
tested, `AgentExecutor` just needs to call them (mirroring exactly how `writePromptToStdin` already
threads `promptViaStdin`/`promptInputFormat` today) and widen `AgentExecutorRunInput`/`run()`'s
`buildArgs` call site to pass a `runtimeContext`. (c) is arguably out of this gap's scope entirely — see
open question 2. The real design decision is (b):

### Option A — buffer the whole stdout stream, emit one `text_delta` on close/flush

Accumulate every `data` chunk; on `child.on('close', ...)`, emit a single
`{event:'agent', data:{type:'text_delta', delta: fullText}}` (optionally still emitting raw `'stdout'`
chunks live, same as every other format already does in `wireChildLifecycle`).

- **Matches OD's antigravity precedent** (§2c) almost exactly — buffer-then-flush is a real, working
  pattern in the researched source.
- **Does not match OD's own behavior for the other 4 defs**, which stream live (§2b) — and directly
  contradicts deepseek's and aider's own def-file comments about deliberately-preserved live streaming
  (§2b, finding 1). Shipping this as the *uniform* plain-format policy would be a regression against both
  the underlying CLIs' actual behavior and OD's own daemon, for 4 of 5 defs, to match a precedent that
  only actually applies to 1 of 5.
- Cheapest to implement and reason about (no FIFO-ordering concerns beyond what `close` already provides,
  no new per-chunk hygiene decision needed since only one emit ever happens).

### Option B — chunk stdout into `text_delta` events as they arrive, no structured parsing (closest to true passthrough)

Reuse the exact shape `wireChildLifecycle`'s existing `child.stdout.on('data', ...)` handler already has
(`agent-executor.ts:534-538`, which already emits a raw `'stdout'` event for **every** format, plain
included, today) and add one more emit per chunk:
`lifecycle.emit(runId, {event:'agent', data:{type:'text_delta', delta: text}})`. No new stream-parser
state machine, no `feed()`/`flush()` — `createStreamHandlerForDef` would simply not be called for `plain`
defs at all.

- **Matches OD's real, wired behavior for 4 of the 5 defs almost exactly** (§2b) — this is not a novel
  design, it is the closest analogue to what OD's own generic plain branch already does, chunk-cadence
  and all.
- One deliberate, flagged deviation from OD recommended here: **emit as `'agent'`/`text_delta`, not
  `'stdout'`.** `@jini/protocol`'s `RunAgentPayload` already declares `{type:'text_delta', delta:string}`
  (`packages/protocol/src/events.ts:76`) as the one channel all 19 currently-wired defs use for
  chat-visible assistant text; `AgentExecutor`'s own `wireChildLifecycle` already treats `'stdout'` as a
  separate, always-on raw/diagnostic echo channel for every format (`agent-executor.ts:534-538`), not a
  chat-content channel. Reusing OD's literal `'stdout'`-as-chat-content choice would conflate those two
  meanings specifically for plain-format runs, breaking the one consistent convention the other 19 defs
  already establish. This is exactly the same "kernel port, not bug-for-bug" judgment call
  `packages/daemon/source-map.md`'s `EventLog` entry already made once (closing OD's silent replay-gap
  behavor rather than reproducing it) — flagged here for the same sign-off, not decided unilaterally.
- Leaves two hygiene questions genuinely open, both concerns OD's real code actively addresses and this
  repo currently has no equivalent for: (i) terminal-control/ANSI-escape stripping
  (`TerminalControlSequenceStripper` in OD — ad hoc raw CLI stdout can contain carriage returns/cursor
  codes a naive passthrough would forward into chat UI text verbatim); (ii) any role-marker/prompt-format
  contamination guard. On (ii): OD's own guard exists specifically because OD recomposes the **entire**
  conversation transcript into one flat text blob on every plain-format turn (confirmed by
  `defs/antigravity.ts:198-205`'s own comment: *"every spawn gets the full OD-rendered transcript... those
  prior assistant turns are sanitized"*) — `packages/daemon/source-map.md`'s `AgentExecutor` "Explicitly
  out of scope" section already draws the boundary that prompt composition is upstream of
  `AgentExecutor` ("receives an already-composed `prompt` string and does nothing to it"), so this guard's
  necessity is a property of *whatever composes the prompt*, not of `AgentExecutor` itself — noted as a
  pointer for that upstream composer, not a gap in this task's scope. (i) has no such upstream owner and
  is a more defensible `AgentExecutor`-level concern regardless of who composes the prompt.
- Antigravity's auth-URL-leak risk (§2c) is reproduced as-is if antigravity is included under this same
  generic policy with no carve-out — a live per-chunk emit provides no place to intercept before the user
  sees a leaked OAuth prompt URL.

### Option C — each of the 5 declares its own strategy; `plain` is not one uniform shape

Add a def-level field (e.g. `plainOutputStrategy: 'buffer' | 'stream'`, default `'stream'`) so
`AgentExecutor`'s dispatch stays a single generic `plain` branch keyed off that field rather than an
id-keyed special case, with antigravity opting into `'buffer'` and the other 4 taking the `'stream'`
default (Option B's behavior).

- Directly responsive to this document's own title question, using real evidence: prompt-delivery truly
  is heterogeneous (§1) and antigravity truly is a genuine outlier on the output side too (§2c) — a single
  undifferentiated policy is provably wrong for at least 1 of 5 defs.
- Requires a `@jini/agent-runtime` `RuntimeAgentDef` type-surface change, which this task's ground rules
  explicitly place out of scope (`packages/agent-runtime/**` untouched) — a follow-up implementer would
  need separate sign-off just to add the field, before touching `AgentExecutor` at all.
- Over-engineered if the actual decision is "ship the 4 uniform defs now, defer antigravity" (open
  question 2) — in that case Option B alone, with antigravity staying rejected via the existing
  `AGENT_RUNTIME_UNSUPPORTED` path, needs no new type surface at all.

### Recommendation

**Option B** for grok-build/aider/deepseek/qwen (the 4 defs whose real OD behavior is genuinely uniform),
combined with the prompt-delivery generalization prerequisite (§3, opening paragraph) — reusing
`preparePromptFileForAgent`/`checkPromptArgvBudget` exactly as OD's own generic call sites do (§2d), which
is what actually unblocks 3 of the 4 (qwen needs only the output side). **Defer antigravity** rather than
building Option C's type-surface change speculatively for one def — antigravity's two extra concerns
(auth-URL buffering, cross-run model-selection lock) are real scope beyond "drive `streamFormat: 'plain'`"
and deserve their own explicitly-scoped follow-up task with its own sign-off, matching this package's
existing discipline of naming a scope boundary rather than silently expanding one (see open question 2).

## 4. Test evidence a follow-up implementation should prove

Matching this package's existing validation bar (every prior `AgentExecutor` addition in
`packages/daemon/source-map.md` — JSON-stream dispatch, ACP dispatch, pi-rpc dispatch — records 100%
statement/branch/function/line coverage on its own new code plus a dedicated integration-shaped test for
each documented behavior):

1. **End-to-end dispatch** for each newly-supported def (qwen at minimum; grok-build/aider/deepseek once
   prompt delivery is wired): spawn → stdout chunks arrive → ordered `text_delta` `'agent'` events emitted
   → child `close` → `lifecycle.finish()` called with the correct terminal status — mirroring the existing
   JSON-stream/ACP dispatch `describe` blocks in `agent-executor.test.ts`.
2. **Ordering under the existing FIFO discipline.** `wireChildLifecycle`'s `enqueueEmit` queue
   (`agent-executor.ts:503-515`) exists specifically so successive `data` events' derived `emit()` calls
   never race out of order (`packages/daemon/source-map.md`'s design decision 6). A plain dispatch that
   bypasses this queue would silently reintroduce the exact race that decision closed — needs an explicit
   multi-chunk-ordering test, not just single-chunk coverage.
3. **`promptViaFile` (grok-build).** Temp file created via `preparePromptFileForAgent` (mode `0o600` per
   `prompt-file.ts:30`), its path threaded into `runtimeContext.promptFilePath` before `buildArgs` runs
   (grok-build's `buildArgs` throws without it — `defs/grok-build.ts:84-86`), and cleaned up after child
   exit **including on every pre-spawn/spawn-failure path**, not just the happy path (a leaked temp file
   containing full prompt content on a failure path is a real disk-leak/confidentiality gap, not just a
   test-coverage gap).
4. **`maxPromptArgBytes` (aider, deepseek).** A prompt under budget spawns normally; a prompt over budget
   is rejected **before spawn** via the existing `failBeforeSpawn`/`AgentExecutorError` path with an
   actionable message (reusing `checkPromptArgvBudget`'s existing `{code:'AGENT_PROMPT_TOO_LARGE', ...}`
   shape) rather than letting `spawn()` fail with a raw `ENAMETOOLONG`/`E2BIG`. Needs both the POSIX budget
   and (if in scope) the two Windows command-line-expansion guards (`checkWindowsCmdShimCommandLineBudget`
   / `checkWindowsDirectExeCommandLineBudget`), which OD's own `server.ts:5859,5887` calls in addition to
   the base byte check for exactly the reason those functions' own doc comments describe (quote-doubling
   expansion past the raw byte budget).
5. **Cancellation/process-tree cleanup** (`terminateChildTreeBestEffort`) fires correctly through the new
   dispatch branch, exactly as it does for the other 19 defs — this is shared infrastructure a regression
   here would silently break.
6. **Whatever text-hygiene decision is made** (§3, Option B's open hygiene questions) needs an explicit
   fixture with embedded ANSI escape codes/carriage returns proving the chosen behavior (pass-through
   as-is vs. stripped) — there is currently no Jini equivalent of OD's `TerminalControlSequenceStripper` to
   fall back on, so "do nothing" is itself a decision that needs a test asserting it's intentional, not an
   accidental gap.
7. **If antigravity is included in the same follow-up** (against this document's recommendation to defer
   it): a test proving whatever auth-URL-leak policy is chosen (buffer-until-close carve-out, or an
   explicit documented decision to accept the risk), and a decision — before any test can assert on it —
   on whether `acquireAntigravityModelLock`/`waitForAgyToReadModel`'s equivalent is ported at all, given
   `AgentExecutorRunInput` has no `options.model`/`runtimeContext` surface today for any of the 19 already-
   wired defs either (a pre-existing gap this document surfaces but does not own — see open question 4).

## 5. Open questions for whoever implements this

1. **`'agent'`/`text_delta` vs `'stdout'` as the plain-format chat-content channel** (§3, Option B) —
   protocol-consistency-with-the-other-19-defs vs. literal OD-behavior fidelity. This document recommends
   the former; needs explicit sign-off since it is a deliberate deviation from the researched ground truth.
2. **Is antigravity in scope for the same task as the other 4 at all?** Its two extra concerns (§2c) are
   unrelated to `streamFormat: 'plain'` itself — an implementer could reasonably ship
   grok-build/aider/deepseek/qwen now and leave antigravity rejected via the existing
   `AGENT_RUNTIME_UNSUPPORTED` path pending a separately-scoped follow-up. This document recommends
   deferring but does not decide it.
3. **Text hygiene** — should ANSI/terminal-control-sequence stripping be added to `AgentExecutor` generically
   (arguably useful for the raw `'stdout'` events every format already emits, not just `plain`), or scoped
   narrowly to whatever new `plain` dispatch code is added? Left open in §3/§4.
4. **`AgentExecutorRunInput`/`options`/`runtimeContext` surface.** Antigravity's model selection and
   grok-build's `reasoningOptions` both need a `RuntimeBuildOptions`/`RuntimeContext` argument threaded
   into `buildArgs` that `run()` does not pass today for *any* of the 19 already-wired defs either
   (`agent-executor.ts:929`: `def.buildArgs(input.prompt, [])`, no third/fourth argument). Widening this is
   a broader pre-existing gap this task surfaces but does not own — worth flagging to whoever next touches
   `AgentExecutorRunInput`'s shape rather than solving narrowly inside a `plain`-format follow-up.
5. **Does `preparePromptFileForAgent`'s async cleanup fit `AgentExecutor`'s current structure?**
   `wireChildLifecycle` has no existing post-close resource-cleanup seam comparable to "remove a staged
   temp file after the child exits" (`terminateChildTreeBestEffort` cleans up the process tree, not
   filesystem state) — needs a design decision on where that cleanup hook lives, not just "call the
   existing helper."
6. **Is Option C's `RuntimeAgentDef`-level escape hatch ever worth it**, or does antigravity's divergence
   stay an id-keyed special case inside `@jini/daemon` (mirroring OD's own choice to hardcode `def.id ===
   'antigravity'` in `server.ts` rather than generalize a field)? Only relevant if open question 2 resolves
   to "antigravity is in scope."
7. **`resumable` stays `false` throughout**, matching every other `AgentExecutor` v1 dispatch branch
   (`packages/daemon/source-map.md`'s design decision 1) — confirming this explicitly since it's easy to
   assume otherwise for a "simpler" format.
