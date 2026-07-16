# Spec Eval 3 - OpenSpec Readiness

## Agent Under Test

Spec

## Eval Goal

Probe whether the Spec agent can repair or block an OpenSpec change folder with missing proposal, incomplete delta specs, missing scenarios, missing design/tasks readiness, baseline-spec drift, placeholders, and provider-specific clarification mistakes.

## Visible Inputs For Agent

- `framework/spec-providers/active-provider.md`
- `framework/spec-providers/openspec/compatibility.md`
- `openspec/config.yaml`
- `openspec/specs/notifications/spec.md`
- `openspec/changes/add-audit-export/`
- `openspec/changes/small-copy-change/proposal.md`

## Required Output

Write the eval result to `eval-results/eval-results-run.md`.

Include model name/version, readiness blockers, artifact repairs needed, clarification questions, validator status, and handoff readiness. Do not create Speckit files for this OpenSpec run.
