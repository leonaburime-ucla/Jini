# Active Spec Provider

- active_provider: `speckit`
- status: `default`
- changed_at: `2026-03-25`

## Intent

This file tells the Coordinator and planning-stage agents which upstream planning framework to treat as active for new feature work.

Read order:
1. `framework/spec-providers/active-provider.md`
2. `framework/spec-providers/core/provider-contract.md`
3. `framework/spec-providers/<active_provider>/provider.md`

## Current Defaults

- Default provider: `speckit`
- Fallback expectation: if no provider is explicitly switched, use `speckit`

## Switch Safety

Safe:
- before starting `/spec` for a new feature
- between completed feature runs

Risky:
- after spec approval for an in-flight feature
- after architecture or task breakdown already exists

If switching mid-feature, do not silently swap formats. Create a translation or regeneration plan and record the chosen provider in `pipeline-state.md`.

## Current Availability

- `speckit`: default provider, source-grounded against upstream Spec Kit, exercised here through an AI Dev Shop compatibility flow rather than a literal `.specify/` installation
- `openspec`: source-grounded against upstream OpenSpec, selectable only with explicit human intent, not yet tested end-to-end in this repo
- `bmad`: source-grounded against upstream BMAD-METHOD, selectable only with explicit human intent, not yet tested end-to-end in this repo
