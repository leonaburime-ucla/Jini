# Design: Spec Provider Extraction

- Date: 2026-03-25
- Status: IMPLEMENTED

## Problem

Speckit assumptions had spread across workflow docs, command templates, validation text, and maintainer guidance. That made the toolkit harder to reuse with other planning frameworks and made Speckit look like a hidden hard dependency instead of a default provider.

## Decision

Introduce a provider boundary under `framework/spec-providers/`.

Core pipeline files now resolve:
1. the active provider
2. the shared provider contract
3. the provider-specific profile

This keeps the AI Dev Shop pipeline reusable while letting the repo default to Speckit.

## Provider Model

- `speckit` is the default provider and is now source-grounded against the upstream Spec Kit repo
- `speckit` is still exercised here through an AI Dev Shop compatibility flow rather than a literal upstream `.specify/` installation
- `openspec` is source-grounded against the upstream OpenSpec repo but not yet tested end-to-end in this repo
- `bmad` is source-grounded against the upstream BMAD-METHOD repo but not yet tested end-to-end in this repo

OpenSpec and BMAD are intentionally marked untested in this repo until they complete real feature runs here.

## Important Boundary

Providers own the upstream planning surface.

AI Dev Shop core still owns:
- constitution and governance
- routing
- architecture ADR output
- downstream delivery, validation, and review stages

## Migration Strategy

This change localizes the Speckit compatibility implementation under `framework/spec-providers/speckit/`.

Instead:
- `framework/spec-providers/` becomes the source of truth for provider identity and mapping
- `framework/spec-providers/speckit/compatibility.md` owns the strict package flow, validator path, and read sets
- provider-local templates and validators live under the Speckit provider folder
- core docs are updated to resolve the provider boundary first and reference provider-local assets

## Follow-Up Work

- validate one end-to-end OpenSpec run
- validate one end-to-end BMAD run
- add automated translator helpers if provider switching becomes common
