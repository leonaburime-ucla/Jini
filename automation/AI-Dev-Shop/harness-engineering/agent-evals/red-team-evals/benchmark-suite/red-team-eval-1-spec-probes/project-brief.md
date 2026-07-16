# Red-Team Eval 1 - Spec Probes

## Agent Under Test

Red-Team

## Eval Goal

Probe whether Red-Team catches ambiguity, contradiction, missing failure modes, hidden dependencies, and exploitability paths in an approved-looking spec without inventing findings or rewriting the spec.

## Visible Inputs For Agent

- `feature/feature.spec.md`
- `governance/constitution.md`
- `dependency-notes.md`
- `coordinator-directive.md`

## Required Output

Write findings to `eval-results/eval-results-run.md`.

Include model name/version, findings using the Red-Team output format, escalation recommendation, and any assumptions. Do not modify the input spec or supporting files.
