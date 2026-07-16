# Spec Manifest

| Logical File | Status | Justification |
|---|---|---|
| feature.spec.md | PRESENT | Primary requirements |
| api.spec.md | PRESENT | API endpoint exists |
| state.spec.md | OMITTED | No durable state is introduced |
| orchestrator.spec.md | OMITTED | No orchestration layer |
| ui.spec.md | OMITTED | No UI surface |
| errors.spec.md | PRESENT | Error response exists |
| behavior.spec.md | OMITTED | No ordering, precedence, or deduplication rules |
| traceability.spec.md | PRESENT | Traceability file exists |
| spec-manifest.md | PRESENT | This file |
| spec-dod.md | PRESENT | Readiness checklist |

Note: this manifest is included for negative-control applicability checks. The suite also scores the missing-manifest seed against runs where this file is absent or ignored.

Readiness defect: this manifest intentionally omits the required stage read sets for Architect, TDD, and Programmer.
