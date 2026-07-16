# Sensor: Dependency / Security Drift

Detects outdated dependencies, known vulnerabilities, and license compliance issues before they accumulate into a security incident or painful upgrade.

## Sensor Definition

- **Class**: `computational`
- **Timing**: daily scheduled + on lockfile change (PR trigger)
- **Owner**: Observer → routes to Security agent or DevOps agent
- **Artifact location**: `<ADS_MEMORY_ROOT>/.local-artifacts/sensors/dependency-drift-<timestamp>.md`

## Tools by Stack

| Stack | Vulnerability scan | Outdated check |
|-------|-------------------|----------------|
| Node.js | `npm audit` / `yarn audit` | `npm outdated` |
| Python | `pip-audit` / `safety check` | `pip list --outdated` |
| Go | `govulncheck ./...` | `go list -m -u all` |
| Rust | `cargo audit` | `cargo outdated` |
| Generic | `trivy fs .` | — |

The host project declares which tool applies. If no tool is declared, the sensor skips with an advisory note.

## Action-on-Fail

| Finding | Severity | Action |
|---------|----------|--------|
| Critical/High vulnerability (CVSS ≥ 7.0) | **Blocker** | Observer escalates immediately; Security agent formulates patch plan |
| Medium vulnerability (CVSS 4.0-6.9) | Escalation | Observer reports; user decides timing |
| Low vulnerability | Advisory | Logged in maintenance report |
| Major version behind (3+ major) | Escalation | Observer reports; user decides upgrade timing |
| Minor/patch outdated | Advisory | Batched into weekly maintenance summary |
| License violation (copyleft in proprietary project) | **Blocker** | Observer escalates immediately |

## Routing

1. **Critical vulnerability found**:
   - Observer flags as blocker
   - Routes to Security agent with CVE details, affected package, and version range
   - Security agent produces a patch recommendation
   - Programmer applies the fix in a dedicated maintenance run

2. **Routine outdated dependencies**:
   - Observer batches into `<ADS_MEMORY_ROOT>/reports/maintenance/dependency-drift-<date>.md`
   - Adds to `harness-engineering/maintenance/tech-debt-tracker.md`
   - Presented to user at next Observer maintenance pass

3. **PR-triggered (lockfile change)**:
   - Scan runs on the new lockfile
   - If new vulnerabilities introduced, Code Review is informed
   - Advisory unless the new dep has a known critical vuln (then escalation)

## Baseline Management

- First scan establishes the current vulnerability count as baseline
- New vulnerabilities above baseline in untouched deps are flagged at next scheduled scan
- Vulnerabilities introduced by a current PR are attributed to that PR immediately

## What This Does NOT Cover

- Runtime dependency behavior (supply chain attacks at execution time)
- Transitive dep license deep-analysis beyond what the tool reports
- Custom internal package version drift
