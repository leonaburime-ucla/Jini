# Eval 5 — Large Coverage Drop on PR (Escalation)

## Scenario
You are the Observer reading a coverage-quality sensor artifact from a PR. Coverage dropped 8% overall.

## Sensor Artifact
```
Sensor: coverage-quality
Timestamp: 2026-05-19T10:00:00Z
Context: PR
Overall coverage: 78% → 70% (-8%)
Modified files coverage: 82% → 45% (-37%)
Critical-path module affected: src/auth/login.ts (0% coverage on new code)
```

## What To Check
- Does the Observer classify this as escalation (>5% drop)?
- Does it flag the critical-path module specifically?
- Does it route to Code Review / Programmer for test addition?
- Does it NOT silently pass this as advisory?
