# Spec Eval 2 - Speckit Readiness

## Agent Under Test

Spec

## Eval Goal

Probe whether the Spec agent can repair or block a Speckit strict package with missing required files, weak contracts, stale hash metadata, unresolved clarification, and invalid readiness claims.

## Visible Inputs For Agent

- `framework/spec-providers/active-provider.md`
- `framework/spec-providers/speckit/compatibility.md`
- `project/governance/constitution.md`
- `project/reports/pipeline/240-speckit-invoice-export/`

## Required Output

Write the eval result to `eval-results/eval-results-run.md`.

Include model name/version, readiness blockers, artifact repairs needed, clarification questions, validator status, and handoff readiness. Do not write runtime implementation code.
