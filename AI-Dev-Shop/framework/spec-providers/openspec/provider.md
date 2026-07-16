# OpenSpec Provider

- provider: `openspec`
- upstream_repo: `https://github.com/Fission-AI/OpenSpec`
- upstream_commit: `afdca0d5dab1aa109cfd8848b2512333ccad60c3`
- source_grounding: `cloned_repo`
- activation: `selectable_non_default`
- repo_validation: `not_tested_end_to_end_in_this_repo`
- default: `false`

## User Note

This provider profile has not been tested end-to-end in this repo yet.

It is source-grounded against the pinned upstream commit above, but it is still an unexercised adapter here.

## Scope

This file describes upstream OpenSpec as of the pinned commit above and the AI Dev Shop integration slice that can safely be inferred from that upstream source.

AI Dev Shop core still owns:
- Coordinator routing
- constitution enforcement at the toolkit level
- Red-Team review
- AI Dev Shop ADR output
- downstream TDD, implementation, review, and security stages

## Upstream Install And Runtime Model

Upstream OpenSpec is a Node CLI and tool-integration system centered on `openspec`.

Native bootstrap:
- install with `npm install -g @fission-ai/openspec@latest`
- initialize with `openspec init`
- refresh tool instructions after upgrades or profile changes with `openspec update`

Runtime assumptions:
- the project root contains `openspec/config.yaml`
- current system truth lives under `openspec/specs/`
- active proposed changes live under `openspec/changes/<change-id>/`
- workflow shape is driven by the selected profile and schema
- the default profile is `core`; expanded workflow commands require `openspec config profile` followed by `openspec update`

AI Dev Shop default storage maps this OpenSpec surface under `<ADS_MEMORY_ROOT>/specs/openspec/`. The upstream paths below describe OpenSpec's native conceptual layout; pipeline state must record the actual AI Dev Shop path used for the run.

## Native Project Roots

| Path | Purpose |
|---|---|
| `openspec/config.yaml` | project-level OpenSpec configuration |
| `openspec/specs/**` | current source-of-truth system specifications |
| `openspec/changes/<change-id>/.openspec.yaml` | change metadata including schema |
| `openspec/changes/<change-id>/proposal.md` | why the change exists and what is changing |
| `openspec/changes/<change-id>/specs/**` | delta specs for new, modified, removed, or renamed requirements |
| `openspec/changes/<change-id>/design.md` | technical design, when the schema includes it |
| `openspec/changes/<change-id>/tasks.md` | implementation checklist, when the schema includes it |
| `openspec/explorations/**` | optional exploratory notes outside a committed change |
| `.claude/skills/`, `.cursor/skills/`, similar tool dirs | generated AI instructions and commands for supported tools |

## Native Command Surface

CLI:
- `openspec init`
- `openspec update`
- `openspec list`
- `openspec show`
- `openspec validate`
- `openspec status`
- `openspec instructions`
- `openspec templates`
- `openspec schemas`
- `openspec config`
- `openspec archive`

Default `core` profile commands:
- `/opsx:propose`
- `/opsx:explore`
- `/opsx:apply`
- `/opsx:archive`

Expanded workflow commands:
- `/opsx:new`
- `/opsx:continue`
- `/opsx:ff`
- `/opsx:verify`
- `/opsx:sync`
- `/opsx:bulk-archive`
- `/opsx:onboard`

## Native Workflow

OpenSpec has two major workflow modes.

`core` profile:
1. `/opsx:propose` creates a change and all apply-required planning artifacts in one step
2. `/opsx:apply` implements the task list
3. `/opsx:archive` archives the completed change and merges specs

Expanded workflow:
1. `/opsx:new` creates the change root and `.openspec.yaml`
2. `/opsx:continue` walks the artifact dependency graph one artifact at a time
3. `/opsx:ff` generates all apply-required artifacts in dependency order
4. `/opsx:apply` implements
5. `/opsx:verify` checks completeness, correctness, and coherence
6. `/opsx:sync` or `/opsx:archive` reconciles deltas back into `openspec/specs/`
7. `/opsx:bulk-archive` handles multiple completed changes

