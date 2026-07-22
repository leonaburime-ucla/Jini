# Consensus Report

**Date:** 2026-07-22T02:30:00Z (approximate)
**Prompt:** What should Jini's run/chat orchestration layer look like, and how should it be built?
**Context Packet:** `ADS-memory/reports/swarm-consensus/context/CTX-run-chat-orchestration-2026-07-21.md` (+ `-round1-prompt.md`)
**Mode:** debate
**Controls:** `max_rounds=3` (overridden from default `2` at explicit user request after Round 2 converged 4 of 5 points but left one — DP1 — unresolved), `min_confidence=0.90`, `swarm_timeout_seconds=300` per round
**Primary model:** Claude Sonnet 5

## The Swarm

| Role | CLI | Requested Model | Resolved Model | CLI Version | Selection Source | Status | Attempts |
|---|---|---|---|---|---|---|---|
| Primary | claude (self) | — | Claude Sonnet 5 (`claude-sonnet-5`) | 2.1.201 | self-reported (system identity) | Responded (R1 only; frozen, informs synthesis) | 1 |
| Peer | agy | Gemini 3.1 Pro (High) | Gemini 3.1 Pro (High) | 1.1.5 | local default, exact `command_model` | Responded (R1, R2, R3) | 3 |
| Peer | codex | gpt-5.6-sol | gpt-5.6-sol (reasoning=high) | codex-cli 0.144.3 | local default, exact `command_model` | Responded (R1, R2, R3) | 3 |
| Addition (in-host subagent, not a peer CLI) | claude (Fable) | Fable 5 | Fable 5 (`claude-fable-5`) | n/a (Agent tool) | user-requested addition | Responded (R1, R2, R3) | 3 |

Model-proof gate: `cli_smoke_test.py --model-plan-only` run before dispatch; agy/codex both resolved to exact `command_model` values (no alias-only/unresolved blocking condition). Primary's own identity is self-known directly (system-declared), not CLI-probed.

## Dispatch Diagnostics

| CLI | Output Mode | stdout Parser | stderr Summary | Retry Notes |
|---|---|---|---|---|
| agy | text (`--print`, pty-wrapped via `script`) | full stdout, ANSI-stripped, end-marker delimited | none material | 0 retries needed across 3 rounds |
| codex | json (`--json`, stdin transport) | `agent_message` items from JSONL | tool-use smoke test run before R1 (version-quarantine check for known SIGTRAP class on Intel macOS; codex-cli 0.144.3 confirmed clean) | 0 retries needed |
| Fable | n/a (Agent tool, not a subprocess) | agent's final message | n/a | 0 retries |

Peer Handshake Gate (packet-bound ACK, 60s window) run and passed before every round for both external peers; not applicable to Fable (in-host subagent, not a buffered/streaming CLI transport).

## Debate Trace

Round 1 was blind (no Coordinator opinion, no cross-participant visibility). Round 2 was informed (Coordinator disclosed a decision ledger + cross-participant findings). Round 3 was scoped narrowly to the one point still unresolved after Round 2 (DP1).

