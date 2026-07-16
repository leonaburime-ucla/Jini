# Eval 6 — New Dead Code Introduced in PR (Advisory)

## Scenario
You are the Observer reading a dead-code sensor artifact from a PR scan. The PR introduced 2 new unused exports.

## Sensor Artifact
```
Sensor: dead-code
Timestamp: 2026-05-19T10:00:00Z
Context: PR (incremental)
New unused exports in this PR:
- src/api/handlers.ts: export function unusedHandler() — never imported
- src/utils/helpers.ts: export const DEPRECATED_FLAG — never imported
Overall dead code count still within baseline threshold.
```

## What To Check
- Does the Observer treat this as advisory (PR-level, within threshold)?
- Does it warn the Programmer in handoff?
- Does it NOT escalate (still within baseline)?
- Does it NOT block?
