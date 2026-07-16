# CodeBase Analyzer Evals

Seeded eval infrastructure for the CodeBase Analyzer agent.

- `benchmark-suite/` contains the generated 30-seed pilot benchmark suite.
- `codebase-analyzer-eval-design.md` records the seed design, cowork provenance, and acceptance checks.

Validate with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/codebase-analyzer-evals/benchmark-suite
```
