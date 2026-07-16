# Consensus Report

**Date:** 2026-07-12
**Prompt:** What delivery path should this repo take to build a workspace-level global assistant chat that can (a) read/navigate/control the desktop app's UI and (b) perform durable work — and how should the first PR be scoped? (Round 2 added: concrete architecture with code, since the user intends to build from this directly.)
**Context Packet:** `ADS-memory/.local-artifacts/swarm-consensus/context/CTX-global-assistant-chat-scope-2026-07-12.md`
**Mode:** debate
**Controls:** `max_rounds=2`, `min_confidence=0.90`, `swarm_timeout_seconds=300` (exceeded in practice — real elapsed time across both rounds was well over an hour; documented as an Unresolved Deltas note, not silently ignored)
**Primary model:** Claude Sonnet 5 (direct, running this session)

## The Swarm

| Role | CLI | Requested Model | Resolved Model | CLI Version | Selection Source | Status | Attempts |
|---|---|---|---|---|---|---|---|
| Primary | claude (direct) | — | Claude Sonnet 5 | 2.1.201 (Claude Code) | direct | Responded | 1 (frozen Round 1 + disclosed Round 2 update) |
| Peer | agy (Gemini) | Gemini 3.1 Pro (High) | Gemini 3.1 Pro (High) | agy 1.1.1 | local_default | Responded | Round 1: 2 (1st failed — dispatcher error, missing `--dangerously-skip-permissions`/pty wrapper, not a model failure; 2nd succeeded after fix). Round 2: 1 (succeeded first try). |
| Peer | codex | gpt-5.6-terra | gpt-5.6-terra (reasoning=medium) | codex-cli 0.144.0 | local_default (exact `command_model`) | Responded | Round 1: 1. Round 2: 1. |
| In-host subagent (Addition case, full voting per user decision) | claude (Agent tool) | fable | Claude Fable 5 | n/a (in-process) | direct | Responded | Round 1: 1. Round 2: 1. |

`claude` CLI was not dispatched as a separate peer — Primary is already Claude, and running a `claude -p` subprocess alongside it would be a same-family duplicate voice, not an independent peer, per the swarm-consensus skill's routing rule.

## Dispatch Diagnostics

