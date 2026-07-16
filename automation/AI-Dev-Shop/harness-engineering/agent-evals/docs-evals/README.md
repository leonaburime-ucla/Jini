# Docs Evals

Seeded eval infrastructure for the Docs agent.

- `benchmark-suite/` contains the generated 30-seed pilot benchmark suite.
- `docs-eval-design.md` records the seed design and acceptance checks.

Validate with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/docs-evals/benchmark-suite
```
