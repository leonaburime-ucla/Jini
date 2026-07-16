# Examples

This folder contains reference artifacts that show what “good” pipeline output looks like.

Use examples to:
- onboard new contributors to artifact structure
- calibrate agent output format and depth
- compare live pipeline outputs against a known-good sample

## Golden Sample

`golden-sample/` is the canonical end-to-end example for one feature flowing through the core pipeline.

It demonstrates this sequence:
1. Spec package and manifest
2. Red-team findings against the approved spec
3. Architecture decision record (ADR)
4. Task breakdown
5. Test certification output

Key files:
- `golden-sample/spec-manifest.md`
- `golden-sample/feature.spec.md`
- `golden-sample/red-team-findings.md`
- `golden-sample/adr.md`
- `golden-sample/tasks.md`
- `golden-sample/test-certification.md`
- `golden-sample/README.md`

## How To Use

- When generating new artifacts, mirror the structure and traceability shown in `golden-sample/`.
- When reviewing agent output quality, compare ordering, completeness, and handoff clarity against the same sample.
