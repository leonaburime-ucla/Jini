# Speckit Provider

- provider: `speckit`
- upstream_repo: `https://github.com/github/spec-kit`
- upstream_commit: `2c2fea8783f33085652b8c87e839bae84a6eb78d`
- source_grounding: `cloned_repo`
- activation: `default`
- repo_validation: `exercised_here_as_an_ai_dev_shop_compatibility_flow_not_as_a_literal_upstream_.specify_install`
- default: `true`

## Scope

This file describes upstream Spec Kit as of the pinned commit above and the AI Dev Shop integration slice that can safely be inferred from that upstream source.

AI Dev Shop core still owns:
- Coordinator routing
- constitution enforcement at the toolkit level
- Red-Team review
- AI Dev Shop ADR output
- downstream TDD, implementation, review, and security stages

## User Note

The current AI Dev Shop `speckit` path is a compatibility profile, not a byte-for-byte mirror of an upstream Spec Kit project.

Do not present these AI Dev Shop-local artifacts as though they were native upstream Spec Kit files:
- `feature.spec.md`
- `api.spec.md`
- `state.spec.md`
- `spec-dod.md`

Those are local compatibility constructs. Upstream Spec Kit's native feature artifacts live under `specs/<feature-id>/` and `.specify/`.

AI Dev Shop's default storage for durable forward specs is `<ADS_MEMORY_ROOT>/specs/<feature-id>/`. The upstream `specs/<feature-id>/` paths below describe Spec Kit's native conceptual surface; pipeline state must record the actual AI Dev Shop path used for the run.

## Upstream Install And Runtime Model

Upstream Spec Kit is a Python CLI and agent-integration toolkit centered on `specify`.

Native bootstrap:
- install with `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<tag>` or run one-shot with `uvx`
- initialize with `specify init <project>` or `specify init .`
- agent command files and templates are installed into the project during init

Runtime assumptions:
- the project root contains a `.specify/` directory
- project principles live in `.specify/memory/constitution.md`
- active feature context is normally inferred from the Git branch name, for example `001-photo-albums`
- non-Git or branchless usage can override feature detection with `SPECIFY_FEATURE`
- template and command behavior can be overridden by project-local overrides, presets, and extensions under `.specify/`

## Native Project Roots

| Path | Purpose |
|---|---|
| `.specify/memory/constitution.md` | project constitution and governing principles |
| `.specify/templates/` | core templates copied or resolved at runtime |
| `.specify/templates/overrides/` | project-local template overrides |
| `.specify/presets/<preset-id>/` | installed preset templates and commands |
| `.specify/extensions/<ext-id>/` | installed extension logic, templates, and config |
| `specs/<feature-id>/spec.md` | provider-native feature specification |
| `specs/<feature-id>/plan.md` | technical implementation plan |
| `specs/<feature-id>/tasks.md` | task breakdown for implementation |
| `specs/<feature-id>/research.md` | optional research notes generated during planning |
| `specs/<feature-id>/data-model.md` | optional data model output from planning |
| `specs/<feature-id>/contracts/` | optional interface or contract artifacts |
| `specs/<feature-id>/quickstart.md` | optional validation scenarios and usage checks |

## Native Command Surface

Bootstrap and management:
- `specify init`
- `specify check`
- `specify preset ...`
- `specify extension ...`

Chat or skills workflow:
- `/speckit.constitution`
- `/speckit.specify`
- `/speckit.clarify`
- `/speckit.checklist`
- `/speckit.plan`
- `/speckit.tasks`
- `/speckit.analyze`
- `/speckit.implement`
- `/speckit.taskstoissues`

Codex skill mode note:
- upstream documents Codex using `$speckit-<command>` skill invocation instead of slash commands

## Native Workflow

The upstream happy path is:

1. `specify init` to create `.specify/` and agent assets
2. `/speckit.constitution` to establish project rules
3. `/speckit.specify` to create the feature branch and `specs/<feature-id>/spec.md`
4. `/speckit.clarify` and `/speckit.checklist` to refine and validate the spec
5. `/speckit.plan` to create `plan.md` and supporting design artifacts
6. `/speckit.tasks` to derive executable tasks, including `[P]` markers for safe parallel work
7. optional `/speckit.analyze` to cross-check consistency before implementation
8. `/speckit.implement` to execute the task list

Important upstream behavior:
- feature numbering and branch creation are part of `/speckit.specify`
- template resolution is dynamic and influenced by overrides, presets, and extensions
- command registration is install-time behavior, not just static markdown files in one folder

