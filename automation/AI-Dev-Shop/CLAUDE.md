# AI Dev Shop (speckit) — Claude Code Entry Point

`<AI_DEV_SHOP_ROOT>` means the path to this toolkit folder (typically `AI-Dev-Shop/`).

Read `<AI_DEV_SHOP_ROOT>/AGENTS.md` for full operating instructions: all agent definitions, pipeline stages, routing rules, convergence policy, dispatch protocol, slash commands, and human checkpoints.

## Claude Code: Spawning Agents

Use the **Task tool** to dispatch each specialized agent. Include their `<AI_DEV_SHOP_ROOT>/agents/<name>/skills.md`, the relevant `<AI_DEV_SHOP_ROOT>/skills/*/SKILL.md` files listed in their Skills section, the active spec with hash, and the specific task directive.

## Claude Code: First-Time Initialization

On the first session in this repo, the `SessionStart` hook in `.claude/settings.json`
runs `framework/operations/scripts/ads-initialization.sh` once: it creates the
`ADS-memory/` workspace and writes a `.claude/.ads-initialized` flag so
later sessions no-op. It does **not** install slash commands.

## Claude Code: Session Records

`.claude/settings.json` also wires `harness-engineering/hooks/session-record.sh` to
lifecycle events: `Stop` refreshes `ADS-memory/sessions/CURRENT-SESSION.md` (detecting the
model(s) from the transcript), and `SessionEnd`/`SessionStart` archive it to a dated
`ADS-memory/sessions/YYYY-MM-DD-HHmmSS-<topic>.md`. When the user asks to "save this
session" or is wrapping up, write the Summary, Questions & Answers, and Decisions into
`CURRENT-SESSION.md` (leave the auto metadata block intact) and record any peer models the
transcript can't see. See the Session Records section in `<AI_DEV_SHOP_ROOT>/AGENTS.md`.

## Claude Code: Slash Command Setup

Slash-command install is opt-in and collision-checked — it is never copied
automatically, so it can't clobber a command the host already has (e.g. an existing
`/code-review`). When asked to enable slash commands, preview then install:

```bash
bash <AI_DEV_SHOP_ROOT>/framework/operations/scripts/install-slash-commands.sh --check
bash <AI_DEV_SHOP_ROOT>/framework/operations/scripts/install-slash-commands.sh --install
```

`--check` reports each command as NEW / IDENTICAL / CONFLICT; `--install` installs the
safe ones and skips conflicts (add `--overwrite` to replace agreed conflicts — originals
are backed up to `*.ads-bak`; `--include-project` adds the `gstack-*` commands). Then
type `/spec`, `/plan`, `/tasks`, `/implement`, `/code-review`, `/clarify`, `/consensus`,
`/debate`, `/audit-work`, `/cowork`, or `/handoff` in chat. On non-Claude hosts, use
Option B from `<AI_DEV_SHOP_ROOT>/AGENTS.md` — paste the template contents as a prompt.

## Tmp Space

If `/tmp` fills up (ENOSPC during audits or task spawning), clean stale session dirs:
```bash
rm -rf /private/tmp/claude-501/
```

## Eval Work — Mandatory Pre-reads

Before creating, revising, or auditing any eval suite, ALWAYS read these files first:

- `harness-engineering/agent-evals/bug-taxonomy.md`
- `harness-engineering/agent-evals/eval-design-playbook.md`
- `harness-engineering/agent-evals/README.md`

Do not begin fixture design, seed selection, or scoring until all three are loaded into context. This applies to both the coordinator and any dispatched subagent doing eval work.
