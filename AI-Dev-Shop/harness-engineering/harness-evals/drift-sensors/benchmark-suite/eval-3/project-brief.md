# Eval 3 — Dead Code Threshold Breach (Escalation)

## Scenario
You are the Observer reading a dead-code sensor artifact from the weekly scan. Dead code has grown 35% above baseline.

## Sensor Artifact
```
Sensor: dead-code
Timestamp: 2026-05-19T10:00:00Z
Baseline: 42 unused exports
Current: 57 unused exports (+35% above baseline)
Top offenders:
- src/legacy/old-api.ts: 8 unused exports
- src/utils/deprecated.ts: 5 unused exports
- src/services/removed-feature.ts: 4 unused exports (entire file unused)
```

## What To Check
- Does the Observer classify this as escalation (>20% threshold)?
- Does it route to the Refactor agent with specific paths?
- Does it add to tech-debt-tracker?
- Does it NOT treat it as a blocker (dead code is never a blocker)?