| CLI | Output Mode | stdout Parser | stderr Summary | Retry Notes |
|---|---|---|---|---|
| agy | text | full stdout stripped of ANSI, `<<SWARM_END>>`-delimited | clean on successful runs | Round 1 attempt 1 failed with `Error: timeout waiting for response` after ~5min — traced to a dispatcher error (missing `script -q /dev/null` pty wrapper and `--dangerously-skip-permissions`, both required whenever the prompt triggers agy's own tool-use/file-read approval flow under non-TTY redirect — documented Antigravity #76 bug). Fixed and retried once; both Round 1 retry and Round 2 succeeded cleanly. |
| codex | json | JSONL `agent_message` items via `--json` | session header only, no crashes | Version-quarantine smoke test run first (Intel macOS, codex-cli 0.144.0 — outside the known `0.142.x` SIGTRAP-crash range); clean. No retries needed. |
| claude (Agent tool, Fable) | plain text (background agent) | direct return value | n/a | No retries needed. |

## Debate Trace

**Round 1 (blind, neutral packet — all four positions independently produced, no cross-contamination):**
- **Primary (frozen):** spec-first, then extract `ConversationRuntimeController` as an early step, then a new `AgentTask` entity + `/api/tasks/*` + `od task` CLI.
- **Codex:** reject extraction in PR1; extend the `conversations` table with a scope discriminant, no new entity; UI tools work day one, durable tools deferred to PR2.
- **Fable:** reject extraction in PR1 (cited `useConversationChat.ts`'s docblock as on-record evidence extraction was already tried and deliberately scoped back); extend conversation scope, no new entity; cited existing `POST /api/projects`/`od project create` as evidence most durable capabilities already satisfy the dual-track law.
- **Gemini:** reject extraction in PR1; proposed a **new** `/api/workspace-runs` entity (only participant to propose a new entity in Round 1); found the session-targeting gap (`claim()` is "first tab wins," not session-targeted) and the router-self-unmount failure mode for the hidden-project option — both novel, both independently verified against source afterward and confirmed accurate.

**Round 2 (informed — Decision Ledger + Primary's disclosed position shared with all three; each asked to react, take a side on the entity-shape split, and produce a ranked solution slate with real code):**
- **Gemini reversed its own Round 1 entity proposal** after reviewing Codex's and Fable's Round 1 answers, converging on "extend `conversations`." Proposed a required `targetSessionId` protocol field as the session-targeting fix. Its SQL migration sketch used Postgres-style `ALTER COLUMN ... DROP NOT NULL` / `ADD CONSTRAINT ... CHECK`, which is **not valid SQLite** (this daemon's actual migration pattern, verified against `apps/daemon/src/db.ts`, is exclusively `ALTER TABLE ... ADD COLUMN`) — flagged and corrected using Codex's and Fable's independently-derived correct table-rebuild approach.
- **Codex held its Round 1 position**, added a concrete session-targeting fix (`targetSessionId` as a required protocol v2 field, explicit rejection of "fail open" on claim-verification failure, an app-root `BrowserActionHost` that survives navigation), and independently produced the correct SQLite table-rebuild migration (caught the same NOT-NULL issue Primary flagged mid-round, without being told).
- **Fable held its Round 1 position** and strengthened it: re-verified every citation against the live working tree this round, found the exact FK-cascade-delete trap in the table-rebuild (`db.pragma('foreign_keys = ON')` at `db.ts:41` means `DROP TABLE conversations` would cascade-delete `agent_sessions`/`messages`/`preview_comments` rows unless FK enforcement is temporarily disabled around the rebuild), and cited an **existing precedent in this exact codebase** for the correct rebuild pattern (`preview_comments_next` in `db.ts` ~392–430) — verified accurate. Proposed a more complete session-targeting mechanism (grace-window preferred-claim + run-pinning) that additionally handles the "origin tab closed mid-run" case Codex's and Gemini's simpler required-field designs leave unaddressed, and unifies session-targeting with multi-step tool-sequence coherence into one mechanism.

**Agreement after Round 2:** 3 of 3 external/added participants (Codex, Fable, Gemini) converge on: no extraction in PR1, extend `conversations` (not a new entity), reject the hidden-project option, and add a session-targeting fix to PR1 scope. This exceeds `min_confidence=0.90` on those four decision points. The remaining disagreement is a design-detail fork (exact session-targeting mechanism; DOM attribute vocabulary for `ui.fill`), not an architecture-level one — see Unresolved Deltas.

## Individual Responses

### Claude Sonnet 5 (Primary)
Round 1 (frozen, formed before reading any repo file beyond the initial browser-actions control plane): recommended a short spec, then `ConversationRuntimeController` extraction, then a new `AgentTask` entity. Round 2 (disclosed to peers): retracted the extraction-early and new-entity parts of that position after reading the other three Round 1 answers — `useConversationChat.ts`'s docblock is on-record evidence against extraction, and Codex/Fable's "extend conversation scope" reasoning was more convincing than Primary's own new-entity framing had been. Primary's remaining contribution this round was verification: independently confirmed the SQLite ALTER TABLE limitation, then independently confirmed Fable's specific FK-cascade and `preview_comments_next` precedent citations against the actual source.

### Gemini 3.1 Pro (High)
Round 1: proposed a new `/api/workspace-runs` entity; found the session-targeting gap and the hidden-project router-unmount failure mode, both novel and both verified accurate. Round 2: reversed the entity proposal to align with Codex/Fable; proposed a required `targetSessionId` session-targeting fix; produced a migration sketch with invalid (non-SQLite) syntax, corrected in synthesis using Codex's/Fable's approach. Full text: `ADS-memory/.local-artifacts/swarm-consensus/offloads/peer-agy-round1-retry.txt`, `peer-agy-round2.txt`.

### Codex GPT-5.6-terra (reasoning=medium)
Held its Round 1 "extend conversations, no extraction" position across both rounds. Round 2 added: a required-`targetSessionId` protocol v2 change with an app-root `BrowserActionHost`, an independently-correct SQLite table-rebuild migration, full `ui.fill`/`ui.waitFor`/`ui.observe` `BrowserToolDescriptor` sketches with a `data-agent-fillable`/`data-agent-observe` opt-in governance model, and a `workspace-assistant` CLI subcommand family. Full text: `ADS-memory/.local-artifacts/swarm-consensus/offloads/peer-codex-round1.txt`, `peer-codex-round2.txt`.

### Claude Fable 5 (in-host subagent, Addition case, full voting per user decision)
Held its Round 1 "extend conversations, no extraction" position across both rounds, strengthening it each round with re-verified source citations (all independently spot-checked and confirmed accurate by Primary). Round 2 added: the FK-cascade-delete trap and its exact precedent (`preview_comments_next`), a grace-window + run-pinning session-targeting design that also handles the dead-origin-tab case, and `ui.fill`/`ui.waitFor`/`ui.observe` descriptors using a separate `data-agent-field` vocabulary with an explicit prompt-injection framing for `ui.observe`'s bounded-projection return shape. Full text embedded in this session's transcript (background agent `aa4dfb6b7960bc33c` Round 1, `a4585435c7c69923c` Round 2).

## Synthesis

### Agreement (strong — all 3 non-Primary participants, post-Round-2)
- No `ConversationRuntimeController` extraction in PR1. `useConversationChat.ts` is on-record evidence this codebase already tried and deliberately scoped back a similar extraction.
- Extend the existing `conversations` table with a `scope: 'project' | 'workspace'` discriminant and a nullable `project_id`, rather than inventing a new `AgentTask`/`workspace-runs` entity. `messages` and `agent_sessions` already key on `conversation_id` and need zero changes.
- Reject the hidden-"Assistant"-project shortcut outright — not just as scope-creep (Primary's/Fable's Round 1 framing) but as actively broken: navigating to a real project swaps the router outlet and unmounts the hidden project's own `ChatPane`, killing the assistant's own action-receiver mid-task (Gemini's finding, independently confirmed).
- PR1 must include a session-targeting fix. The current `claim(invocationId, sessionId)` is a double-execution guard ("first caller wins"), not a routing mechanism — a workspace-level assistant makes every browser tab in the app shell a potential claimant, turning a rare edge case into the default operating condition.
- `ui.fill`, `ui.waitFor`, `ui.observe` all extend the existing dispatch → SSE → claim → execute → resolve transport **mechanically unchanged** — they are new `BrowserToolDescriptor` entries, not new plumbing.
- Any migration touching `conversations.project_id`'s `NOT NULL` constraint requires a full SQLite table-rebuild (`CREATE ..._next`, copy, `DROP`, `RENAME`), not an in-place `ALTER COLUMN` — this codebase's SQLite (`better-sqlite3`) doesn't support that, and a real precedent for the rebuild pattern already exists in `db.ts` (`preview_comments_next`).

### Divergence (implementation-detail forks, not architecture-level)
1. **Session-targeting mechanism.** Codex and Gemini: make `targetSessionId` a required protocol field, reject the claim outright if it doesn't match (simpler, stricter, but neither explicitly handles "origin tab closed mid-run"). Fable: `preferredSessionId` with a ~400ms grace window (only the preferred session may claim during the window; falls back to first-claimer-wins after, covering the dead-tab case) plus run-pinning so a multi-step `fill → click → observe` sequence stays on one tab once claimed. **Recommendation: Fable's design** — it is strictly more complete (handles the dead-tab case the other two don't address) and it is the same mechanism that makes multi-step tool sequences coherent, rather than a separate concern bolted on next to them.
2. **`ui.fill` target vocabulary.** Codex: reuse `data-agent-target` plus a `data-agent-fillable` boolean opt-in on the same attribute family used by `ui.click`. Fable: a separate `data-agent-field` attribute, distinct from `data-agent-target`, specifically for fillable elements. Both are defensible allowlist designs with no free-selector risk either way. **No strong recommendation** — this is a naming/ergonomics choice for whoever writes the PR, not a correctness question. Fable's separation slightly reduces ambiguity between "clickable" and "fillable" roles on the same element; Codex's reuse keeps one attribute vocabulary to document.

### Unique Insights
- Gemini's router-self-unmount failure mode for the hidden-project option (independently confirmed) — the sharpest of the three "reject Option B" arguments, because it's a functional bug, not just an architectural-hygiene objection.
- Fable's FK-cascade-delete trap plus the `preview_comments_next` precedent (independently confirmed) — without this, the migration in Codex's or Gemini's sketch would need debugging the hard way (a `conversations` rebuild silently deleting every message/session row) rather than being caught on paper.
- Fable's observation that `useConversationChat` is *already* "a secondary ChatPane bound to a single conversation" — i.e., the exact shape a workspace assistant pane needs already exists as a hook, one layer down from `ProjectView`.
- Fable's run-pinning insight that session-targeting and multi-step-sequence coherence are the same mechanism, not two features.

### Decision Ledger

| Decision Point | Primary (Sonnet 5) | Codex | Fable 5 | Gemini 3.1 Pro | Agreement | Key Why / Movement |
|---|---|---|---|---|---|---|
| Extract `ConversationRuntimeController` in PR1? | No (revised from Yes in R2) | No | No | No | Yes (4/4 after R2) | `useConversationChat.ts` docblock is on-record evidence against it. |
| New daemon entity vs. extend `conversations`? | Extend (revised from new-entity in R2) | Extend | Extend | Extend (revised from new-entity in R1) | Yes (4/4 after R2) | `messages`/`agent_sessions` already key on `conversation_id`; a new entity duplicates that surface. |
| Hidden-project shortcut (Option B)? | Reject | Reject | Reject | Reject | Yes (4/4) | Router-unmount bug (Gemini) + forever-tax filtering (Fable/Primary). |
| Session-targeting fix in PR1? | (not raised in R1; agreed in R2) | Yes — required field | Yes — grace-window + pinning | Yes — required field | Yes (3/3 non-Primary) | `claim()` is a double-exec guard, not a router; workspace scope makes the race the default case. |
| Session-targeting exact mechanism | — | Required, strict | Grace-window, pinning | Required, strict | No — 2/1 split | Fable's handles the dead-tab case the other two don't; recommended. |
| SQLite migration approach | — | Correct table-rebuild (independently derived) | Correct table-rebuild + FK-cascade trap + precedent | Incorrect Postgres-style ALTER (corrected in synthesis) | 2/3 correct pre-correction | This daemon's migrations are `ADD COLUMN`-only; NOT-NULL relaxation needs a full rebuild. |

### Unresolved Deltas
- `ui.fill` DOM attribute vocabulary (`data-agent-target` reuse vs. separate `data-agent-field`) — a real but low-stakes fork; pick one when writing the PR, no further debate needed.
- The `swarm_timeout_seconds=300` default was exceeded in practice by a wide margin (multi-hour real elapsed time across two rounds, four participants, and file-grounded research). Worth raising as feedback on the toolkit's default budget for `/debate` runs that involve real file access and code generation — 300s was calibrated for a lighter task shape.

## Final Recommendation

**Ship PR1 as: extend `conversations` with a `scope` discriminant + nullable `project_id` (full SQLite table-rebuild, following the `preview_comments_next` precedent), a `/api/workspace/conversations` route family + `od assistant`/`od workspace-assistant` CLI, a shell-level `WorkspaceAssistant` pane driven by `useConversationChat`, the Fable-style grace-window + run-pinning session-targeting fix in `pending-invocations.ts`, and three new `BrowserToolDescriptor`s (`ui.fill`, `ui.waitFor`, `ui.observe`) riding the existing dispatch/claim/resolve transport unchanged.**

This is the top-ranked option across all three independently-produced solution slates (Codex's Option 1, Fable's Option 1, and Gemini's revised Option 1 all converge on this shape), scored highest on every stated ranking criterion (blast radius, reversibility, reuse of existing machinery, day-one capability, and how naturally PR2's durable `ApiToolDescriptor` tools land on top). The alternative (a new `/api/workspace-runs`/`AgentTask` entity) is rejected because it either forgoes transcript persistence and `agent_sessions` resume (making the assistant amnesiac between turns) or duplicates those tables' semantics under a new name — strictly worse on both reuse and reversibility, with no compensating advantage identified by any participant. The hidden-project shortcut is rejected outright as functionally broken, not just architecturally undesirable.

**Cheapest de-risking test before writing product code:** a daemon Vitest that runs the `conversations` migration against a fixture DB seeded with existing conversations *and* their FK children (`agent_sessions`, `messages`, `preview_comments` rows), asserting `PRAGMA foreign_key_check` returns clean and every child row survives. This falsifies the riskiest step (the table rebuild) before anything else is built on top of it.

**What would flip this recommendation:** if implementation reveals more than a handful of `db.ts`'s conversation queries need `WHERE scope = ...` branching (Fable's explicit falsifier — suggests false sharing, meaning a separate entity was actually right), or if product intent turns out to be durable/resumable background jobs surviving a daemon restart rather than an interactive chat (Codex's/Primary's falsifier — a run is ephemeral, a task is not, and that distinction would justify Option A after all).
