# Red-Team Eval 2 - Severity Calibration

## Agent Under Test

Red-Team

## Eval Goal

Probe whether Red-Team classifies findings correctly, triggers systemic escalation when there are three or more blocking findings, and avoids fake blockers.

## Visible Inputs For Agent

- `feature/feature.spec.md`
- `governance/constitution.md`
- `coordinator-directive.md`

## Required Output

Write findings to `eval-results/eval-results-run.md`.

Include model name/version, findings using the Red-Team output format, escalation recommendation, and any assumptions. Do not modify the input spec or supporting files.