## Canonical Artifact Graph

| Artifact | Required | Produced By | Role |
|---|---|---|---|
| `.specify/memory/constitution.md` | once per project | `/speckit.constitution` | project-wide governing principles |
| `specs/<feature-id>/spec.md` | yes | `/speckit.specify` | feature requirements and acceptance criteria |
| `specs/<feature-id>/plan.md` | yes before task generation | `/speckit.plan` | technical plan and architecture direction |
| `specs/<feature-id>/tasks.md` | yes before implementation | `/speckit.tasks` | executable work breakdown |
| `specs/<feature-id>/research.md` | optional | `/speckit.plan` | research evidence for technical choices |
| `specs/<feature-id>/data-model.md` | optional | `/speckit.plan` | data entities and relationships |
| `specs/<feature-id>/contracts/**` | optional | `/speckit.plan` | API, event, or interface contracts |
| `specs/<feature-id>/quickstart.md` | optional | `/speckit.plan` | validation or usage scenarios |

## Native Artifact Contract

| Role | Speckit Surface |
|---|---|
| `spec_entrypoint` | `specs/<feature-id>/spec.md` |
| `spec_supporting_artifacts` | `plan.md`, `tasks.md`, optional `research.md`, `data-model.md`, `contracts/**`, `quickstart.md`, plus `.specify/memory/constitution.md` as project-wide policy input |
| `clarification_surface` | iterative edits to `spec.md` driven by `/speckit.clarify`, with checklist validation from `/speckit.checklist` |
| `readiness_artifact` | for AI Dev Shop spec handoff: approved `spec.md` after clarify/checklist; for full upstream execution path: `plan.md` gates `/speckit.tasks` and `tasks.md` gates `/speckit.implement` |
| `hash_anchor` | `specs/<feature-id>/spec.md` |
| `architecture_inputs` | `spec.md`, `.specify/memory/constitution.md`, and any generated `plan.md` support artifacts already present for the feature |
| `delivery_plan_inputs` | `plan.md`, optional `research.md`, `data-model.md`, `contracts/**`, `quickstart.md`, and `tasks.md` when task generation has already occurred |
| `parallelism_syntax` | `[P]` markers in `tasks.md` |

## AI Dev Shop Translation Rules

- Treat the recorded `spec_entrypoint_path` as the feature-requirements source of truth. In AI Dev Shop's default storage mapping, that path is under `<ADS_MEMORY_ROOT>/specs/<feature-id>/`.
- Treat `.specify/memory/constitution.md` as provider-native project policy input.
- When `plan.md` exists, treat it as provider-native technical planning rather than pretending AI Dev Shop invented the architecture context from scratch.
- When `tasks.md` exists, treat it as provider-native delivery planning input and preserve upstream `[P]` markers.
- Do not relabel AI Dev Shop-local files as though they were native upstream Spec Kit artifacts.
- Keep AI Dev Shop retained reports under `<ADS_MEMORY_ROOT>/reports/pipeline/<feature>/` instead of mutating the provider planning folder to store toolkit-only artifacts.

## AI Dev Shop Compatibility Assets

The AI Dev Shop-local Speckit compatibility surface is intentionally localized here:

- workflow contract: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/compatibility.md`
- strict package templates: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/templates/spec-system/`
- mechanical validator: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/validators/validate_spec_package.py`

Core workflow files should reference these assets instead of owning independent Speckit-specific rules.

## Activation Checklist

- `.specify/` exists, or the run is explicitly documented as using AI Dev Shop's Speckit compatibility mode
- the active feature id is known from Git branch or `SPECIFY_FEATURE`
- `.specify/memory/constitution.md` exists or the run records why the constitution phase is being backfilled
- any active presets or extensions that materially affect templates are recorded in `pipeline-state.md`
- if AI Dev Shop is consuming compatibility-shim artifacts instead of native upstream files, that fact is written down explicitly

## Known Gaps And Risks

- This repo does not yet mirror upstream Spec Kit's full preset, extension, catalog, and hook systems.
- This repo's default Speckit flow is still an AI Dev Shop compatibility layer, even though its local assets now live under `framework/spec-providers/speckit/`.
- Upstream command generation across many IDEs is not fully represented here.
- `taskstoissues` and other extension-heavy surfaces are not yet modeled as first-class AI Dev Shop integration points.
