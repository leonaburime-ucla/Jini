# Pipeline Quickstart

This file holds the pipeline startup, invocation, and checkpoint details that were previously expanded in `AGENTS.md`.

## Explaining The Framework To Users

If the user is not already operating as a framework maintainer, do not assume they know the internal vocabulary.

Use `<AI_DEV_SHOP_ROOT>/framework/operations/plain-language-explanations.md` and explain the current step in this order:

1. what we are doing
2. why this step exists
3. what we need from the user (if anything)
4. what happens next

Example:

`We're doing harness engineering here, meaning we're improving the scaffolding around the agents: checks, benchmarks, resume logs, cleanup rules, and feedback loops. This step adds one of those guardrails so future runs are more reliable.`

If the current host does not support true task-tool agent spawning, say that explicitly instead of implying separate helper agents are active. Use `framework/routing/compatibility-matrix.md` only as the coarse fallback, and use `harness-engineering/validators/probe_host_capabilities.sh` for explicit capability audits or troubleshooting instead of as a startup dependency.

Resolve subagent mode at startup when Bash is available:

```bash
bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>
```

This startup resolver should do only the current-host subagent check needed for boot. Do not fan out across every installed CLI just to print the startup block.

If the result is `subagent-assisted`, default to helper-agent use for qualifying discovery, review, and parallel-safe work. If the result is `single-agent`, stay sequential and say so plainly. When helper mode is active, also explain that it usually uses more total tokens and that the user can say `single-agent mode` to turn it off.

Even when helper mode is active, spawned helpers must still be bootstrapped as AI Dev Shop repo agents. Platform subagents alone are not enough.

Host detection order:

1. Use the actual runtime/session identity when the host is already known.
2. If startup code knows the host, pass `--host <host>` explicitly or set `AI_DEV_SHOP_HOST=<host>`.
3. Only use implicit auto-detection when the host is genuinely unknown.
4. If multiple CLIs are installed and the runtime cannot be distinguished safely, the resolver intentionally falls back to `generic-llm`, which keeps startup in conservative single-agent mode until the host is identified.

## Starting the Pipeline

**Before anything else:** Confirm `<AI_DEV_SHOP_ROOT>` — the path to the AI Dev Shop toolkit folder (default: `AI-Dev-Shop/`). Then resolve `<ADS_MEMORY_ROOT>` — the sibling project-owned workspace folder (default: `ADS-memory/` next to the toolkit). Resolve the active planning provider from `<AI_DEV_SHOP_ROOT>/framework/spec-providers/active-provider.md`. Provider-native forward specs and planning artifacts are written under `<ADS_MEMORY_ROOT>/specs/` by default, retained pipeline artifacts under `<ADS_MEMORY_ROOT>/reports/`, project memory under `<ADS_MEMORY_ROOT>/knowledge/`, the real constitution under `<ADS_MEMORY_ROOT>/governance/constitution.md`, and local scratch under `<ADS_MEMORY_ROOT>/.local-artifacts/`. Only use another spec location when the user explicitly asks for that override.

Existing codebases should start with CodeBase Analyzer on the first pass to produce `ANALYSIS-*.md` and, when needed, `MIGRATION-*.md`.
If the file area is already known, Coordinator should also consult `framework/routing/file-trigger-table.md` before dispatch.

Canonical stage order and detailed dispatch behavior live in `<AI_DEV_SHOP_ROOT>/framework/workflows/multi-agent-pipeline.md`.

High-level flow:
1. Use System Design when macro boundaries are unclear or the scope spans multiple domains.
2. Spec Agent creates the provider-defined planning surface. With the default `speckit` provider, this is the strict-mode spec package. Zero unresolved clarification blockers before architecture work.
3. Human approves the planning surface, then Red-Team runs. Coordinator Planning Preflight must pass before Software Architect produces the ADR.
4. Human approves ADR, then Coordinator generates `tasks.md` and dispatches TDD.
5. Programmer implements to convergence, then review and security gates run before shipping.

If tests repeatedly fail (3+ cycles on the same cluster), escalate to human — do not keep retrying.

## Invoking the Pipeline

**Option A — Slash commands (Claude Code only)** (one-time setup):
- Claude Code: copy `<AI_DEV_SHOP_ROOT>/framework/slash-commands/` to `.claude/commands/`

**Option B — Manual (Gemini CLI, Codex CLI, Claude.ai, Generic LLM)**: paste the contents of the corresponding template file as your message, replacing `$ARGUMENTS`.

On hosts that only support Option B, the framework still uses staged routing, but true sub-agent spawning and isolated parallel contexts are not enabled.

| Command | Triggers | Produces |
|---|---|---|
| `/blueprint` | System Design Agent | system-blueprint.md with macro boundaries and spec decomposition plan |
| `/spec` | Spec Agent | spec package, [NEEDS CLARIFICATION] resolved |
| `/clarify` | Spec Agent | structured questions for unresolved markers |
| `/plan` | Coordinator Planning Preflight → Software Architect Agent | preflight result + research.md + ADR |
| `/tasks` | Coordinator | tasks.md with [P] parallelization markers |
| `/implement` | TDD → Programmer | test-certification.md → implementation to convergence |
| `/code-review` | Code Review + Security | Required/Recommended findings + security report |
| `/consensus` | Swarm Consensus | Multi-model consensus or debate report, depending on selected mode |
| `/debate` | Swarm Consensus (`debate` mode shortcut) | Multi-model debate report with bounded rebuttal rounds |
| `/audit-work` | External auditor review | Independent findings from one or more external auditors plus Coordinator cross-auditor synthesis |
| `/cowork` | Cowork Coordinator + external peer LLMs | Shared diagnosis, approved edit plan, leased file edits, peer verification, and test/audit outcome |
| `/handoff` | Coordinator | Compact continuation document for another agent, host, or future session |
| `talk to <agent>` / `switch to <agent>` | Named agent (direct) | Enters Agent Direct Mode with the specified agent |
| `talk to <agent> in consensus mode` | Named agent (direct + consensus) | Enters Agent Direct Mode and enables Swarm Consensus for debatable high-level questions |
| `switch to vibecoder` | VibeCoder Agent (direct, optional) | Quick-and-dirty prototype output with minimal structure |

`/agent <name>` and `/agent <name> consensus` are template commands only when
`framework/slash-commands/agent.md` has been installed into a host that supports
custom slash commands. Claude may reject `/agent` when that template is not
installed; use the natural-language forms above in that case.

## Human Checkpoints (Blocking)

| Checkpoint | Before |
|---|---|
| System blueprint approval (if produced) | Spec approval |
| Spec approval | Software Architect dispatch |
| Reverse-spec review digest approval (if applicable) | Software Architect dispatch |
| Red-Team clearance | Software Architect dispatch |
| Architecture sign-off | TDD dispatch |
| Convergence escalation | Burning more cycles |
| Security sign-off | Shipping |
