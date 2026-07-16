# Benchmarks

A fixed set of reference inputs and expected outputs for each agent role. The Observer uses these to detect regressions when agent `skills.md` files change.

---

## Structure

```
project-knowledge-template/reports/benchmarks/
  spec-agent/
    sample-001-simple-crud/
      input.md          — the user's feature description
      expected-output.md — what a good spec looks like
      baseline-score.md  — Observer's last recorded score against the rubric
  architect-agent/
    sample-001-/
      ...
  tdd-agent/
  programmer-agent/
  testrunner-agent/
  code-review-agent/
  security-agent/
```

## Seeded Fixtures

The repo now includes first-pass fixtures for both planning and downstream execution/review roles:

- `spec-agent/sample-001-csv-invoice-export/`
- `architect-agent/sample-001-csv-invoice-export/`
- `tdd-agent/sample-001-csv-invoice-export/`
- `programmer-agent/sample-001-csv-invoice-export/`
- `testrunner-agent/sample-001-csv-invoice-export/`
- `code-review-agent/sample-001-csv-invoice-export/`
- `security-agent/sample-001-csv-invoice-export/`

These are anchored to `framework/examples/golden-sample/`. For downstream roles, the fixtures are scenario-based evaluation packets rather than executable code snapshots; they still give the Observer a stable instruction-regression target.

---

## How to Use

### Regression Detection (run after any skills.md change)

1. Pass `input.md` to the relevant agent with no other context
2. Score the output using `<AI_DEV_SHOP_ROOT>/skills/evaluation/eval-rubrics.md`
3. Compare to `baseline-score.md` — if overall score drops more than **1.0/10.0**, treat as a regression
4. Either revert the skills.md change or improve it until score recovers

### Release Gate

Do not ship changes to agent instructions that cause a regression of more than **1.0/10.0** on any dimension, or more than **0.5/10.0** on overall average, for the agent being changed.

---

## Adding Benchmarks

When a new failure pattern is resolved that took 3+ cycles, it is a good candidate for a benchmark:

1. Create a new `sample-NNN-<short-name>/` folder under the relevant agent
2. Write `input.md` — the input that caused the problem (sanitized)
3. Write `expected-output.md` — what the correct output looks like
4. Run the agent against it and record the score in `baseline-score.md`
5. The Observer should reference this benchmark in its next pattern report

For toolkit-maintenance failures, also check `<AI_DEV_SHOP_ROOT>/harness-engineering/quality/failure-promotion-policy.md` to decide whether the issue should become a benchmark, validator, or checklist instead.

For load-bearing harness audits, prefer reusing or adapting benchmark tasks from here before inventing a fresh one-off comparison set every time. The retained audit report should then be saved with `<AI_DEV_SHOP_ROOT>/framework/templates/load-bearing-harness-audit-template.md` under `project-knowledge-template/reports/maintenance/` per `<AI_DEV_SHOP_ROOT>/harness-engineering/quality/load-bearing-harness-audit.md`.

---

## Baseline Score Format

```markdown
# Baseline Score: <agent> / <sample-name>

- Scored by: Observer Agent
- Date: <ISO-8601 UTC>
- Skills.md version: <hash or description>

| Dimension | Score |
|-----------|-------|
| <dimension 1> | 8.0 |
| <dimension 2> | 7.5 |

Overall: 7.75 / 10.0
Notes: <what to watch — any dimension scoring below 7.0>
```
