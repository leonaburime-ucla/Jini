# Harness Hooks

Host- or harness-level lifecycle integration points that let the coding environment run
extra logic automatically when specific events happen (session start/end, tool use,
completion, handoff).

Scripts here are **LLM-agnostic**: they are plain Bash and take their inputs from stdin
JSON or CLI flags, so any host can use them. A host with a native hook system (Claude
Code) wires them to lifecycle events; a host without one (Codex CLI, Gemini CLI) invokes
them directly per an instruction in `AGENTS.md`.

## Active hooks

### `session-record.sh` — session summaries

Writes one record per conversation to `<host>/ADS-memory/sessions/`, capturing date/time,
the user, the AI model(s) used, and a space for the AI to fill in a summary, the questions
asked, the answers given, and decisions.

Subcommands:

- `update` — create or refresh `ADS-memory/sessions/CURRENT-SESSION.md`. Refreshes only the
  metadata block; never overwrites the AI-written summary body.
- `finalize` — archive `CURRENT-SESSION.md` to a dated file `YYYY-MM-DD-HHmmSS-<topic>.md`.

Options: `--models "A, B"`, `--user "Name"`, `--project-dir PATH`, `--topic "text"`.
Run `bash session-record.sh --help` for the full contract.

**Model detection.** Claude Code passes a JSON payload on stdin whose `transcript_path`
records the model on every message, so the script reads it and captures every model used —
including mid-session `/model` switches. There is intentionally **no** reliance on a
`$CLAUDE_MODEL` env var: Claude Code does not set one (only `SessionStart` receives a
conditional `model` field). Peer models the transcript cannot see (Codex/Gemini dispatched
as peers) are supplied by the AI via `--models`; detected and supplied models are merged
and de-duplicated. Automatic refreshes also merge in the models already recorded in the
stub, so peer models supplied on an earlier update are preserved even though a later
`Stop`-hook refresh runs without `--models` and the transcript cannot rediscover them.

**Never blocks.** It only reads stdin when stdin is a real pipe or file, and always exits 0,
so it cannot hang or fail a session.

#### Claude Code wiring (`.claude/settings.json`)

- `Stop` → `session-record.sh update` (refresh the current record each turn)
- `SessionEnd` → `session-record.sh finalize` (archive on session end)
- `SessionStart` → `session-record.sh finalize` (archive any leftover stub from a session
  that ended without firing `SessionEnd`, e.g. a crash)

#### Other hosts (Codex CLI, Gemini CLI, generic)

These hosts have no lifecycle hooks. The AI invokes the script directly, passing its own
model (and any peer models) since there is no Claude transcript to read:

```bash
# during / at end of a session
bash harness-engineering/hooks/session-record.sh update \
  --models "Codex 5.5 xhigh" --user "<name>" --project-dir "<host-root>"
bash harness-engineering/hooks/session-record.sh finalize --topic "<short topic>"
```

The authoritative summary content and model list are always written by the AI (only the AI
knows the peer models and can summarize the Q&A); the hook guarantees a record exists and is
archived even if the AI forgets.

### `pre-commit` — see `install-hooks.sh`

Git pre-commit integration installed via `install-hooks.sh`.

## Adding new hooks

- Keep scripts host-agnostic: read stdin JSON or CLI flags, resolve the project root from
  `$CLAUDE_PROJECT_DIR` / `--project-dir` / stdin `cwd` / git toplevel, and never block on
  stdin or fail the caller.
- Wire Claude Code via `.claude/settings.json`; document the manual invocation for other
  hosts in `AGENTS.md`.
- Follow `harness-engineering/runtime/capability-verification.md`: only claim a host
  integration once it is verified on that host.