| Decision Point | Round 1 | Round 2 | Round 3 | Final |
|---|---|---|---|---|
| **DP1** — composition primitives | Primary: host-owned, no elaboration. agy: host-owned. Codex: Jini owns full `PromptSegment` typed primitives. Fable: host-owned except a byte-recording obligation. | agy moves to Fable's typed-journal carve-out. Codex narrows to a small *experimental* `PromptSegment` alongside the journal. Fable adds typing to its journal proposal (`JournalEntry{content, provenance, trust}`). | agy: unchanged, argues irreducible, accepts ship-journal-defer-type resolution. **Codex reverses fully** to journal-only, citing the ossification argument as decisive; frames it as resolvable via a future two-host conformance test. Fable: unchanged, reconciles agy/Codex's meta-disagreement ("irreducible now, resolvable later — an evidence gap with a known closing condition, not a values dispute"). | **Unanimous (3/3): ship a typed byte-journal now; explicitly defer an input-side `PromptSegment` type as a tracked promotion decision, not a blocker, gated on Codex's own two-host conformance test.** |
| **DP2** — delivery shape (new package vs. existing) | Fable: no new package, increments to existing packages. Codex: new `RunOrchestrator` package/service. agy, Primary: no stated position. | agy adopts Fable's no-new-package position, citing package sprawl (23 vs. locked ~14). Codex reverses toward no-new-package, citing the same sprawl finding. Fable concedes a *module* (not a package) as reasonable middle ground. | Not re-litigated (already 3/3). | **Unanimous (3/3): no new package or service; land as increments in `@jini/daemon`, small `@jini/protocol` additions, `@jini/node-host` preset wiring** (Fable's proposed module path, `packages/daemon/src/continuation/`, accepted as the concrete shape). |
| **DP3** — gap-3 mechanism (uniform loop vs. capability-routed) | Codex and Fable *independently* propose capability-routed transport as an unlisted-option blind spot. agy independently flags the underlying problem (non-uniform CLI capability) without proposing the fix. Primary misses this distinction entirely. | agy adopts capability-routing. Codex grounds it in real data: only 2/24 defs declare `stream-json`, 12/24 declare spawn-time MCP injection. Fable grounds it more precisely: exact citations (`defs/claude.ts:92`, `defs/codebuddy.ts:119`, `agent-executor.ts:501,558-577` — stdin closes after first write for ~22/24 defs). | Not re-litigated (already 3/3, and the strongest-evidenced point in the whole debate). | **Unanimous (3/3), evidence-backed: per-definition `continuationTransport: 'mcp-callback' \| 'stdin-injection' \| 'none'`, resolved from each def's declared input format. Not a design preference — a factual constraint (uniform stdin injection is structurally impossible for ~22/24 registered CLI defs today).** |
| **DP4** — MVP sequencing | Primary: gap 5 → 3 → 1 → 4. Fable: gap 1 → 5 → 3 → 4. agy: gap 3 → 1, defers 5/4. Codex: 8-item bundle, no strict single-item order. | agy reorders to gap 1 → 5 → 3 → 4, citing Fable's observability-floor argument as decisive. Codex's ordering converges to the same shape (Run semantics + wiring + observability first, then capability probe, then session persistence, then one MCP callback, then one stdin adapter, then retry). | Not re-litigated (already 3/3; only Primary's original ordering was the outlier). | **Unanimous among peers (3/3), and Primary's synthesis explicitly updates to match: gap 1 (default wiring + observability floor) → gap 5 (session capture/resume) → gap 3 (capability-routed transport, MCP-callback spike first) → gap 4 (retry-classifier port, no default).** Primary's original Round 1 ordering (5 before 1) is superseded. |
| **DP5** — what a "Run" denotes | Codex and Fable *independently* propose "one user-visible operation, chained by `contextRef`(+`sessionRef`)" as a Round 1 blind spot — arrived at without seeing each other's answer. Primary flags the ambiguity but takes no position. agy silent. | agy adopts the same definition, citing Codex/Fable's independent convergence and Fable's `run-lifecycle.ts` evidence (`resume()` is attempt-recovery, not session continuation) as decisive. | Not re-litigated (already 3/3, and the strongest independent-convergence signal in Round 1). | **Unanimous (3/3), evidence-backed: a `Run` is one user-visible operation/attempt (may span internal retries and tool callbacks), not a full multi-turn session. Continuity across user turns is via `contextRef` + an optional captured `sessionRef`, not a single long-lived Run.** |

## Individual Responses

### Primary: Claude Sonnet 5
Frozen Round 1 answer (full text: `ADS-memory/.local-artifacts/swarm-consensus/runs/2026-07-21T2300Z-primary-round1-run-chat-orchestration.md`) recommended a sharpened Option C: Jini owns gaps 1, 3, 4 (port only), 5; never gap 2. Missed the capability-routing distinction entirely in Round 1 (an acknowledged gap). In synthesis, updated to: agree with all 3 peers on DP2/DP3/DP5 (was neutral/silent on these in R1, not contradicted); explicitly reverse the DP4 ordering (originally gap-5-first, now agrees gap-1-first); and independently lean toward the peer-converged DP1 outcome (journal-only) on its own reasoning merits, not merely peer deference.

### Peer: Gemini 3.1 Pro (High), via agy
Started most conservative — silent on DP2/DP5 in Round 1, wrong-ordered on DP4, but already correctly positioned on DP1 from the start. Moved toward the Codex/Fable consensus across Rounds 2–3 on 4 of 5 points, explicitly citing their arguments as the reason each time (a pattern of genuine, well-explained position change rather than reflexive agreement). Its one clearly original Round 1 contribution — a blind spot about how an autonomous loop should distinguish "tool call complete" from "waiting on a human for a clarifying question" — was never resolved by any round and is carried into Unresolved Deltas below. Answers were more conceptually reasoned than empirically grounded; did not cite specific file:line evidence the way Codex and Fable did.

### Peer: Codex (gpt-5.6-sol, reasoning=high)
Started as the most opinionated peer — Round 1 recommended a full `RunOrchestrator` package with typed `PromptSegment` primitives, ranked its own idea first. Reversed two major positions across the debate with real, stated reasoning each time: DP2 (dropped `RunOrchestrator`, cited package sprawl) and DP1 (dropped `PromptSegment` for now, cited the ossification argument as decisive after initially defending it). Its Round 2 contribution was the debate's most concretely evidence-grounded moment — actually querying the registered agent-definition data (2/24 stream-json, 12/24 MCP-injection-capable) rather than reasoning abstractly. Proposed a genuinely useful settling mechanism for DP1's meta-disagreement (a two-host conformance spike as the promotion test).

### In-host subagent (addition): Fable 5
The most rigorously evidence-grounded participant throughout — every substantive claim across all 3 rounds cites exact file:line locations (`agent-executor.ts:501,558-577`, `defs/claude.ts:92`, `run-lifecycle.ts` lines 2–3/36, etc.), not just repo-level assertions. Held the eventual-consensus position on DP1, DP2, and DP4 from Round 1 onward without needing to be moved — the other two peers converged toward Fable's positions, not the reverse, on those three points. Contributed the debate's sharpest single insight (DP3's exact "stdin closes after first write for 22/24 defs" finding, which converted "capability-routing is nicer" into "uniform injection is structurally broken"). In Round 3, reconciled agy's "irreducible" and Codex's "resolvable" framings into a single coherent resolution rather than leaving them as a residual disagreement.

## Synthesis

### Agreement
All 5 decision points reached full 3/3 peer agreement by the end of Round 3, with Primary's synthesis updating to match on the 2 points (DP3, DP4) where Primary's original Round 1 answer was incomplete or wrong. No decision point remains genuinely contested at the level that would block a design recommendation.

### Divergence
None remaining at the recommendation level. One meta-level framing difference persists without practical consequence: agy characterizes DP1 as an irreducible values disagreement; Codex and Fable characterize it as a currently-unresolvable-but-eventually-testable evidence gap. Both readings prescribe the identical action (ship the journal, defer the type), so this is recorded as a nuance, not an unresolved delta.

### Unique Insights
- **agy's human-in-the-loop pause question** (Round 1, never resolved by any subsequent round): how does the multi-turn continuation loop distinguish "the agent finished a tool call and is continuing autonomously" from "the agent is waiting on the human user for a clarifying answer"? This is a real gap in the converged design — the capability-routed transport model resolves *how* a tool result gets injected, but not how the loop recognizes it shouldn't inject anything because the child is actually waiting on a person. Flagged for the implementation phase, not resolved here.
- **Codex's two-host conformance spike** as the concrete, falsifiable promotion test for `PromptSegment` — turns an otherwise-permanent-sounding deferral into an actionable, revisitable decision with a named trigger condition (the second real downstream consumer).
- **Fable's dissolution of the agy/Codex meta-disagreement** on DP1 (irreducible-now-resolvable-later) — useful independent of this specific decision, as a reusable framing for any future "is this policy or just not-yet-proven mechanism" question in this repo.

### Decision Ledger

| Decision Point | Claude Sonnet 5 (Primary) | Gemini 3.1 Pro (agy) | Codex gpt-5.6-sol | Fable 5 | Agreement | Key Why / Movement |
|---|---|---|---|---|---|---|
| DP1 — composition primitives | Journal-only (updated from R1 silence) | Journal-only, deferred type | Journal-only, deferred type (reversed from R1) | Journal-only (held since R1) | Yes (3/3 peers + Primary) | Ossification risk of an input-side type outweighs Codex's contracts-vs-selection framing; promotion gated on a real two-host need |
| DP2 — delivery shape | No new package (updated from R1 silence) | No new package (adopted R2) | No new package (reversed from R1) | No new package (held since R1) | Yes (3/3 peers + Primary) | Package-sprawl finding (23 vs. locked ~14) outweighs conceptual tidiness of a dedicated orchestrator |
| DP3 — transport mechanism | Capability-routed (updated — missed in R1) | Capability-routed (adopted R2) | Capability-routed (held since R1, data-grounded R2) | Capability-routed (held since R1, most precisely evidenced) | Yes (3/3 peers + Primary) | Factual constraint, not preference: stdin closes after first write for ~22/24 registered defs |
| DP4 — MVP sequencing | Gap 1→5→3→4 (reversed from R1's 5→3→1→4) | Gap 1→5→3→4 (reordered R2) | Equivalent ordering (converged R2) | Gap 1→5→3→4 (held since R1) | Yes (3/3 peers + Primary) | Observability floor must land first or later bugs (especially injection bugs) ship undetected |
| DP5 — Run definition | One operation (updated — R1 raised as open question only) | One operation (adopted R2) | One operation (held since R1, independently) | One operation (held since R1, independently, code-evidenced) | Yes (3/3 peers + Primary) | Matches `RunLifecycle.resume()`'s existing attempt-scoped semantics; avoids forcing all 24 CLIs into long-lived interactive mode |

### Unresolved Deltas
- The human-in-the-loop pause question (agy, Round 1) — not resolved by this debate, should be scoped separately before or during gap-3 implementation.
- DP1's meta-level framing (irreducible vs. resolvable-later) — does not block the ship decision, noted for completeness only.

## Final Recommendation

Build Jini's run/chat orchestration layer as **capability-routed C+**, delivered as increments to existing packages, in this order:

1. **Gap 1 first**: a default `RunStartHandler`-style wiring (host-supplied `resolveRunInput` seam, matching the existing `resolveDaemonUrl` precedent) plus a durable, typed byte-journal (`JournalEntry{content, provenance, trust}`) recording every byte sent to/received from a child agent process. This is the observability floor every later increment depends on.
2. **Gap 5 next**: stop dropping `sessionID`/`thread_id`/`session_id` fields already present in existing per-format parsers; persist as an optional `sessionRef` on `RunEndPayload`/`FinishRunInput`, riding the existing `EventLog` terminal-entry retention — no new storage.
3. **Gap 3 third**: per-definition `continuationTransport: 'mcp-callback' | 'stdin-injection' | 'none'`, resolved from each def's declared input format (defaulting `'none'` for unverified entries). Validate the MCP-callback bet with a single-definition spike (inject the already-shipped MCP host into one MCP-capable CLI's launch config, prove a tool round-trip through the existing `delegated-tool-bridge.ts`) before committing to it as the primary transport. Add `stdin-tool-result` only for the confirmed stream-json defs (Claude, CodeBuddy), using structured/JSON-escaped framing exclusively — never raw string concatenation, given the prompt-injection stakes on this exact path. Every injected byte routes through the existing `ToolExecutor` deny-by-default gate; no parallel authorization path.
4. **Gap 4 last**: an injectable `classifyFailure?` port on `CreateAgentExecutorOptions`, with **no default classifier** — absent, behavior stays byte-identical to today's hardcoded `resumable: false`.
5. **Gap 2 stays out of scope**, permanently for this cycle: prompt/skill/memory composition remains host-owned, documented as a deliberate exclusion in `packages/daemon/source-map.md`, not silently assumed.
6. **`PromptSegment` (an input-side composition type) is explicitly deferred, not rejected** — track it as an open decision, promotable only when two real downstream hosts independently need the same segment shape and an adversarial test shows it provides enforceable benefit the journal alone can't.

Before implementation begins: scope the human-in-the-loop pause question (unresolved delta above) as part of gap 3's design, since capability-routing alone doesn't answer it.
