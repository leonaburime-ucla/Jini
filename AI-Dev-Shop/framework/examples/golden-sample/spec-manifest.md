# Spec Manifest: CSV Export for Invoice List

- Spec ID: SPEC-001
- Feature: FEAT-001
- spec_naming: standard
- Sample type: onboarding example

## Files Present

| File | Purpose |
|---|---|
| `feature.spec.md` | Canonical primary spec |
| `spec-manifest.md` | Records actual filenames and omissions for this sample |
| `red-team-findings.md` | Adversarial review output |
| `adr.md` | Architecture decision record |
| `tasks.md` | Coordinator task breakdown |
| `test-certification.md` | TDD certification artifact |

## Omitted Spec-Package Files

| File | Reason |
|---|---|
| `api.spec.md` | Sample feature adds no new API surface and consumes no external API contract. |
| `state.spec.md` | Sample feature does not introduce a new state model beyond the existing invoice list view state. |
| `orchestrator.spec.md` | Sample feature has no dedicated orchestrator layer. |
| `ui.spec.md` | This onboarding sample stays lightweight and captures UI expectations in `feature.spec.md` and `adr.md` instead of a dedicated UI contract file. |
| `errors.spec.md` | Sample feature defines no new error code registry. |
| `behavior.spec.md` | Sample feature documents deterministic rules in `feature.spec.md`; a current production spec should split them out when the feature warrants it. |
| `traceability.spec.md` | Sample uses the TDD certification artifact to illustrate requirement-to-test coverage instead of a dedicated traceability file. |
| `spec-dod.md` | Sample is illustrative rather than a full strict-package artifact set. New specs should include a fully completed `spec-dod.md`. |

## Notes

- This sample uses current naming (`feature.spec.md`) so references match the active pipeline.
- For new work, prefer the current templates in `framework/spec-providers/speckit/templates/spec-system/` over this sample when there is any conflict.
