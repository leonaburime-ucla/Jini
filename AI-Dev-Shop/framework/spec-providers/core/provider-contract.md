# Spec Provider Contract

This document defines the boundary between an upstream planning framework and the AI Dev Shop pipeline.

The goal is simple:
- keep provider-specific rules in one place
- keep the rest of the pipeline reusable
- let the repo default to `speckit` without hardcoding Speckit assumptions everywhere
- prevent thin provider summaries from being mistaken for upstream truth

---

## What A Provider File Is

Each `framework/spec-providers/<provider>/provider.md` is a supported integration contract for AI Dev Shop.

It is not:
- a marketing summary of the upstream project
- a vague folder map
- permission to invent missing semantics from memory

It must say exactly which upstream version it was written against, what slice AI Dev Shop understands, and what remains unsupported or untested.

---

## Mandatory Metadata

Each provider file must declare:

- `provider`
- `upstream_repo`
- `upstream_commit`
- `source_grounding`
- `activation`
- `repo_validation`
- `default`

Use the fields this way:

| Field | Meaning |
|---|---|
| `provider` | Stable provider id used in `pipeline-state.md` |
| `upstream_repo` | Canonical upstream repository URL |
| `upstream_commit` | Exact commit the provider file was grounded against |
| `source_grounding` | How the file was produced, for example `cloned_repo` or `docs_only` |
| `activation` | Whether the provider is the default path, selectable but non-default, or disabled |
| `repo_validation` | Whether this repo has actually exercised the provider end-to-end |
| `default` | Whether Coordinator should choose this provider absent an explicit switch |

---

## Mandatory Sections

Every provider file must answer these questions explicitly:

1. What upstream system is this describing?
2. How is that system installed or initialized?
3. What folders and files are native to that system?
4. What command surface exists for humans or agents?
5. What workflow modes or lifecycle phases exist?
6. What artifact graph is canonical upstream truth?
7. Which native artifacts must AI Dev Shop read for architecture and delivery planning?
8. What must be recorded in `pipeline-state.md` before work continues?
9. What upstream features are not yet modeled or not yet safe to assume here?
10. What parts of the integration remain untested in this repo?

At minimum, each provider file must include these sections:

- `Scope`
- `User Note` when the provider is not fully exercised in this repo
- `Upstream Install And Runtime Model`
- `Native Project Roots`
- `Native Command Surface`
- `Native Workflow`
- `Canonical Artifact Graph`
- `Native Artifact Contract`
- `AI Dev Shop Translation Rules`
- `Activation Checklist`
- `Known Gaps And Risks`

---

## Canonical Roles

Every provider must describe the same core roles, even if the native file names differ.

| Role | Meaning |
|---|---|
| `spec_entrypoint` | The primary feature or change artifact AI Dev Shop should treat as the intake entrypoint for the active run |
| `spec_supporting_artifacts` | Additional provider-owned planning files that complete the feature or change definition |
| `clarification_surface` | Where unresolved scope, behavior, or design questions are expected to be resolved upstream |
| `readiness_artifact` | The upstream artifact or decision that proves the feature or change is ready for the next major downstream step |
| `hash_anchor` | The file whose content hash is the best drift anchor for the active run |
| `architecture_inputs` | Which provider artifacts Architect or an equivalent downstream stage must read before writing AI Dev Shop architecture outputs |
| `delivery_plan_inputs` | Which provider artifacts AI Dev Shop uses to generate or validate implementation work breakdown |
| `parallelism_syntax` | Native syntax or unit of independent work, if the provider has one |

Some providers have dual truth surfaces. Example: OpenSpec keeps `openspec/specs/` as current system truth while an active change lives under `openspec/changes/<change>/`. Provider files must explain that split instead of collapsing it into one guessed file.

AI Dev Shop stores project-owned provider output under `<ADS_MEMORY_ROOT>/specs/` by default. Provider files may describe upstream-native roots such as `<repo>/specs/`, `openspec/`, or `_bmad-output/`, but compatibility contracts must state the AI Dev Shop output mapping and pipeline-state paths must record the actual files written.

---

## AI Dev Shop Core Ownership

The provider does not replace the whole toolkit.

AI Dev Shop core still owns:
- Coordinator routing
- Constitution enforcement at the toolkit level
- Red-Team and Software Architect stages
- TDD, Programmer, TestRunner, Code Review, Security, and Docs stages
- pipeline state, retry policy, and recovery rules

Providers only own the upstream planning/spec surface and how that surface is mapped into the core pipeline.

---

## State Recording

When a run uses a provider, `pipeline-state.md` should record at least:

- `spec_provider`
- `provider_version_ref`
- `provider_native_root` (the upstream-native conceptual root, such as `specs/`, `openspec/`, or `_bmad-output/`)
- `provider_output_root` (the actual durable root used for this run; default under `<ADS_MEMORY_ROOT>/specs/`)
- `spec_entrypoint_path`
- `spec_readiness_artifact`
- `spec_hash`
- `spec_hash_verified_at` after Coordinator mechanically verifies the provider
  hash anchor with validator output or a deterministic shell command
- `planning_preflight_status`
- `planning_preflight_checked_at`
- `validator_result` or `validator_manual_waiver`
- `red_team_status`
- `red_team_spec_hash`

Optional but strongly recommended:

- `spec_support_paths`
- `provider_mode`
- `provider_change_id`
- `provider_install_notes`
- `system_blueprint_path`
- `system_blueprint_status`
- `codebase_analysis_reports`
- `reverse_spec_artifacts`
- `reverse_spec_review_status`

Existing Speckit-oriented compatibility fields such as `spec_path` remain valid for legacy runs, but new provider specs must not rely on legacy names alone.

---

## Consumer Rules

Coordinator:
- resolve the active provider before `/spec`, `/clarify`, `/plan`, resume validation, manual Software Architect dispatch, or artifact gate checks
- do not assume `feature.spec.md`, `PRD.md`, `proposal.md`, or any other filename unless the active provider says so
- refuse activation claims that are stronger than the provider file's `repo_validation`
- run the Coordinator Planning Preflight before Software Architect dispatch; do not treat provider readiness as a substitute for Red-Team, human approval, blueprint approval, or brownfield evidence checks
- do not visually or manually compute cryptographic hashes; use provider-local
  validator output or deterministic shell commands

Spec Agent:
- produce or validate the provider-defined planning surface
- record the resolved entrypoint, upstream commit, and readiness artifact in pipeline state
- stop if the provider file leaves a required native artifact or workflow decision unspecified

Software Architect:
- read the provider-defined planning surface first
- do not erase provider-native architecture artifacts when the upstream framework already has them
- emit AI Dev Shop architecture outputs as a translation layer, not as a denial of upstream structure

TDD and Programmer:
- consume the approved planning and architecture artifacts recorded in pipeline state
- do not guess filenames from Speckit defaults or from earlier placeholder adapters

Validation rule:
- if a provider file is missing a workflow rule, artifact rule, or path rule that materially affects downstream behavior, stop and escalate instead of inventing the answer
- if a provider-local validator cannot run because its runtime is unavailable,
  try documented binary fallbacks first; then stop unless a human-approved
  single-line `validator_manual_waiver` records reviewer, timestamp, reason, and
  the manual checks performed
