# BMAD Provider

- provider: `bmad`
- upstream_repo: `https://github.com/bmad-code-org/BMAD-METHOD`
- upstream_commit: `cfe40fccd5b7dff6b28b96e61e72c2c245b562bc`
- source_grounding: `cloned_repo`
- activation: `selectable_non_default`
- repo_validation: `not_tested_end_to_end_in_this_repo`
- default: `false`

## User Note

This provider profile has not been tested end-to-end in this repo yet.

It is source-grounded against the pinned upstream commit above, but it is still an unexercised adapter here.

## Scope

This file describes upstream BMAD-METHOD as of the pinned commit above and the AI Dev Shop integration slice that can safely be inferred from that upstream source.

AI Dev Shop core still owns:
- Coordinator routing
- constitution enforcement at the toolkit level
- Red-Team review
- AI Dev Shop ADR output
- downstream TDD, implementation, review, and security stages

## Upstream Install And Runtime Model

Upstream BMAD-METHOD is an installer-driven module ecosystem, not just a static set of markdown files.

Native bootstrap:
- install with `npx bmad-method install`
- select modules, tools, and output folder during installation
- re-run the installer when modules or tool integrations change so generated skills stay in sync

Runtime assumptions:
- the project root contains `_bmad/` for framework/module installation state
- generated artifacts live under `_bmad-output/` by default, but the output folder is configurable
- skills are generated into IDE-specific locations such as `.claude/skills/` or `.cursor/skills/`
- workflows are selected by invoking generated skills or by loading agents and using agent menu triggers
- the upstream docs recommend fresh chats for each workflow to preserve context quality

AI Dev Shop default storage maps BMAD planning output under `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/`. The upstream `_bmad-output/` paths below describe BMAD's native conceptual surface; pipeline state must record the actual AI Dev Shop path used for the run.

## Native Project Roots

| Path | Purpose |
|---|---|
| `_bmad/` | installed framework and selected modules |
| `_bmad-output/planning-artifacts/PRD.md` | standard-track product requirements document |
| `_bmad-output/planning-artifacts/ux-spec.md` | optional UX design artifact |
| `_bmad-output/planning-artifacts/architecture.md` | architecture document for the standard track |
| `_bmad-output/planning-artifacts/epics/` | epic and story-planning outputs |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | sprint sequencing and current implementation state |
| `_bmad-output/project-context.md` | optional project constitution equivalent for implementation rules |
| `.claude/skills/bmad-*/SKILL.md`, similar tool dirs | generated BMad agent, workflow, task, and tool skills |

## Native Command Surface

Core guidance:
- `bmad-help`

Agent launcher skills:
- `bmad-agent-pm`
- `bmad-agent-architect`
- `bmad-agent-sm`
- `bmad-agent-dev`
- `bmad-agent-ux-designer`

Phase workflows:
- `bmad-brainstorming`
- `bmad-domain-research`
- `bmad-market-research`
- `bmad-technical-research`
- `bmad-create-product-brief`
- `bmad-create-prd`
- `bmad-create-ux-design`
- `bmad-create-architecture`
- `bmad-create-epics-and-stories`
- `bmad-check-implementation-readiness`
- `bmad-sprint-planning`
- `bmad-create-story`
- `bmad-dev-story`
- `bmad-code-review`
- `bmad-correct-course`
- `bmad-sprint-status`
- `bmad-retrospective`
- `bmad-generate-project-context`
- `bmad-quick-dev`

## Native Workflow

Standard BMM track:

Phase 1, optional analysis:
1. brainstorming and research workflows
2. optional `bmad-create-product-brief`

Phase 2, planning:
3. `bmad-create-prd`
4. optional `bmad-create-ux-design`

Phase 3, solutioning:
5. `bmad-create-architecture`
6. `bmad-create-epics-and-stories`
7. `bmad-check-implementation-readiness`

Phase 4, implementation:
8. `bmad-sprint-planning`
9. repeat `bmad-create-story` -> `bmad-dev-story` -> `bmad-code-review`
10. use `bmad-sprint-status`, `bmad-correct-course`, and `bmad-retrospective` as needed

Quick flow:
- `bmad-quick-dev` is a separate fast path for smaller work and can emit `spec-*.md` plus code without running the full BMM planning stack

Important upstream behavior:
- skills are generated from module manifests at install time
- output paths are not purely fixed filenames; they depend on install configuration and selected modules
- `project-context.md` is the upstream constitution-like artifact for implementation rules

