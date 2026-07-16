# Status And Confidence Taxonomy

This file defines how planning, review, evidence, and confidence labels are used
across the AI Dev Shop pipeline.

Do not normalize one label family into another. Preserve the source label and
add a routing consequence when needed.

## Label Families

| Label Family | Values | Meaning | Routing Consequence |
|---|---|---|---|
| Pipeline run status | `IN_PROGRESS`, `WAITING_FOR_HUMAN`, `COMPLETE`, `FAILED`, `CANCELLED`, `ABORTED` | Lifecycle of the pipeline run | Drives resume and recovery only |
| Job status | `QUEUED`, `DISPATCHED`, `RUNNING`, `DONE`, `RETRYING`, `FAILED`, `ESCALATED`, `WAITING_FOR_HUMAN`, `CANCELLED`, `ABORTED` | Lifecycle of the current stage job | Drives retry, resume, or escalation |
| Provider gate status | `NOT_RUN`, `PASS`, `FAIL` | Mechanical readiness of provider planning artifacts | `FAIL` blocks downstream dispatch |
| Validator waiver | `validator_manual_waiver` | Human-approved manual validation only when validator runtime is unavailable | Allows dispatch only when runtime cannot run; never overrides a failing validator |
| Red-Team finding status | `BLOCKING`, `ADVISORY`, `CONSTITUTION_FLAG` | Adversarial spec finding class | `BLOCKING` blocks Software Architect; `CONSTITUTION_FLAG` needs human decision; `ADVISORY` travels to ADR context |
| Coordinator finding classification | `IMPLEMENTATION_FIX_REQUIRED`, `TDD_RECERTIFICATION_REQUIRED`, `TEST_EVIDENCE_INVALID`, `COVERAGE_TRIAGE_REQUIRED`, `SPEC_REVISION_REVIEW_REQUIRED`, `REFACTOR_RECOMMENDED`, `SECURITY_REVIEW_REQUIRED`, `ARCHITECTURE_REVIEW_REQUIRED`, `HUMAN_REVIEW_REQUIRED`, `NONE` | Downstream finding classification reported by specialist agents to Coordinator | Coordinator maps classification to the next dispatch, waiver, or human checkpoint |
| Blueprint unknown class | `BLOCKING`, `SAFE DEFAULT`, `DEFERRED` | Functional/NFR unknown routing class | `BLOCKING` blocks the stage that needs the answer; others require assumption/owner |
| CodeBase Analyzer confidence | `High`, `Medium`, `Low` | Sample coverage strength, not model certainty | Irreversible decisions still require source validation |
| ADR scorecard confidence | `measured`, `prior_art`, `analogical`, `assumed` | Evidence basis for architecture scorecard row | More than half core axes as `assumed` blocks ADR finalization |
| Reverse-spec confidence | `tested`, `runtime-observed`, `contractual`, `characterized`, `observed`, `implementation-tested`, `documented-only`, `test-claimed`, `inferred` | Evidence hierarchy for extracted behavior | Lower-confidence or contradictory critical behavior becomes review-digest work |
| Reverse-spec coverage status | `fully_specified`, `partially_specified`, `unspecified` | Extraction completeness by entrypoint | `partially_specified`/`unspecified` critical paths block Software Architect unless human-approved |

## Translation Rules

- Do not convert CodeBase Analyzer `High` confidence into ADR `measured`
  confidence. CBA confidence means the sample was broad enough, not that the
  architecture claim was measured.
- Do not convert reverse-spec high-confidence evidence such as `tested` or
  `contractual` into provider readiness. Provider readiness still requires the
  provider validator, sign-off, and Coordinator Planning Preflight.
- Do not convert Red-Team `ADVISORY` into an ADR waiver. The Software Architect must
  acknowledge advisory findings in the ADR or explain why they do not affect the
  decision.
- Do not convert `SAFE DEFAULT` or `DEFERRED` unknowns into resolved
  requirements. Preserve the assumption and downstream owner.
- Do not use numeric percentages for architecture pattern fit unless measured
  data actually exists. Use `Fit Band` in pattern evaluation and scorecard rows
  for evidence-backed detail.

## Handoff Rule

When an artifact crosses stages, include:

- the original label
- source artifact and line/section when practical
- evidence basis
- downstream routing consequence
- owner for unresolved work

Example:

`NFR Security = Unknown / SAFE DEFAULT` remains that label in Spec. The Spec may
turn it into an assumption plus Security Agent owner, but it must not claim the
security decision is complete.