The default `spec-driven` schema in the upstream repo defines this artifact sequence:
- `proposal` -> `specs` -> `design` -> `tasks`
- `apply` requires `tasks`

## Canonical Artifact Graph

OpenSpec has a split truth model:
- `openspec/specs/**` describes how the system currently behaves
- `openspec/changes/<change-id>/` describes a proposed modification

For the default `spec-driven` schema:

| Artifact | Required | Produced By | Role |
|---|---|---|---|
| `openspec/changes/<change-id>/.openspec.yaml` | yes for expanded workflow | `/opsx:new` | change metadata and schema selection |
| `openspec/changes/<change-id>/proposal.md` | yes | `/opsx:propose` or `/opsx:continue` | change intent and capability list |
| `openspec/changes/<change-id>/specs/**` | yes | `/opsx:propose`, `/opsx:continue`, or `/opsx:ff` | delta requirements for the change |
| `openspec/changes/<change-id>/design.md` | yes in default `spec-driven` schema | artifact workflow | technical approach |
| `openspec/changes/<change-id>/tasks.md` | yes before apply | artifact workflow | implementation checklist |
| `openspec/specs/**` | yes at project level | existing repo or archive/sync | current source-of-truth behavior |

## Native Artifact Contract

| Role | OpenSpec Surface |
|---|---|
| `spec_entrypoint` | `openspec/changes/<change-id>/proposal.md` for the active change |
| `spec_supporting_artifacts` | `openspec/changes/<change-id>/specs/**`, `.openspec.yaml`, and schema-selected `design.md` and `tasks.md`; `openspec/specs/**` remains baseline system truth for modified capabilities |
| `clarification_surface` | iterative edits across `proposal.md`, delta specs, and other change artifacts; `/opsx:explore` may precede change creation but does not create canonical artifacts |
| `readiness_artifact` | all apply-required artifacts for the selected schema are present; in upstream default `spec-driven` this means `proposal.md`, `specs/**`, `design.md`, and `tasks.md` are complete for the active change |
| `hash_anchor` | `openspec/changes/<change-id>/proposal.md` |
| `architecture_inputs` | `proposal.md`, delta `specs/**`, relevant baseline `openspec/specs/**`, and `design.md` when present |
| `delivery_plan_inputs` | `tasks.md`, `design.md`, delta `specs/**`, and schema metadata from `.openspec.yaml` |
| `parallelism_syntax` | numbered checkbox tasks in `tasks.md`; no upstream `[P]` marker equivalent is defined in the source reviewed here |

## AI Dev Shop Translation Rules

- Do not treat `proposal.md` alone as the whole spec. For modified capabilities, AI Dev Shop must read both delta specs in the change folder and the baseline specs under the recorded OpenSpec root. By default that root is `<ADS_MEMORY_ROOT>/specs/openspec/`.
- Treat `design.md` as provider-native technical design input, not as an optional afterthought, when the selected schema requires it.
- Treat `tasks.md` as provider-native implementation planning input.
- Treat `archive` and `sync` as provider-owned lifecycle operations that reconcile change state back into baseline specs.
- Keep AI Dev Shop retained reports under `<ADS_MEMORY_ROOT>/reports/pipeline/<feature>/` rather than storing toolkit-only state inside the provider planning folder.

## Activation Checklist

- `openspec/config.yaml` exists
- the active change root is known
- the selected workflow profile is recorded as `core` or `custom`
- the selected schema is recorded; if omitted, assume upstream default `spec-driven` only when the repo matches that default layout
- if expanded workflow commands are expected, `openspec config profile` and `openspec update` have already been run
- maintainers accept that this adapter is still untested end-to-end in this repo

## Known Gaps And Risks

- This provider profile has not been tested end-to-end in this repo yet.
- OpenSpec's workflow system is schema-driven; this file only describes the upstream `spec-driven` default schema and the command surfaces visible in the pinned source.
- `bulk-archive`, conflict resolution, and verification output are not yet normalized into AI Dev Shop-specific gate automation.
- Tool-specific generated instructions are upstream-owned and not yet modeled as first-class AI Dev Shop assets.
