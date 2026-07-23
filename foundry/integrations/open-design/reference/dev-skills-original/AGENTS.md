# dev-skills

Agent-agnostic **contributor / repo-maintenance skills** — `SKILL.md` workflows that any code agent (Claude Code, Codex, Gemini CLI, Cursor, OpenCode, …) can load to perform a rigorous repo task the same way every time.

These are **not** Open Design product skills:

- They are **not** surfaced in the OD web UI (Settings → Skills) and **not** listed under `/api/skills` — that catalog is `../skills/`, which holds user-facing design/creative skills (`od.mode: utility`).
- They target *developing this repository*, not generating design artifacts on user input.
- They live here (a plain top-level folder) rather than `.claude/skills/` so they aren't tied to one agent. Each is a portable folder; to use it, an agent reads it in place or copies it into its own skills directory.

## Format

Each skill is a folder with a `SKILL.md` (YAML frontmatter: `name`, `description`, optional `triggers`, `audience: contributor`) plus any `references/`, `templates/`, or scripts it needs. The body names *capabilities* ("track progress as a task list", "ask the user", "run this command"), never a specific agent's tool API, so it runs under any harness.

## Entries

- `fixing-open-design/` — refactor a backend/daemon subsystem into the machine-enforced capability-barrel architecture (the `apps/daemon/src/design-systems/` pattern): split a flat/god-file module into a `core/` foundation kernel + concern subdirectories with barrels, break dependency cycles, register the `check-barrel-imports` guard, document every file/function, validate, and open a PR. Reference implementation: `apps/daemon/src/design-systems/`.

## Adding a dev skill

1. Create `dev-skills/<name>/SKILL.md` with `name` + `description` frontmatter and a phased body.
2. Keep it agent-agnostic — map capabilities, not tool APIs.
3. Point at a real, working reference in the repo wherever possible (docs-as-precedent beats abstract instructions).
4. Add a one-line entry to the list above.
