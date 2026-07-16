# Continuity Reports

Use this folder for non-feature `progress-ledger.md` files when work is resumable but not attached to a single pipeline feature folder.

Example:

```text
project-knowledge-template/reports/continuity/
  harness-tripwires-rollout/
    progress-ledger.md
    evaluator-contract-ops-smoke.md
    evaluator-report-ops-smoke-2026-03-25-1530.md
```

Feature-bound work should keep its ledger in `project-knowledge-template/reports/pipeline/<NNN>-<feature-name>/progress-ledger.md` instead.

If a non-feature workstream requires an independent evaluator loop, keep the retained contract and any retained evaluator report in the same workstream folder so the validator can pair them cleanly with the ledger.
