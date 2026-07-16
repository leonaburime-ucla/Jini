# Swarm Consensus Context Packet

**Date:** 2026-07-12
**Slug:** global-assistant-chat-scope
**Project Type:** brownfield
**Question:** What delivery path should this repo take to build a workspace-level global assistant chat that can (a) read/navigate/control the desktop app's UI and (b) perform durable work (create projects, save files, export, change settings) — and how should the first PR be scoped?
**Intended Consumers:** Primary model + peer CLIs (Gemini, Codex)

## Goal
Decide a delivery path (and first-PR scope) for a "global assistant" chat surface that is not bound to a single project, that can drive the desktop/web UI, and that can perform durable product actions — without deciding the answer in advance. This packet frames the need and the option space; it does not carry any participant's opinion.

## Scope
In scope: architecture shape for the assistant's conversation/task model, how it should invoke UI-control vs durable-work actions, and what should land in the first PR.
Out of scope: the actual UI visual design of the chat drawer/FAB.

## Architecture Summary

This is a design-tool/agent-orchestration app ("Open Design") with three cooperating runtimes:
- `apps/web` — Next.js App Router UI.
- `apps/daemon` — local privileged daemon owning `/api/*`, agent spawning, and the `od` CLI.
- `apps/desktop` — Electron shell.

**Existing chat surface:** `ProjectView` in `apps/web` hosts a project-bound chat (`ChatPane` + `ChatComposer`) backed by daemon-owned conversations/runs scoped to a single project. There is no chat surface today that is not bound to a project. `projectId` is threaded pervasively through `ProjectView` (10,007 lines, single monolithic `export function ProjectView({...})`), down to module-scope helpers like `autoSendFirstMessageKey(projectId)` that key browser `sessionStorage`. `ChatPane` (1,212 lines) and `ChatComposer` (1,774 lines) are each a single exported component.

**Existing tool-invocation layer (read the actual files — see File Access below):** `AgentToolDescriptor` (`packages/contracts/src/agent-tools/descriptor.ts`) is a discriminated union — `BrowserToolDescriptor` (ephemeral view-state-only, must assert `viewStateOnly: true`, exempt from HTTP/CLI) vs `ApiToolDescriptor` (durable capability, cannot type-check without both an `api.route` and a `cli.subcommand`). The dual-track law (see Constraints) is already encoded structurally at this type level for `api` tools — it is not something Option A would need to invent.

Exactly two browser tools are registered today (`apps/daemon/src/browser-actions/tools.ts`): `navigation.goto` and `ui.click`. `ui.click` is already constrained to elements carrying a `data-agent-target="<value>"` attribute — an explicit allowlist, not an arbitrary CSS selector — specifically to prevent an agent from clicking things like "Delete project" or a paid-generation submit button. No richer interaction primitives (fill, wait-for, hover, a reliable read-back/"observe" action) exist yet.

Dispatch lifecycle (`apps/daemon/src/browser-actions/pending-invocations.ts` + `apps/daemon/src/routes/browser-actions.ts`): the daemon mints an `invocationId`, broadcasts a `browser_action_request` over the run's SSE stream, and waits up to 30s for a result. A `claim(invocationId, sessionId)` step (added this session) ensures that when multiple tabs are subscribed to the same run, only the first tab to claim an invocation may execute it — same-session retries are idempotent-true, and a crashed claiming tab is never reassigned (it just times out). Terminal error codes include `TIMEOUT`, `SUPERSEDED` (run ended/cancelled before the action resolved), `TOOL_NOT_AVAILABLE`, `INVALID_INPUT`, `EXECUTION_FAILED`, and a reserved-but-unwired `USER_DENIED`. The claim/result routes are gated by `requireLocalDaemonRequest` (loopback-only by default; the daemon's own code comments frame this as closing a CSRF gap, not as relying on `invocationId` unguessability, since the id is broadcast on SSE and persisted to `events.jsonl`).

## File Access (real repo access is the default for this run)

