# Sensor: Dead Code Detection

Finds unused exports, unreachable code, and orphaned files that accumulate as the codebase evolves.

## Sensor Definition

- **Class**: `computational`
- **Timing**: PR (incremental, modified-file scope) + scheduled (weekly, full repository)
- **Owner**: Observer → routes to Refactor agent
- **Artifact location**: `<ADS_MEMORY_ROOT>/.local-artifacts/sensors/dead-code-<timestamp>.md`

## Tools by Stack

| Stack | Tool | Command |
|-------|------|---------|
| TypeScript/JavaScript | knip | `npx knip` |
| TypeScript | ts-prune | `npx ts-prune` |
| Python | vulture | `vulture src/` |
| Go | deadcode | `deadcode ./...` |
| Generic | custom grep-based | project-specific |

The host project declares which tool applies in their computational-controls contract under `static_analysis` or as a standalone sensor command.

## Action-on-Fail

| Context | Severity | Action |
|---------|----------|--------|
| PR — new dead code introduced by current change | Advisory | Warn Programmer in handoff; do not block |
| Scheduled — total dead code exceeds baseline by >20% | Escalation | Observer reports to user, recommends Refactor pass |
| Scheduled — critical-path module has dead branches | Escalation | Observer flags for review |

Dead code is never a hard blocker on its own — it's a quality signal, not a safety signal.

## Routing

1. **PR context**: Programmer receives advisory note before handoff. Code Review mentions it if the dead code is in modified files.
2. **Scheduled context**: Observer reads the weekly scan artifact. If findings exceed threshold:
   - Creates a maintenance entry in `<ADS_MEMORY_ROOT>/reports/maintenance/`
   - Routes to Refactor agent with specific file paths and dead-code evidence
   - Adds to `harness-engineering/maintenance/tech-debt-tracker.md`

## Baseline Management

First scan establishes a baseline count. Future scans are compared against baseline:
- Baseline increases only when new code is intentionally added
- Baseline decreases when cleanup is verified
- Threshold breach = baseline + 20% growth without corresponding new-feature justification

## What This Does NOT Cover

- Runtime dead code (code that executes but has no observable effect) — requires runtime instrumentation
- Feature flags that are "off" — those need product decision, not automated cleanup