## Canonical Artifact Graph

Standard BMM track:

| Artifact | Required | Produced By | Role |
|---|---|---|---|
| `_bmad-output/planning-artifacts/product-brief.md` | optional | `bmad-create-product-brief` | strategic framing |
| `_bmad-output/planning-artifacts/PRD.md` | yes on standard track | `bmad-create-prd` | requirements and scope |
| `_bmad-output/planning-artifacts/ux-spec.md` | optional | `bmad-create-ux-design` | UX behavior and flows |
| `_bmad-output/planning-artifacts/architecture.md` | yes before epics/stories on standard track | `bmad-create-architecture` | technical design and decisions |
| `_bmad-output/planning-artifacts/epics/**` | yes before dev loop on standard track | `bmad-create-epics-and-stories` | work decomposition |
| readiness decision | strongly recommended | `bmad-check-implementation-readiness` | PASS, CONCERNS, or FAIL gate |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | yes before story loop | `bmad-sprint-planning` | sprint sequencing and story state |
| `story-[slug].md` outputs within planning or implementation artifacts | repeated | `bmad-create-story` | focused story context for development |
| `_bmad-output/project-context.md` | optional but important | manual creation or `bmad-generate-project-context` | project-specific implementation rules |

Quick flow:
- `bmad-quick-dev` can create `spec-*.md` plus code as a compact alternate track

## Native Artifact Contract

| Role | BMAD Surface |
|---|---|
| `spec_entrypoint` | standard track: `_bmad-output/planning-artifacts/PRD.md`; quick flow: the generated `spec-*.md` file(s) emitted by `bmad-quick-dev` |
| `spec_supporting_artifacts` | optional `product-brief.md`, `ux-spec.md`, `architecture.md`, epic/story artifacts, `sprint-status.yaml`, and `project-context.md` |
| `clarification_surface` | iterative workflow conversations and artifact revisions; BMAD does not define one fixed inline clarification marker in the pinned source reviewed here |
| `readiness_artifact` | standard track: the decision produced by `bmad-check-implementation-readiness`; quick flow: explicit spec approval before long autonomous implementation |
| `hash_anchor` | standard track: `PRD.md`; quick flow: the active `spec-*.md` file |
| `architecture_inputs` | `PRD.md`, optional `product-brief.md`, optional `ux-spec.md`, optional `project-context.md`, and provider-native `architecture.md` when it already exists |
| `delivery_plan_inputs` | epic/story artifacts, `sprint-status.yaml`, `project-context.md`, and quick-flow `spec-*.md` when using `bmad-quick-dev` |
| `parallelism_syntax` | story and epic boundaries plus sprint sequencing; no upstream `[P]` marker equivalent is defined in the source reviewed here |

## AI Dev Shop Translation Rules

- Detect the BMAD track first: standard BMM planning path or `bmad-quick-dev`.
- Treat generated skills and the configured output folder as part of the provider, not as incidental setup noise.
- Treat `project-context.md` as the provider-native equivalent of a project constitution for implementation behavior.
- When BMAD already produced `architecture.md`, use it as provider-native architecture input instead of pretending AI Dev Shop is starting from a raw PRD alone.
- Treat epic/story artifacts and `sprint-status.yaml` as provider-native delivery planning surfaces; BMAD is not naturally modeled as one `tasks.md` file.
- Keep AI Dev Shop retained reports under `<ADS_MEMORY_ROOT>/reports/pipeline/<feature>/` instead of writing toolkit-only state into the BMAD planning output folder.

## Activation Checklist

- `_bmad/` exists
- the configured output folder is known and recorded; default AI Dev Shop runs use `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/`, and `_bmad-output/` applies only when the project explicitly uses upstream's native default
- generated BMad skills exist for the selected tool, or installation notes are recorded
- the active BMAD track is recorded as `standard_bmm` or `quick_dev`
- if using the standard track, `PRD.md` exists before architecture work and the readiness decision is recorded before the dev loop
- maintainers accept that this adapter is still untested end-to-end in this repo

## Known Gaps And Risks

- This provider profile has not been tested end-to-end in this repo yet.
- BMAD is module-driven; this file only covers the core BMM surfaces visible in the pinned upstream repo.
- Quick Dev is materially different from the standard BMM planning path and still needs a dedicated AI Dev Shop translation policy before it should ever become a default route here.
- Dynamic skill generation, agent menu triggers, party mode, and non-BMM modules are not yet normalized into AI Dev Shop-specific automation.
