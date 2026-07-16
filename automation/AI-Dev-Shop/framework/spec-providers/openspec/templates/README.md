# OpenSpec Templates

These templates follow OpenSpec's native artifact format for the default `spec-driven` schema.

## Template Files

- `proposal.md` — Change proposal: why, what changes, capabilities, impact
- `spec.md` — Delta spec: ADDED, MODIFIED, REMOVED requirements with WHEN/THEN scenarios
- `design.md` — Technical design: context, goals, decisions, risks
- `tasks.md` — Implementation checklist: numbered groups with checkbox items

## Usage

When the active provider is `openspec`, use these templates to scaffold change folder artifacts under `openspec/changes/<change-name>/`.

Delta specs are created per domain under `specs/<domain>/spec.md` within the change folder. Each domain gets its own copy of the `spec.md` template.

See `framework/spec-providers/openspec/compatibility.md` for the full workflow.
