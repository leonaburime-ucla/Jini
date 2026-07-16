# Slash Commands Registry

When the user types any command listed below, read and execute the corresponding file in this directory (`framework/slash-commands/<file>`).

## How to dispatch

1. Match the user's input to a command in the table below.
2. Read the full contents of the corresponding `.md` file.
3. Follow the instructions in that file exactly.

If the user types a command not in this table, say so and list available commands.

## Available Commands

| Command | File | Purpose |
|---------|------|---------|
| `/spec` | spec.md | Start a new feature spec |
| `/plan` | plan.md | Architecture planning / Software Architect dispatch |
| `/blueprint` | blueprint.md | Macro-level system design before detailed specs |
| `/tasks` | tasks.md | Generate task list for an approved feature |
| `/implement` | implement.md | Dispatch the implementation sequence |
| `/code-review` | code-review.md | Dispatch the code-review pipeline |
| `/clarify` | clarify.md | Clarification pass on the active feature spec |
| `/debate` | debate.md | Multi-model structured debate on a question |
| `/consensus` | consensus.md | Swarm consensus — converge multiple perspectives |
| `/cowork` | cowork.md | Collaborative multi-LLM file editing |
| `/audit-work` | audit-work.md | External audit of completed work |
| `/agent <name>` | agent.md | Enter Agent Direct Mode with a named agent |
| `/handoff` | handoff.md | Produce a handoff artifact for session continuity |
| `/reverse-spec` | reverse-spec.md | Extract a spec from existing code |

## Project-Specific Commands

These are project-specific and may not apply to all repos:

| Command | File | Purpose |
|---------|------|---------|
| `/gstack-design` | gstack-design.md | Invoke gstack design skill |
| `/gstack-ios` | gstack-ios.md | Invoke gstack iOS skill |
| `/gstack-release` | gstack-release.md | Invoke gstack release skill |

## For LLMs Without Native Slash-Command Support

If you are an LLM that does not have a native `.claude/commands/` mechanism (e.g., Codex CLI, Gemini CLI, or API-based invocations):

- Treat this file as your command registry.
- When the user types `/command`, look it up here and read the corresponding file.
- Pass `$ARGUMENTS` (everything after the command name) into the template where indicated.
