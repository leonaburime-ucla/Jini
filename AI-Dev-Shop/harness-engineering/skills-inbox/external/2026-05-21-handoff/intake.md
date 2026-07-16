# External Skill Intake: Handoff

- Source: `https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md`
- Upstream repo: `mattpocock/skills`
- License observed: MIT license on the upstream repository page
- Candidate domain: productivity / session continuation
- Local canonical target: `skills/handoff/SKILL.md`
- Intake date: 2026-05-21

## Extracted Signal

- Create a compact continuation document for another agent.
- Include suggested skills for the next agent.
- Prefer referencing existing artifacts over duplicating them.
- Redact secrets and sensitive information.
- Let user-provided arguments shape the next-session focus.

## Local Adaptation Notes

- Rewritten for AI Dev Shop artifact routing and handoff-contract requirements.
- Defaults to `<ADS_MEMORY_ROOT>/.local-artifacts/handoff/` when available, with OS temp as a fallback.
- Adds slash-command controls for target host and save location.
- Adds explicit next-agent prompt generation for Codex-to-Claude continuation.
