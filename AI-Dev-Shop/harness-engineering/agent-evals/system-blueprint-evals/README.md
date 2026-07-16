# System Design Agent Evals

Agent under test: `system-design`

Suite design: `system-design-eval-design.md`

## Status

- Canary eval (sd-eval-1-team-collab-saas) created 2026-05-30
- No runs yet; `run-manifest.tsv` and `run-results.tsv` are header-only
- Evals 2-5 pending canary validation

## What This Suite Tests

Genuine architectural judgment under ambiguity — not template compliance. The agent receives messy stakeholder input and must:
- Infer contradictions from cross-document analysis
- Resist technology fashion when constraints prohibit it
- Escalate structural unknowns rather than encode unsafe defaults
- Decompose at the right granularity for the team topology
- Sequence foundations before dependent specs

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py \
  harness-engineering/agent-evals/system-blueprint-evals/benchmark-suite
```

## Running

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/system-blueprint-evals/benchmark-suite \
  run-001 \
  --eval sd-eval-1-team-collab-saas
```

Default execution mode: `repo_persona_subagent`
