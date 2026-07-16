# Independent Evaluator Loops

This file defines when the harness should separate planning, building, and grading instead of trusting a single agent to do all three jobs well.

## Why This Exists

Long-running build tasks fail in two repeatable ways:

- the builder loses coherence or under-scopes the work
- the same builder grades its own output too generously

The fix is not always "add more agents." It is to separate roles only when the task sits beyond what the current model handles reliably in one pass.

## Core Pattern

Use up to three roles:

- `Planner`
  - expands a short product prompt into a concrete spec or sprint plan
- `Generator`
  - implements the agreed slice of work
- `Evaluator`
  - inspects the live output, grades it against explicit criteria, and blocks weak passes

The evaluator is not a cheerleader. Its job is to be skeptical enough that a weak implementation does not pass just because it looks plausible.

## When To Use It

Prefer an independent evaluator loop when any of these are true:

- the task is long-running or multi-hour and quality drifts over time
- the work includes subjective quality such as UI polish, originality, or product feel
- the current model often ships impressive-looking but actually broken builds
- static diffs or unit tests are not enough to expose the real user experience
- the implementation is near the edge of what the current model can do reliably on its own

Keep work in a single agent when the task is small, narrow, or already well within the model's reliable solo boundary.

Docs-only policy edits, narrow validator maintenance, and other routine harness-documentation work usually stay in that simpler path unless the slice is long-running, highly subjective, or repeatedly passing weak work.

## Required Retained Artifacts

When an independent evaluator loop is required, the harness should create a durable contract before coding starts.

Use:

- `framework/templates/evaluator-contract-template.md` for the contract
- `framework/templates/evaluator-report-template.md` for a retained evaluator report when the run should stay as project evidence

Canonical locations:

- Feature-bound work:
  - `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/evaluator-contract-<slug>.md`
  - `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/evaluator-report-<slug>-<YYYY-MM-DD-HHmm>.md`
- Non-feature toolkit maintenance or direct framework work:
  - `<ADS_MEMORY_ROOT>/reports/continuity/<workstream>/evaluator-contract-<slug>.md`
  - `<ADS_MEMORY_ROOT>/reports/continuity/<workstream>/evaluator-report-<slug>-<YYYY-MM-DD-HHmm>.md`

If the workstream also uses a `progress-ledger.md`, record:

- `evaluator_mode: required`
- `evaluator_contract: <repo-relative path>`

That gives the validator a concrete, file-backed signal that evaluator mode is in scope instead of relying on vague prose.

## Contract Before Coding

**`evaluator-contract-<slug>.md` is THE canonical pre-build builder/judge agreement artifact.** There is no alternative format. If a requirement or criterion is not written into this file, it is not part of the agreement and cannot be graded against. Ledgers, evaluator reports, handoffs, PR descriptions, and chat summaries may reference it, but they do not replace it.

Before the generator writes code, require a file-backed contract between generator and evaluator using `framework/templates/evaluator-contract-template.md`.

Minimum contract contents:

- source prompt or spec reference
- slice name and scope
- explicit non-goals for the slice
- testable completion criteria
- evidence surfaces the evaluator must inspect (code diffs, test results, coverage, handoff docs, runtime)
- runtime surfaces the evaluator must exercise
- blocking thresholds
- explicit fail conditions (process failures that mean automatic fail regardless of rubric)
- artifacts the generator must hand to evaluation

The purpose of the contract is to close the gap between a high-level spec and a testable slice of work. Do not wait until after coding to decide what "done" means.

## Grading Rules

Rubrics should turn fuzzy judgments into concrete checks.

For each criterion:

- name the dimension
- say what passing looks like
- say what failure looks like
- assign either a weight or a hard threshold

Use hard thresholds for dimensions that must not regress. A run fails if any blocking dimension falls below its threshold, even when the overall result looks good.

Examples of useful dimensions:

- feature completeness
- critical-path functionality
- code quality or maintainability
- UI design quality
- originality where generic output is a known failure mode

Weight the dimensions where the base model is weakest. If the model already does well on craft and basic functionality, the rubric should spend more pressure on the dimensions it usually underserves.

## Calibration Rules

Evaluators need tuning too.

Calibrate the evaluator by:

- reviewing cases where it approved work humans would reject
- reviewing cases where it missed obvious edge cases
- giving it scored examples when the quality bar is subjective
- tightening prompts so it prefers concrete bug reports over vague praise

If the evaluator regularly finds legitimate issues and then waves them away as acceptable, it is not calibrated yet.

## Evaluate The Live Surface

Evaluate the running application or service, not just the diff.

Preferred evidence surfaces:

- browser interaction against the live UI
- API requests against the running app
- database or state inspection when persistence matters
- screenshots, logs, and traces captured from the active run

Static review alone is weaker for long-running app builds because many failures only appear once the product is exercised.

## Generator Response Rule

After evaluation feedback, the generator should make an explicit choice:

- refine the current direction when scores are trending well
- pivot when the current approach is fundamentally weak

Do not let the loop drift into unstructured thrashing. Each new round should say which issues are being fixed and why the current direction still deserves another pass.

## Relationship To Self-Validation

Self-validation is still required for routine runtime-changing work.

Use `harness-engineering/runtime/self-validation.md` for the implementer's own bounded runbook.
Use this file when the task needs a separate judge because self-validation alone is too lenient or too narrow.

## Relationship To Repo Evaluation Skills

When defining rubrics, align with:

- `skills/agent-evaluation/SKILL.md`
- `skills/evaluation/eval-rubrics.md`

Those files define judge design and scoring patterns. This file defines when the harness should introduce a separate evaluator role at all.

## Simplification Rule

Independent evaluator loops are themselves harness complexity.

When models, hosts, or task shape improve enough that the extra judge no longer adds clear lift, re-test the pattern with `harness-engineering/quality/load-bearing-harness-audit.md` instead of keeping it by habit.

## Validator Rule

`harness-engineering/validators/validate_evaluator_artifacts.py` is the mechanical check for retained evaluator artifacts.

It only scans the canonical retained locations:

- `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/`
- `<ADS_MEMORY_ROOT>/reports/continuity/<workstream>/`

That is intentional. Ledgers or evaluator artifacts outside those retained roots are ignored by design instead of treated as canonical harness state.

It should fail when:

- a `progress-ledger.md` marks `evaluator_mode: required` but no evaluator contract path is recorded
- the recorded contract path is missing or lives outside the canonical retained locations above
- a retained evaluator contract or evaluator report is malformed
