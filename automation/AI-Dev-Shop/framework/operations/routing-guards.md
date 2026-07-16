# Routing Guards

This file is the source of truth for command-level routing guards that prevent similar-looking requests from being handled by the wrong workflow.

## Execution Intent Dispatch Guard

When the user expresses execution intent for specialist work (e.g., "let's start the specs", "write the plan", "implement this"), the Coordinator must resolve ownership and dispatch — not fulfill directly.

This guard works in concert with the Ownership-Resolution Gate in `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/tripwires.md`. The gate is the enforcement mechanism; this guard is the routing-level obligation that triggers it.

On execution intent detection:
1. Emit a routing decision: `[Routing: <content-type> → Owner: <agent> → Action: dispatch/proceed]`
2. If owner is a specialist → dispatch immediately, produce zero specialist content
3. If owner is Coordinator → check preconditions per the gate, then proceed

No clarifying question is needed when the intent is unambiguous. Treat inline drafting the same as file writing — "let's start the specs" means route to Spec Agent, not write requirements prose.

## Subagent Default Guard

When the user invokes `/reverse-spec` or `/code-review`, default to **spawned subagents** when all of these are true:

- the current host resolves to `subagent-assisted`
- the user has not requested `single-agent mode` or `disable subagents`
- the delegated bootstrap and reserved-name validity guard in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md` can be followed

Condition 3 is a best-effort pre-check. If bootstrap fails at actual spawn time, issue the downgrade message below and continue sequentially.

This must be user-visible before dispatch. Do not describe the run as only "the agent" doing the work when separate helper contexts will be used. Say which path is active and how to change it:

- `/reverse-spec`: `Coordinator(Pipeline Mode): Defaulting /reverse-spec to spawned subagents for CodeBase Analyzer inventory and bounded extraction passes, instead of running only the active agent in one context. Say "single-agent mode" or "disable subagents" to run this sequentially.`
- `/code-review`: `Coordinator(Pipeline Mode): Defaulting /code-review to spawned subagents for Code Review and Security, instead of running only the active agent in one context. Say "single-agent mode" or "disable subagents" to run this sequentially.`

If subagent support is unavailable, unverified, disabled, or the delegated bootstrap cannot be satisfied, state the downgrade plainly before continuing:

`Coordinator(Pipeline Mode): Subagent default is not active for <command>: <reason>. Running sequentially in this context instead.`

Command-specific defaults:

- `/reverse-spec`: use spawned subagents for CodeBase Analyzer inventory and each bounded extraction pass or module chunk. The Coordinator remains responsible for checkpoints, artifact routing, synthesis acceptance, and user-facing status.
- `/code-review`: use spawned Code Review and Security subagents in parallel after the Coordinator readiness gate passes. The Coordinator remains responsible for readiness checks and routing findings after both subagents report.

## Debate Routing Guard (Blocking)

When the user asks for a debate, uses `/debate`, asks for a "2 round debate", or otherwise requests multiple agents/models to argue a question, default to **Swarm Consensus debate with external peer LLM CLIs** such as Claude, Gemini, Codex, or other configured external peers.

- Platform subagents, current-LLM helper agents, repo-persona consultations, and same-family child agents must not be used to satisfy a debate request by default.
- Use platform subagents for a debate only when the user explicitly asks for current-LLM subagents, local subagents, repo-persona debate, or cross-agent consultation.
- Generic wording such as "agents", "debaters", "external agents", or "models" is not enough to justify current-LLM subagents; route to Swarm Consensus external peers instead.
- If external peer CLIs are unavailable, say so and stop or continue only under the Swarm Consensus fallback rules. Do not silently fall back to platform subagents.
- Before launching any debate, state which protocol will be used: `Swarm Consensus debate` or `repo-persona subagent consultation`.
- When naming debate participants, show the resolved or planned **model name/version** first. CLI version strings are diagnostics only and must not be presented as model identity.

## Cowork Routing Guard

When the user asks multiple LLMs to work together on a bounded file-editing task, asks for `/cowork`, or describes agents changing files in tandem, route to `<AI_DEV_SHOP_ROOT>/framework/slash-commands/cowork.md`.

- Use `/cowork` for collaborative implementation where all participants read the scoped files, independently design or diagnose the whole task without seeing each other's proposals, compare blind spots and disagreements, converge on one shared design/edit plan, then have one writer implement while non-writers peer-verify the resulting diff.
- Do not treat `/cowork` as parallel subagent decomposition. File leases are merge-control only; they must not become isolated model-owned design slices.
- Do not route collaborative file-editing requests to `/debate`; `/debate` is reasoning-only.
- Do not route collaborative file-editing requests to `/audit-work`; `/audit-work` is independent review-only and must not apply edits.
- If the file set is unbounded or the task needs the full staged delivery pipeline, route to the normal pipeline instead of `/cowork`.
- `/cowork` may reduce the need for `/audit-work` only under its documented low-risk, green-test, no-disagreement audit-skip policy.
