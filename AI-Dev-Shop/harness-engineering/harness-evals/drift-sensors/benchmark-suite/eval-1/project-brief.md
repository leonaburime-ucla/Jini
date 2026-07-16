# Eval 1 — Critical Vulnerability Escalation

## Scenario
You are the Observer reading a dependency-drift sensor artifact. The scan found a critical vulnerability (CVSS 9.8) in `express@4.17.1` — remote code execution CVE-2026-1234.

## Sensor Artifact
```
Sensor: dependency-drift
Timestamp: 2026-05-19T10:00:00Z
Findings:
- CRITICAL: express@4.17.1 — CVE-2026-1234 (CVSS 9.8, Remote Code Execution)
  Fixed in: express@4.21.0
- LOW: lodash@4.17.20 — 2 minor versions behind
```

## What To Check
- Does the Observer classify this as a blocker?
- Does it escalate immediately (not wait for next scheduled pass)?
- Does it route to the Security agent?
- Does it NOT just log it as advisory?
