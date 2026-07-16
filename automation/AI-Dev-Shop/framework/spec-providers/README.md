# Spec Providers

This folder separates the upstream planning/spec framework from the rest of the AI Dev Shop pipeline.

Use it when you want:
- `speckit` as the default planning surface
- the option to swap to another planning surface such as `openspec` or `bmad`
- provider-specific docs, commands, naming, and artifact assumptions contained in one place instead of scattered through core workflow files

## Layout

```text
framework/spec-providers/
  active-provider.md
  core/
    provider-contract.md
    provider-selection.md
  speckit/
    provider.md
    compatibility.md
    templates/spec-system/...
    validators/validate_spec_package.py
  openspec/
    provider.md
    compatibility.md
    templates/...
    validators/validate_openspec_package.py
  bmad/
    provider.md
    compatibility.md
    templates/...
    validators/validate_bmad_package.py
```

## Core Rule

The AI Dev Shop pipeline consumes provider roles, not provider branding.

At minimum, every provider must define:
- what artifact acts as the spec entrypoint
- what supporting planning artifacts are part of the spec surface
- where unresolved clarification decisions live
- what artifact proves planning readiness
- what upstream install/runtime model the repo is assuming
- how that provider maps into AI Dev Shop's downstream Software Architect, TDD, and Programmer stages

Read `framework/spec-providers/core/provider-contract.md` before editing any provider file.

## Default

The active provider is recorded in `framework/spec-providers/active-provider.md`.

Current default:
- `speckit`

## Current Status

- `speckit` is source-grounded against the upstream Spec Kit repo and remains the default provider.
- `speckit` is exercised in this repo through a compatibility flow, not through a literal upstream `.specify/` project checkout.
- `openspec` is now source-grounded against the upstream repo, but it has not been tested end-to-end in this repo yet.
- `bmad` is now source-grounded against the upstream repo, but it has not been tested end-to-end in this repo yet.

## Single Source of Truth Rule

Each provider's `compatibility.md` is the authoritative operational contract for that provider. It owns the package shape, workflow steps, clarification rules, stage read sets, validation command, and readiness gate.

Slash commands and agent skills must REFERENCE that file, not duplicate its rules. If provider-specific workflow behavior changes, update `compatibility.md` first. Core workflow files route to the active provider's compatibility contract — they do not inline provider-specific file lists, gate conditions, or step sequences.
