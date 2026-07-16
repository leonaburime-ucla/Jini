# Model-Upgrade Eval Program

How to evaluate and qualify new foundation models or host changes before they become the default across the pipeline. Model upgrades must prove competence through evidence, not assumption.

## Why This Exists

Harness components encode assumptions about what the current model cannot do reliably on its own. When models improve, those assumptions go stale — but removing guardrails without evidence creates silent regressions. This program provides the evidence path.

## Scope

This program applies to:
- New foundation model family (e.g., switching from Claude 4.5 to Claude 4.7)
- Major version jump within a family (e.g., Opus 4.5 → Opus 4.6)
- Provider or host change (e.g., API → CLI, different runtime, new tool access)
- Tooling change that affects orchestration, context, or cost

## Trigger Conditions

Run a model-upgrade eval when any of these occur:

- New major model family is adopted or actively evaluated for adoption
- Meaningful model version jump within an already-adopted family
- Host or runtime change that affects tool access, orchestration, context window, or cost
- Repeated logged evidence that a harness step feels redundant or is routinely skipped/overridden (3+ observations)
- Cost/performance shift that makes the current harness configuration unreasonable

## Pinned Model Baselines

Every retained eval run must record:

- Exact provider model ID (not aliases like "opus" or "sonnet")
- Model label/marketing name
- Host/runtime (CLI version, API version, SDK version)
- Execution mode (single-agent, multi-agent, plan-only, full-auto)
- Date of run

Aliases are not enough for retained evidence. The run manifest must contain the exact model identifier that the provider resolves to.

## Benchmark Packs for Revalidation

Select representative seeds from existing eval suites:

| Suite | Seeds to include | What they test |
|-------|-----------------|----------------|
| Architect evals | Positive + negative controls, 2-3 staff+ seeds | Planning coherence, false-positive restraint |
| Code Review evals | Positive + negative controls, 2-3 production+ seeds | Defect detection, severity accuracy |
| Programmer evals | Implementation seeds with complexity | Code quality, spec adherence |
| Contract enforcement evals | All 8 seeds | Harness rule-following |
| Drift sensor evals | All 6 seeds | Observer classification accuracy |

The benchmark pack should be small enough to run in under 30 minutes but representative enough to catch regressions across planning, implementation, review, and harness-following.

## Ablation Modes

### Single-Component Ablation

Remove or weaken one harness component at a time and measure impact:

| Component | What to ablate | What regression looks like |
|-----------|---------------|---------------------------|
| Planner/spec expansion | Skip spec → go direct to implementation | Missing edge cases, vague scope |
| Sprint decomposition | Skip tasks.md → implement from ADR directly | Missed slices, scope drift |
| Evaluator loops | Skip evaluator contract → generator self-grades | Quality passes that shouldn't |
| Context reset/compaction | Don't reset between stages | Attention drift, stale context bleed |
| File-backed handoffs | Use conversation context instead of files | Lost detail, resumability failure |
| Per-slice QA | Skip Code Review on individual slices | Bugs that compound across slices |
| Helper-agent decomposition | Use single-agent instead of delegated specialists | Compare quality at same token cost |

### Whole-Layer Ablation

Remove an entire workflow layer to detect discontinuous capability jumps:

- Skip the entire planning layer (Spec + Architect + TDD) → implement from product intent directly
- Skip the entire review layer (Code Review + Security) → ship after tests pass
- Skip the entire evaluation layer → trust generator self-assessment

Whole-layer ablation is aggressive. Only use it when single-component results suggest the whole layer may be stale. If it shows broad stale signals, escalate to architecture review before removing default harness structure.

## Retained Report Fields

Every model-upgrade eval produces a retained report with:

| Field | Description |
|-------|-------------|
| Benchmark tasks | Which seeds were run |
| Seed count | Total seeds in the pack |
| Baseline model/harness | Exact model + harness variant being compared against |
| Upgrade model/harness | Exact model + harness variant being tested |
| **Quality delta** | First and most important: did output quality change? |
| Latency delta | Faster or slower? By how much? |
| Cost delta | Cheaper or more expensive? Token counts. |
| Error-recovery delta | Better or worse at resuming from failures? |
| Component classification | For each ablated component: `essential` / `conditional` / `stale` |
| Follow-through required | What docs, configs, or deprecation PRs are needed if adopting |

Quality delta is always evaluated first. A faster/cheaper model that produces worse output is not an upgrade.

## Classification Outcomes

| Classification | Meaning | Action |
|----------------|---------|--------|
| `essential` | Removing this component causes measurable quality regression | Keep it; do not simplify |
| `conditional` | Component helps in some scenarios but not all | Document when it's needed vs when it can be skipped |
| `stale` | Component adds no measurable quality value on the new model | Retire with a retained audit report and follow-through changes |

## Retirement Process for Stale Components

A component classified as `stale` may only be retired when:

1. A retained load-bearing audit report exists with evidence
2. The report was reviewed (not auto-accepted)
3. Follow-through changes are made to source-of-truth docs (remove from pipeline, update agent skills, update conventions)
4. The retirement is reversible (old config preserved in git history, not deleted from existence)

## What This Program Does NOT Do

- Does not auto-adopt new models (human decision required)
- Does not run continuously (triggered by specific conditions above)
- Does not replace the existing load-bearing harness audit (supplements it with formal model-specific methodology)
- Does not require running every seed in every suite (uses curated benchmark packs)
