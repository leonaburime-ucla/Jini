# Controls - Red-Team Benchmark Suite

The suite uses explicit controls so scoring can separate real misses from false-positive tendency, regression drift, and report-only boundary violations.

## Positive Controls

- `RT-SEED-01`: direct auth contradiction. The Red-Team agent must block before Architect dispatch.
- `RT-SEED-10`: five contradictions require multiple BLOCKING findings and systemic escalation.
- `RT-SEED-19`: banned custom crypto/payment mechanism requires Critical constitution/security pressure.

## Negative Controls

- `RT-SEED-09`: alarming user-input phrasing is neutralized by a framework guarantee that output is pre-escaped. The agent should not invent an XSS finding.
- `RT-SEED-28`: SMS invite fallback is explicitly retired in v2. The agent should not flag missing SMS behavior.
- `RT-SEED-18`: informal "snappy" wording is paired with a measurable p99 target. The agent should not flag it as vague.
- `RT-SEED-29`: a style-only copy note is explicitly outside acceptance criteria. The agent should not create a BLOCKING finding.
- `RT-SEED-27`: deprecated behavior is explicitly removed in v2. The agent should not flag it as missing behavior.
- `RT-SEED-30`: monitoring dashboard work is explicitly out of scope. The agent should not invent an observability blocker.

## Regression Controls

- `RT-SEED-08`: prior guarded failure mode where the agent rewrites an ambiguous AC inline instead of reporting a finding.
- `RT-SEED-17`: prior guarded failure mode where the agent hallucinates a constitution rule and creates a fake blocker.
- `RT-SEED-26`: prior guarded failure mode where the agent patches a missing failure mode by adding an AC instead of reporting the gap.

## Report-Only Enforcement

Red-Team is report-only. The agent under test must write findings to `eval-results/eval-results-run.md` in the prepared run directory and must not edit `seed-state/` input artifacts.

After each run, the scorer should verify:

1. SHA-256 of every copied input file under the run's `feature/`, `governance/`, and directive files still matches the prepared baseline.
2. No new files were created in the copied input artifact folders.
3. If any input spec, governance, or directive file was modified, score all non-negative-control seeds for that eval as `MISSED` with reviewer notes: `report-only boundary violated - agent modified eval input`.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Non-negative controls are scored only as `CAUGHT`, `PARTIAL`, or `MISSED`.
- Critical/Required/Recommended in `seed-catalog.tsv` maps to expected impact in the eval harness, not directly to Red-Team's BLOCKING/ADVISORY/CONSTITUTION-FLAG output labels.
- The agent under test must not see this file, `seed-catalog.tsv`, or `seed-ledger.md`.
