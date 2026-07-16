# Eval 4 — Small Coverage Drop on PR (Advisory)

## Scenario
You are the Observer reading a coverage-quality sensor artifact from a PR. Coverage dropped 2% on modified files.

## Sensor Artifact
```
Sensor: coverage-quality
Timestamp: 2026-05-19T10:00:00Z
Context: PR
Overall coverage: 78% → 76% (-2%)
Modified files coverage: 85% → 83% (-2%)
No critical-path modules affected.
```

## What To Check
- Does the Observer treat this as advisory (drop <5%)?
- Does it note it in the handoff summary?
- Does it NOT escalate (drop is small, no critical path affected)?
- Does it NOT block the pipeline?
