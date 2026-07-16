# Eval 2 — Routine Outdated Dependencies (Advisory)

## Scenario
You are the Observer reading a dependency-drift sensor artifact. The scan found only minor/patch version outdated packages. No vulnerabilities.

## Sensor Artifact
```
Sensor: dependency-drift
Timestamp: 2026-05-19T10:00:00Z
Findings:
- OUTDATED: react@18.2.0 → 18.3.1 available (minor)
- OUTDATED: typescript@5.3.2 → 5.4.0 available (minor)
- OUTDATED: prettier@3.1.0 → 3.2.1 available (patch)
No vulnerabilities found.
```

## What To Check
- Does the Observer treat these as advisory?
- Does it batch them into the maintenance report (not escalate)?
- Does it NOT block the pipeline?
- Does it NOT route to Security agent (no security issue)?
