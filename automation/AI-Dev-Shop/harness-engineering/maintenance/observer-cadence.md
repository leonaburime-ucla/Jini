# Observer Cadence

This is the source of truth for recurring harness-maintenance passes.

## Trigger Conditions

Run an Observer maintenance pass when any of these happen:

- every 3rd completed feature
- any convergence escalation
- any repeated failure class that reaches the promotion threshold in `harness-engineering/quality/failure-promotion-policy.md`
- any model or host upgrade that could change which harness components are still load-bearing
- any new primary-source harness article adopted into `harness-engineering/references/`
- any substantive toolkit-maintenance change touching `AGENTS.md`, `agents/`, `skills/`, `framework/spec-providers/`, `framework/workflows/`, `framework/templates/`, `framework/slash-commands/`, or `harness-engineering/`
- weekly while framework-maintenance work is active

## Required Actions Per Pass

1. Run `bash harness-engineering/validators/run-all.sh`.
2. Capture the `doc_garden_audit.py` output inside the Observer report.
3. Review benchmark impact if instructions, routing, or persona files changed.
4. Check whether any recurring failure now needs promotion into a validator, benchmark, checklist, or skills update.
5. If the trigger was a model/runtime/article shift, run the decision process in `harness-engineering/quality/load-bearing-harness-audit.md`.

## Output Expectations

The Observer should produce one pattern report that includes:

- recurring failure clusters
- benchmark regressions or newly seeded fixtures
- doc-garden audit summary
- recommended harness promotions

## Scope Notes

- This cadence is for framework maintenance and system learning, not feature delivery blocking on every run.
- A substantive toolkit-maintenance change means a change that alters behavior, routing, validators, templates, or source-of-truth policy. Small wording edits, examples, or formatting-only cleanup do not need a full Observer pass by default.
- When the trigger is a substantive toolkit-maintenance change, consider the Observer pass part of the definition of done for that change.
