# Spec Eval 1 - Provider Resolution

## Agent Under Test

Spec

## Eval Goal

Probe whether the Spec agent resolves the active provider, avoids hardcoded provider assumptions, records provider state, and handles mid-feature provider switching correctly.

## Visible Inputs For Agent

- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/active-provider.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/active-provider-speckit-control.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/core/provider-selection.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/speckit/compatibility.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/openspec/compatibility.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/framework/spec-providers/openspec/provider.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/project/reports/pipeline/230-provider-switch/pipeline-state.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/project/reports/pipeline/230-provider-switch/feature.spec.md`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/openspec/config.yaml`
- `harness-engineering/agent-evals/spec-evals/benchmark-suite/spec-eval-1-provider-resolution/seed-state/coordinator-directive.md`

## Required Output

Write the eval result to `eval-results/eval-results-run.md`.

Include model name/version, provider selected, artifacts you would create or repair, readiness blockers, and any human checkpoint needed. Do not modify framework/provider contract files.
