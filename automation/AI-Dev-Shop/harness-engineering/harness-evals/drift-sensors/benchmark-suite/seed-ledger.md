# Seed Ledger — Drift Sensor Suite

This suite tests Observer behavior when reading drift sensor artifacts, per:

- `harness-engineering/sensors/README.md`
- `harness-engineering/sensors/dead-code.md`
- `harness-engineering/sensors/dependency-drift.md`
- `harness-engineering/sensors/coverage-quality.md`

The agent under test does not see this ledger.

## Seeds

### eval-1-critical-vuln-escalation

`SEED-DS-01`
- Seeded condition: Dependency-drift sensor found a critical vulnerability (CVSS 9.8, RCE).
- Expected signal: Observer classifies as blocker. Escalates immediately. Routes to Security agent with CVE details.
- What must NOT happen: Observer logs as advisory. Observer waits for next scheduled pass. Observer routes to maintenance report only.

### eval-2-routine-outdated-advisory

`SEED-DS-02`
- Seeded condition: Dependency-drift sensor found only minor/patch outdated packages, no vulnerabilities.
- Expected signal: Observer classifies as advisory. Batches into maintenance report. No escalation. No Security agent routing.
- What must NOT happen: Observer escalates. Observer blocks pipeline. Observer routes to Security agent.

### eval-3-dead-code-threshold-breach

`SEED-DS-03`
- Seeded condition: Dead-code sensor weekly scan shows 35% growth above baseline (threshold is 20%).
- Expected signal: Observer classifies as escalation. Routes to Refactor agent with specific file paths. Adds to tech-debt-tracker.
- What must NOT happen: Observer treats as blocker (dead code is never a blocker). Observer ignores because it's "just dead code." Observer treats as advisory.

### eval-4-small-coverage-drop-advisory

`SEED-DS-04`
- Seeded condition: Coverage-quality sensor on PR shows 2% overall drop, no critical-path modules affected.
- Expected signal: Observer classifies as advisory. Notes in handoff summary. No escalation.
- What must NOT happen: Observer escalates (drop is <5%). Observer blocks pipeline. Observer routes to TDD agent.

### eval-5-large-coverage-drop-escalation

`SEED-DS-05`
- Seeded condition: Coverage-quality sensor on PR shows 8% overall drop, critical-path module (auth/login) has 0% coverage on new code.
- Expected signal: Observer classifies as escalation. Flags the critical-path module. Routes to Code Review/Programmer for test addition.
- What must NOT happen: Observer treats as advisory. Observer ignores critical-path gap. Observer only notes overall percentage without flagging the specific module.

### eval-6-new-dead-code-pr-advisory

`SEED-DS-06`
- Seeded condition: Dead-code sensor on PR found 2 new unused exports introduced by the current change. Overall count still within baseline.
- Expected signal: Observer classifies as advisory. Warns Programmer in handoff. Does not escalate.
- What must NOT happen: Observer escalates (within threshold). Observer blocks. Observer ignores entirely.
