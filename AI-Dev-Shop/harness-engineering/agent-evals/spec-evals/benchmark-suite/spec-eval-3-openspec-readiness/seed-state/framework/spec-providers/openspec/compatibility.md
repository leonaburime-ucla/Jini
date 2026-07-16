# OpenSpec Compatibility Excerpt

OpenSpec creates change folders under `openspec/changes/<change-name>/`.

Required files:

- `proposal.md`
- `specs/<domain>/spec.md`
- `tasks.md`

`design.md` is required by default `spec-driven` schema unless explicitly justified in `proposal.md`.

Each delta spec requirement must include at least one Scenario with WHEN/THEN format.

Modified capabilities require reading relevant baseline specs from `openspec/specs/`.

OpenSpec clarification happens through proposal and delta-spec revision, not inline `[NEEDS CLARIFICATION]` markers.
