# Provider Selection

Use this file when deciding whether a feature run should stay on the default provider or switch to another one.

## Default Rule

Use `speckit` unless one of the following is true:
- the project already uses OpenSpec natively
- the project already uses BMAD natively
- the user explicitly asks to switch providers
- the repo is standardizing on a different upstream planning framework

## Selection Heuristic

Choose `speckit` when:
- you want the least migration risk in this repo today
- the project is already aligned with the current AI Dev Shop default path
- you are willing to treat this repo's current Speckit support as a compatibility layer informed by upstream Spec Kit, not as a literal `.specify/` clone

Choose `openspec` when:
- the project already has `openspec/config.yaml`, `openspec/specs/`, and active change folders
- you want OpenSpec's change-folder and schema-driven workflow model
- you are comfortable operating on a provider that is source-grounded here but not yet exercised end-to-end in this repo

Choose `bmad` when:
- the project already has `_bmad/`, `_bmad-output/`, and generated BMad skills
- story-driven implementation and sprint sequencing are the natural handoff surface
- you are willing to record the selected BMAD track and output folder explicitly because BMAD is installer- and module-defined

## Mid-Feature Switching Rule

Do not silently switch providers mid-run.

If a feature already has approved planning artifacts:
1. decide whether to translate or regenerate
2. record the change in `pipeline-state.md`
3. treat the switch as a human checkpoint

## Validation Rule

- `speckit` is the only default provider currently exercised in this repo, and even that path is an AI Dev Shop compatibility flow rather than a literal upstream install
- `openspec` and `bmad` are now source-grounded against cloned upstream repos, but they remain untested end-to-end in this repo
- do not claim a provider is fully validated here until a maintainer completes a real feature run and records the outcome
