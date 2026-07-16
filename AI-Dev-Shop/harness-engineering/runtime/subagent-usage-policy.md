# Subagent Usage Policy

This file defines when the framework should use spawned subagents, when it should stay in one context, and how to explain that choice to users.

## Default Rule

When the current host verifies `subagent_spawning = enabled`, the framework should default to **subagent-assisted execution** for tasks that benefit from context isolation or safe parallelism.

Capability enables that path. It does not make helper dispatch mandatory for every task.

When the current host reports `unavailable` or `unverified`, the framework should default to **single-agent mode** and say so plainly.

## What "Subagent-Assisted" Means

Subagent-assisted execution does not mean "spawn helpers for every task."

It means:

- use spawned helpers for broad discovery, sidecar review, or clearly independent work
- keep trivial or narrow work in the owner agent's context
- use subagents when they reduce context rot or unblock safe parallel work

It does **not** mean:

- spawn a generic platform helper and assume it automatically became an AI Dev Shop repo agent
- bypass the delegated bootstrap and reserved-name validity guard in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md`

## Use Subagents By Default For

- read-only discovery that would otherwise flood the implementation context
- sidecar review, grep-heavy analysis, or file mapping before implementation
- independent parallel tracks with disjoint ownership
- bounded specialist consultation where isolated context is clearly better
- `/reverse-spec` when the current host resolves to `subagent-assisted`: spawned subagents handle CodeBase Analyzer inventory and bounded extraction passes or module chunks
- `/code-review` when the current host resolves to `subagent-assisted`: spawned Code Review and Security subagents run in parallel after the Coordinator gate passes

For command-level defaults, the Coordinator must say explicitly whether spawned subagents are being used or whether the run is downgraded to the active agent's single context. Include the downgrade phrase: `Say "single-agent mode" or "disable subagents" to run this sequentially.`

## Keep Work Local For

- quick answers and small edits
- narrow single-file or single-owner tasks
- docs-only policy edits, small harness-maintenance changes, and narrow validator refinements
- cheap follow-up fixes where spawn overhead would exceed the benefit
- hosts where subagent support is unavailable or not yet verified

## Token And Cost Note

Subagent-assisted execution usually spends **more total tokens** than single-agent execution.

Why:

- each helper has its own persona/bootstrap cost
- each helper may perform separate tool calls and summaries
- parallel helpers trade cost for cleaner context and better isolation

The reason to use subagents is not token minimization. The reason is cleaner context, better isolation, and sometimes better quality on messy tasks.

## Downgrade Rule

If subagent assistance is enabled, the Coordinator should still offer a downgrade path:

- if the user asks for a cheaper or simpler run
- if the task is small enough that helper overhead is wasteful
- if helper dispatch is no longer materially reducing complexity

Use this explanation:

`Sub-agent assistance is available here, but it usually spends more total tokens than keeping the work in one context. Say "single-agent mode" or "disable subagents" if you want the cheaper sequential path.`

## User Toggles

- `single-agent mode`
- `disable subagents`
  - keep work in one context unless the user later re-enables helpers

- `re-enable subagents`
- `auto subagent mode`
  - restore the default host-capability-driven behavior

## Startup Rule

On startup, resolve the current host's subagent capability before promising helper-agent behavior.

Use:

```bash
bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>
```

Startup should use only this lightweight current-host resolver. Do not run the full `probe_host_capabilities.sh` catalog walk during startup.

Detection rule:

- prefer explicit host identity from the current runtime
- pass `--host` or set `AI_DEV_SHOP_HOST` when startup already knows the host
- use implicit auto-detection only as a fallback
- if multiple CLIs are installed and the runtime cannot be distinguished safely, the resolver should fall back to conservative `single-agent` behavior rather than guessing

If the result is `subagent-assisted`, tell the user that helper agents are available and automatic for qualifying work.

Even on hosts where subagent spawning is enabled, AI Dev Shop delegated work must follow the delegated bootstrap and reserved-name validity guard in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md`. The canonical reserved-name list lives in `<AI_DEV_SHOP_ROOT>/framework/routing/agent-index.md`. This matters especially on hosts like Codex CLI, where the platform spawning surface does not itself enforce the repo persona.

If the result is `single-agent`, tell the user that helpers are unavailable or unverified on this host and that the framework is starting sequentially instead.
