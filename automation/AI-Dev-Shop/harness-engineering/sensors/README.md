# Drift Sensors — Phase 1

Recurring codebase-health signals with clear ownership, artifact output, and routing into maintenance flows.

## What a Drift Sensor Is

A scheduled or event-driven check that measures codebase health decay over time. Unlike one-shot validators that check a single commit, sensors track trends and trigger action when drift crosses thresholds.

## Sensor Taxonomy

| Class | Meaning | Example |
|-------|---------|---------|
| `computational` | Deterministic tool output, exit code or structured report | `npm audit`, coverage diff |
| `inferential` | LLM-assisted analysis of patterns that tools can't catch alone | critical-path coverage judgment |

## Phase 1 Sensors

| Sensor | Class | Timing | Owner | File |
|--------|-------|--------|-------|------|
| [Dead Code](dead-code.md) | computational | PR + scheduled | Observer → Refactor | `dead-code.md` |
| [Dependency Drift](dependency-drift.md) | computational | daily + lockfile change | Observer → Security/DevOps | `dependency-drift.md` |
| [Coverage Quality](coverage-quality.md) | computational + inferential | PR + scheduled | Observer → TDD/Programmer | `coverage-quality.md` |
| [Mutation Quality](mutation-quality.md) | computational | PR (conditional) + scheduled | TestRunner PR gate; Observer scheduled trends → TDD/Programmer | `mutation-quality.md` |

## Standard Artifact Location

Sensor outputs are stored at:
`<ADS_MEMORY_ROOT>/.local-artifacts/sensors/<sensor-name>-<timestamp>.md`

Promoted findings (those that trigger action) are copied to:
`<ADS_MEMORY_ROOT>/reports/maintenance/sensors/<sensor-name>-<timestamp>.md`

## Standard Routing Protocol

1. Sensor runs (on schedule or event trigger)
2. Writes artifact to `.local-artifacts/sensors/`
3. Observer reads artifact during its next pass (or immediately if sensor triggers escalation)
4. Observer classifies findings and routes to the appropriate agent
5. Receiving agent acts (refactor, patch, add tests) or the finding is added to `tech-debt-tracker.md`

**Exception:** Mutation Quality operates as a dual-mode sensor. In PR context, TestRunner owns and gates on mutation results inline (not via Observer routing). In scheduled context, Observer owns full-scope mutation trend tracking and routes to TDD/Programmer. This is a documented exception to the Observer-only routing pattern above.

## What Is NOT in Phase 1

- Runtime SLO monitoring
- Log anomaly detection
- Broader observability signals
- Performance profiling

These may come in later phases with explicit promotion.