- **Codex** is dispatched with `-C <repo-root>` and a read-only sandbox, so it can read the live repo directly — the files below, `ProjectView.tsx`/`ChatPane.tsx`/`ChatComposer.tsx` in full, or anything else it wants to inspect.
- **Gemini (`agy`)** cannot be pointed at the live repo (it has no `--ignore-rules` flag and would pick up this repo's root `AGENTS.md` via ancestor-walk, triggering Coordinator startup behavior). Instead, the bounded file set below is staged with relative paths preserved at a genuinely external base (verified to have no `AGENTS.md` anywhere in its ancestor chain): `/var/folders/7_/7kj6s9m95qg_fg8klr38hg_w0000gn/T/ads-peer-dispatch/global-assistant-chat-scope/files/`.

| Path | Why it matters |
|---|---|
| `AGENTS.md` | Root repo rules — in particular the Capability Exposure (UI/CLI dual-track law) section every option must satisfy. |
| `packages/contracts/src/agent-tools/descriptor.ts` | The `AgentToolDescriptor` union — the tool-declaration layer already encodes the dual-track law at the type level. |
| `packages/contracts/src/agent-tools/actions.ts` | `BrowserActionRequest`/`BrowserActionResult` wire shapes and error codes. |
| `apps/daemon/src/browser-actions/tools.ts` | The two tools registered today and the `data-agent-target` allowlist mechanism. |
| `apps/daemon/src/browser-actions/pending-invocations.ts` | Dispatch/claim/resolve/supersede lifecycle, including the new session-lease `claim()`. |
| `apps/daemon/src/routes/browser-actions.ts` | The three HTTP routes wiring the above together, including the `requireLocalDaemonRequest` auth gate. |

**Deliberately not staged for Gemini (too large to bound cleanly):** `apps/web/src/components/ProjectView.tsx`, `ChatPane.tsx`, `ChatComposer.tsx`. Their size and shape are described above (Architecture Summary). Codex can read them live if it wants precision on extraction cost; Gemini should reason from the stated structural facts and explicitly flag if it needs more before answering.

## Two candidate shapes under consideration (present both neutrally; a third "something else" option is required)

**Option A — Full new conversation-owner model.** Introduce a `ConversationOwner` type that is either `{kind: 'project', projectId}` or `{kind: 'workspace', taskId}`, backed by a new daemon-owned `AgentTask` entity (its own persistence, messages, run state, permission/scope, and optional project scope). The global assistant is a new mount point in the app shell (independent of route), talking to new `/api/tasks/*` endpoints and a new `od task ...` CLI surface, reusing the existing browser-action dispatch bridge for UI control. Requires extracting the project-bound run/message logic out of `ProjectView` into a reusable runtime controller so both the project chat and the workspace chat share one implementation.

**Option B — Reuse the existing project-bound chat via a hidden/implicit project.** Create (or lazily materialize) a special non-user-visible "Assistant" project and point the existing `ProjectView`/`ChatPane` machinery at it as-is. No new daemon entity, no new persistence, no `ConversationRuntimeController` extraction. Durable-work capabilities (project creation, exports, settings) would need to be reachable from a chat that is technically "inside" a project that isn't a real user project.

**Option C — something else.** Peers should propose and evaluate at least one alternative that is not a variant of A or B if one is credible (e.g., a different task-boundary model, a different action-invocation split, deferring durable-work capabilities entirely from v1, etc.).

## Constraints
- Every durable-work capability this assistant exposes must eventually satisfy the repo's HTTP+UI+CLI dual-track rule in the same PR — this is not negotiable, only its *timing* (v1 vs later) is open. This is already partly encoded at the type level (see Architecture Summary) — it is not pure process overhead.
- UI-control actions and durable-work actions are architecturally different today: UI-control goes through the browser-action dispatch/session-lease bridge to whichever session is active (`BrowserToolDescriptor`, `viewStateOnly: true`); durable work goes through normal daemon `/api/*` handlers (`ApiToolDescriptor`). Whatever is proposed should not blur that line without justification.
- Any new browser tool beyond `navigation.goto`/`ui.click` should reckon with the `data-agent-target` allowlist precedent — an unconstrained selector-based tool would be a regression from the existing security posture, not a neutral extension.
- The assistant should be able to read/navigate freely within a declared workspace scope, but must ask for confirmation before destructive actions, external publishing, filesystem writes outside the active project, or expanding its scope into a specific project it wasn't already scoped to.
- No production traffic/scale constraints beyond normal engineering judgment — this is a single-daemon, locally-run tool, not a hosted multi-tenant service.

## Known Unknowns
- Whether there is near-term schedule pressure to demo something working quickly, or whether this is being built for durability from the start (this materially affects how much Option B's shortcut cost matters).
- Exact `AgentTask` persistence shape (fields, relationship to existing project/conversation tables) is undecided.
- How much richer browser-tool coverage (fill/wait-for/hover/observe) needs to land before "control the desktop app" is trustworthy for durable-adjacent flows vs. pure navigation — today only `navigation.goto` and `ui.click` exist.

## Source-of-Truth Inputs
| Source | Notes |
|---|---|
| `AGENTS.md` (repo root) | Capability exposure dual-track rule; daemon data directory contract; boundary constraints between `apps/web` and `apps/daemon`. |
| `packages/contracts/src/agent-tools/{descriptor,actions}.ts` | Tool-declaration and wire-format ground truth. |
| `apps/daemon/src/browser-actions/{tools,pending-invocations}.ts`, `apps/daemon/src/routes/browser-actions.ts` | Current implementation ground truth for the UI-control mechanism. |
| Prior architecture proposal (this session, human-relayed from another LLM) | Source of Option A's shape; not treated as a decided answer, just the proposal under evaluation. |

## Shared Prompt Payload

```text
Need: This repo ("Open Design") wants a workspace-level assistant chat that is not bound to one project — it should be reachable from anywhere in the app, able to read/navigate/control the desktop UI, and able to perform durable product actions (create a project, save/export files, change settings) on the user's behalf.

File context: you have real repo access for this task (Codex: live repo via -C, read-only; Gemini: a bounded staged file set at the path given to you). Read the actual files rather than relying solely on the summary below wherever precision matters to your answer — the summary below is a starting frame, not a substitute for the source. Named files: AGENTS.md (root), packages/contracts/src/agent-tools/descriptor.ts, packages/contracts/src/agent-tools/actions.ts, apps/daemon/src/browser-actions/tools.ts, apps/daemon/src/browser-actions/pending-invocations.ts, apps/daemon/src/routes/browser-actions.ts. (Codex only, also available live: apps/web/src/components/ProjectView.tsx, ChatPane.tsx, ChatComposer.tsx.)

Architecture summary: ProjectView (apps/web) hosts today's only chat surface, project-bound, projectId threaded pervasively (10,007-line monolithic component). The tool-invocation layer already exists: AgentToolDescriptor is a BrowserToolDescriptor (ephemeral, viewStateOnly:true, HTTP/CLI-exempt) vs ApiToolDescriptor (durable, requires both an api.route and a cli.subcommand — the dual-track law enforced at the type level) union. Exactly two browser tools are registered: navigation.goto and ui.click (the latter allowlisted to data-agent-target elements only, not free CSS selectors). Dispatch is invocationId-keyed with a 30s timeout, TIMEOUT/SUPERSEDED terminal codes, and a just-added claim() step preventing two subscribed tabs from double-executing the same action. requireLocalDaemonRequest gates the result/claim routes (loopback-only; framed as closing a CSRF gap, not relying on invocationId secrecy).

Constraints:
- Every durable-work capability must eventually ship as HTTP endpoint + UI + CLI subcommand together (repo hard rule, already partly enforced at the type level for ApiToolDescriptor) — timing of when a given capability gets this treatment is open, but no capability can permanently skip any of the three surfaces.
- UI-control actions and durable-work actions currently go through two different mechanisms (browser-action dispatch/session-lease bridge vs. normal daemon HTTP handlers) — any proposal should be explicit about which mechanism each assistant action uses and why.
- Any new browser tool beyond navigation.goto/ui.click should reckon with the data-agent-target allowlist precedent.
- The assistant must ask before destructive actions, external publishing, writes outside the active project, or scope-expansion into a new project.
- This is a locally-run single-daemon tool, not a hosted multi-tenant service — no need to over-design for horizontal scale.

Options to evaluate:
A. Full new ConversationOwner/AgentTask model: new daemon entity + persistence, new /api/tasks/* + od task CLI, new app-shell-level mount, extract a shared ConversationRuntimeController out of the existing project-bound ProjectView/ChatPane so both surfaces share one implementation.
B. Reuse-via-hidden-project: point the existing project-bound ChatPane at a non-user-visible "Assistant" project. No new persistence/entity/extraction.
C. Something else — propose a genuinely different shape if you see one (e.g. different task-boundary model, deferring durable-work actions out of v1, a different action-invocation split).

Is there a strong option, shift, or decomposition not listed above that you believe is better or that this framing has missed? If yes, describe it and explain why it's stronger than the presented options. If no, say so explicitly — do not silently anchor on A/B/C without considering this.

Adversarial task: identify the best design for a first PR's worth of work, reject the weaker option(s) with concrete reasoning, and state what would have to be true for your answer to be wrong. Do not just pick a side — engage with what a first PR should actually contain (what daemon/API/contract/CLI/UI surface, if any) and how it sequences into the next PRs.

Blind Spots (required — answer explicitly, this is a distinct section from your recommendation):
(a) Name a viable option the packet above failed to list.
(b) Name a question we should be asking but aren't — a reframe of the problem, not just another answer to the stated question.
(c) Name the single assumption baked into this framing that is most likely to be wrong, and explain why.

End your response with the literal marker: <<SWARM_END>>
```
