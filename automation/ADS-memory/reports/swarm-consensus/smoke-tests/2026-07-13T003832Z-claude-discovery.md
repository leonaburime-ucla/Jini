# Swarm Consensus CLI Smoke Test

- Generated at: `2026-07-13T00:38:32.148145+00:00`
- Host: `LAs-MacBook-Pro`
- Working directory: `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`
- Prompt: `Reply with OK and then <<SWARM_END>> only.`
- Case timeout: `75s`
- Codex --cd: `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`
- agy --cd: `/tmp`

## CLI Versions

| CLI | Path | Version |
|---|---|---|
| `claude` | `/Users/la/.npm-global/bin/claude` | `2.1.201 (Claude Code)` |
| `gemini` | `/Users/la/.npm-global/bin/gemini` | `0.47.0` |
| `codex` | `/Users/la/.npm-global/bin/codex` | `codex-cli 0.144.0` |
| `agy` | `/Users/la/.local/bin/agy` | `1.1.1` |

## Model Resolution

| CLI | Requested | Resolved | Selection Source | Note |
|---|---|---|---|---|
| `claude` | `sonnet-5` | `sonnet-5` | `per_run_override` | `explicit --claude-model` |
| `gemini` | `n/a` | `gemini-3.1-pro-preview` | `local_default` | `from ~/.gemini/settings.json` |
| `codex` | `n/a` | `gpt-5.6-terra` | `local_default` | `from /Users/la/.codex/config.toml; reasoning=medium` |
| `agy` | `n/a` | `Gemini 3.1 Pro (High)` | `default` | `agy replaces gemini CLI; run from /tmp to avoid AGENTS.md pickup` |

| Case | Status | RC | Dur (s) | JSON-ish stdout | Parsed end marker | stdout | stderr |
|---|---|---|---:|---|---|---:|---:|

## Claude Discovery

- Requirement: `json`
- Saved Claude model: `sonnet`
- Requested Claude model: `sonnet-5`
- Requested Claude family: `none`
- Saved Claude family: `sonnet`
- Cache hit: `False`
- Cache path: `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic/ADS-memory/reports/swarm-consensus/smoke-tests/last-known-good.json`
- Candidate ladder: `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic/AI-Dev-Shop/skills/swarm-consensus/references/model-candidate-ladders.json`
- Winning model: `none`
- Winning source: `n/a`

| Candidate | Source | Success | JSON OK | Text OK | Suggested Models |
|---|---|---|---|---|---|
| `sonnet-5` | `requested_model` | `False` | `False` | `False` | `none` |
| `sonnet` | `saved_claude_settings` | `False` | `False` | `False` | `none` |
| `claude-sonnet-4-6` | `saved_family_ladder:sonnet` | `False` | `False` | `False` | `none` |
| `claude-sonnet-4-5` | `saved_family_ladder:sonnet` | `False` | `False` | `False` | `none` |
| `claude-sonnet-4` | `saved_family_ladder:sonnet` | `False` | `False` | `False` | `none` |
| `claude-opus-4-7` | `fallback_family_ladder:opus` | `False` | `False` | `False` | `none` |
| `claude-opus-4-6` | `fallback_family_ladder:opus` | `False` | `False` | `False` | `none` |
| `claude-opus-4-5` | `fallback_family_ladder:opus` | `False` | `False` | `False` | `none` |
| `opus` | `fallback_family_ladder:opus` | `False` | `False` | `False` | `none` |
| `claude-haiku-4-5` | `fallback_family_ladder:haiku` | `False` | `False` | `False` | `none` |
| `claude-haiku-4` | `fallback_family_ladder:haiku` | `False` | `False` | `False` | `none` |
| `haiku` | `fallback_family_ladder:haiku` | `False` | `False` | `False` | `none` |

