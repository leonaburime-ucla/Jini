# Load-Bearing Harness Audit

This file defines how to simplify a harness when models, hosts, or toolchains improve.

## Why This Exists

Every harness component encodes an assumption about what the model cannot yet do reliably on its own.

Those assumptions go stale.

A planner step, context reset, sprint decomposition, or evaluator loop can be essential on one model release and unnecessary overhead on the next. The goal is not maximum harness complexity. The goal is the simplest harness that still clears the quality bar.

## Trigger Conditions

Run a load-bearing audit when any of these happen:

- a new model release materially changes long-context, planning, QA, or coding behavior
- the host/runtime changes enough to alter available tools or orchestration patterns
- an external primary-source article changes the local harness design frontier
- the current harness is clearly too slow or expensive for the lift it provides
- a once-useful scaffold now feels redundant during repeated runs

## Audit Method

Do not rewrite the harness wholesale and hope for the best.

Use this sequence:

1. pick 1-3 realistic benchmark tasks
2. record the current baseline quality, latency, and cost
3. remove or weaken one harness component at a time
4. rerun the same tasks
5. compare quality first, then latency and cost
6. classify the component as `essential`, `conditional`, or `stale`

Changing multiple major components at once makes it hard to learn which part was actually load-bearing.

Do not treat an intentionally empty reserved reports folder as evidence that a harness surface is stale.

Some report locations exist so downstream projects have a canonical place to keep artifacts later. Judge the default rule and benchmark behavior, not whether this toolkit repo already happens to contain retained examples.

## Relationship to Model-Upgrade Program

This audit defines the general method (ablate, benchmark, classify). The **Model-Upgrade Eval Program** at `harness-engineering/quality/model-upgrade-program.md` defines the formal triggers, pinned baselines, benchmark packs, and retained report structure specifically for model/host upgrades. Use that program when the trigger is a model or host change. Use this audit for general harness simplification work.

## Components Worth Stress-Testing

Common components to audit:

- planner/spec expansion
- sprint or feature decomposition
- context resets
- compaction-only continuous sessions
- evaluator frequency
- end-of-run-only QA versus per-slice QA
- file-backed handoffs
- helper-agent or multi-agent decomposition

## Classification Rule

Use these labels:

- `essential`
  - removing it causes unacceptable quality loss
- `conditional`
  - keep it only for tasks outside the current model's reliable solo boundary
- `stale`
  - remove it from the default harness because the current model or host now handles that job well enough natively

If a component becomes `conditional`, the harness should say what kinds of tasks still justify it.

## Continuity Rule

Context resets are not a permanent best practice.

Use resets when a clean slate materially improves coherence or avoids premature wrap-up near the context limit. Prefer compaction-only continuous sessions when the current model can stay coherent without reset overhead.

The default should follow evidence from current runs, not inherited lore from older models.

## Output Artifact

Use a retained report when the audit is meant to become reusable project evidence or when it changes the default harness:

`<AI_DEV_SHOP_ROOT>/project-knowledge-template/reports/maintenance/harness-load-bearing-<YYYY-MM-DD>.md`

For exploratory removal checks, local-only runs, or inline-only decisions, a scratch note is enough until the result is worth promoting.

Use `framework/templates/load-bearing-harness-audit-template.md` for the retained report shape when the audit is promoted into canonical project evidence.

Include:

- benchmark tasks used
- harness variants compared
- observed quality deltas
- latency and cost deltas
- final keep/remove/conditional decision for each tested component

## Follow-Through

If an audit changes the default harness:

- update the relevant source-of-truth docs in `harness-engineering/`
- update any startup or routing docs affected by the change
- add or revise benchmarks if the removed component used to guard a known failure mode
- remove stale guidance instead of leaving contradictory docs behind

## Validator Rule

`harness-engineering/validators/validate_load_bearing_audits.py` is the executable audit check for retained load-bearing reports.

It should fail when a retained `project-knowledge-template/reports/maintenance/harness-load-bearing-*.md` report is missing the required sections, benchmark inventory, or component decisions.
