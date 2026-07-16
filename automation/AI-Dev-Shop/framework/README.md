# Framework

This folder groups the toolkit-owned framework surface that controls how ADS runs.

## Layout

- `spec-providers/` defines the active planning provider boundary and provider profiles
- `templates/` holds framework templates consumed by agents and workflows
- `workflows/` defines pipeline rules, state formats, and conventions
- `slash-commands/` holds reusable command templates for hosts that support or emulate slash commands
- `governance/` holds toolkit policy and runtime governance rules
- `memory/` holds static memory architecture/schema docs, not live project memory
- `operations/` holds startup, reminders, quickstarts, and other toolkit operating guidance
- `operations/scripts/` holds helper scripts that support framework operations
- `routing/` holds the agent roster, registry, compatibility matrix, and other dispatch/routing references
- `examples/` holds toolkit examples and golden samples

## Boundary Rule

If a file changes per host project or should be committed with the host project's GitHub repo, it does not belong in `framework/`.

That project-owned state belongs in the external sibling workspace:

- `<ADS_MEMORY_ROOT>/governance/`
- `<ADS_MEMORY_ROOT>/knowledge/`
- `<ADS_MEMORY_ROOT>/reports/`
- `<ADS_MEMORY_ROOT>/.local-artifacts/`
- `<ADS_MEMORY_ROOT>/meta/`
- `<ADS_MEMORY_ROOT>/tmp/`

Inside ADS itself, `project-knowledge-template/` is the repo-local template for that workspace shape.

## Write Rules

- Treat everything under `framework/` as read-only during normal host-project feature work unless the user is explicitly maintaining ADS itself.
- During normal project work, project-specific writes go to `<ADS_MEMORY_ROOT>/...`, not `framework/`.
- During ADS maintenance, use the repo-local `project-knowledge-template/` template surface for retained artifacts, scratch output, and other workspace-shaped test data.
