# Plain-Language Explanations

This file defines how the framework explains itself to users without assuming they already understand the internal vocabulary.

It is fine to say `harness engineering`. It is not fine to assume the user already knows what that means or why a given step exists.

## Default Pattern

When explaining a step, status update, or routing decision to a user, use this order:

1. **What we are doing**
2. **Why this step exists**
3. **What I need from you** (if anything)
4. **What happens next**

If only the first two are needed, keep it that short. Do not force all four every time.

## First-Use Rule

On the first meaningful use of an internal term in a conversation, translate it immediately.

Examples:

- `harness engineering` -> the scaffolding around the agents: checks, benchmarks, resume logs, cleanup rules, and feedback loops
- `progress-ledger` -> the resume log for long-running work
- `pre-completion checklist` -> the finish check before claiming a task is done
- `loop-detection tripwire` -> the stuck-loop warning that stops repeated blind retries
- `context offloading` -> save the long output to a file and give the short version in chat
- `spec hash` -> the exact fingerprint of the current approved spec version
- `Observer pass` -> a maintenance review that looks for drift, regressions, and repeated mistakes
- `convergence escalation` -> stop retrying and ask for a human decision because the normal loop is no longer efficient

After first use, shorter internal terms are fine if the context stays clear.

## Host Capability Translation

When a framework feature depends on host capabilities, explain that plainly instead of implying it is always active.

Examples:

- `sub-agent spawning` -> true separate helper agents with isolated context windows
- `simulated multi-agent` -> one session is following the same staged roles, but no separate helper process is running
- `parallel tasks` -> real concurrency only on hosts that support agent spawning; otherwise they are sequencing hints
- `subagent-assisted execution` -> the framework can use helper agents for discovery, review, or parallel-safe work; this usually costs more total tokens but keeps the main context cleaner

If the current host does not support true agent spawning, say so directly. Example:

`What we're doing: running the pipeline sequentially in one session. Why: this host does not support true sub-agent spawning or isolated parallel agent windows, so the framework uses the same stages without pretending separate helpers are active. Next: I'll keep outputs compact and use offload files when the context would get noisy.`

When the capability is not proven locally, say `unverified` rather than `unsupported`.

When subagent assistance is enabled, also say that it usually uses more total tokens than a single-agent run and tell the user they can say `single-agent mode` if they want the cheaper sequential path.

## Good User-Facing Style

- explain the current step, not the whole framework manual
- translate the term before or as you use it
- say why the step protects quality, reduces rework, or avoids drift
- prefer concrete outcomes over framework slogans
- tell the user exactly what input is needed, or that no input is needed

## Avoid

- stacking multiple unexplained internal terms in one sentence
- naming files or policies without explaining why they matter
- dumping the full pipeline when the user only needs the current stage
- talking about "the harness" as if it is self-explanatory

## Example Patterns

### Status Update

`What I'm doing: I'm adding the resume log for long-running work. Why: if a session breaks, the next session can continue without reconstructing everything from memory. Next: I'll wire it into the recovery docs and the coordinator rules.`

### Escalation

`What we're hitting: the implementation loop is repeating the same failure. Why this matters: more retries are unlikely to help, so the framework treats this as a stuck-loop warning instead of wasting more cycles. What I need from you: a decision on whether to change the spec, change direction, or stop this run.`

### Harness Engineering

`We're doing harness engineering here, meaning we're improving the scaffolding around the agents: checks, benchmarks, resume logs, cleanup rules, and feedback loops. This step adds one of those guardrails.`
