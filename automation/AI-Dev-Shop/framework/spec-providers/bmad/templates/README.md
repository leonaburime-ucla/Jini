# BMAD Templates

These templates follow BMAD's native artifact format for the BMM (BMad Method) module.

## Dual-Track Structure

BMAD supports two tracks:

**Standard BMM track** (full planning pipeline):
- `prd.md` — Product Requirements Document: requirements, scope, user stories, success metrics
- `architecture.md` — Architecture decisions: technical design built collaboratively
- `epic.md` — Epic and story breakdown: requirements inventory, BDD stories with acceptance criteria
- `story.md` — Individual story file: dev context, tasks, acceptance criteria, references

**Quick Dev track** (lightweight spec-first):
- `quick-dev-spec.md` — Single spec file: intent, boundaries, I/O matrix, tasks, verification

## Usage

When the active provider is `bmad`, use the appropriate track templates based on the user's selection.

Standard track artifacts go under `_bmad-output/planning-artifacts/` by default. Quick dev specs go wherever the user specifies.

See `framework/spec-providers/bmad/compatibility.md` for the full workflow.
