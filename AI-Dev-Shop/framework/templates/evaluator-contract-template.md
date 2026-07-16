# Evaluator Contract: <slice-slug>

- Contract Slug: <short-slice-name>
- Workstream: <feature-id or maintenance-name>
- Scope Type: feature-pipeline | toolkit-maintenance | direct-run
- Generator Owner: <agent or human>
- Evaluator Owner: <agent or human>
- Source Prompt Or Spec: <path, issue, or prompt summary>
- Evaluator Mode: required | optional
- Artifacts Root: <reports path for this workstream>
- Opened At: <ISO-8601 UTC>
- Last Updated At: <ISO-8601 UTC>

## Slice

<what this loop is trying to build right now>

## Non-Goals

- <explicit non-goal>
- <explicit non-goal>

## Completion Criteria

- <criterion 1>
- <criterion 2>
- <criterion 3>

## Runtime Surfaces To Exercise

- <UI path, API path, state path, or service path>
- <UI path, API path, state path, or service path>

## Evidence Surfaces

The evaluator must base its judgment on these surfaces. If required evidence is missing, the evaluator must fail the evaluation — not guess.

| Surface | Required | How To Inspect |
|---|---|---|
| Live runtime (UI paths, API requests, state) | Yes / No | <method: browser, curl, DB query> |
| Code diffs | Yes / No | <git diff scope> |
| Test execution results | Yes / No | <command or report path> |
| Coverage reports | Yes / No | <tool and threshold> |
| Generator handoff documentation | Yes / No | <expected path> |
| PR description / commit ledger | Yes / No | <where to find it> |

If a surface is not applicable, mark it `N/A` with a one-line rationale.

## Blocking Thresholds

| Dimension | Threshold | Why Blocking |
|---|---|---|
| <dimension> | <minimum acceptable score or pass condition> | <why failure here blocks the slice> |

## Fail Conditions

The slice explicitly FAILS if any of these occur, regardless of rubric scores:

- **Ignored Feedback**: Generator skipped or dismissed previous evaluator feedback without stated rationale
- **Missing Evidence**: Generator claimed pass without providing required test results, diffs, or handoff docs
- **Evaluation Lapse**: Evaluator failed to inspect a mandated evidence surface or runtime surface
- **Threshold Breach**: Any dimension falls below its defined hard blocking threshold
- **Artifact Gap**: Required artifacts (progress-ledger, evaluator report, offloads) are missing or malformed
- **Evidence Contradiction**: Handoff or PR claims contradict what the evaluator observed in evidence surfaces

## Required Artifacts

| Artifact | Location | Required | Notes |
|---|---|---|---|
| progress-ledger | <path or N/A> | Yes / No | |
| evaluator report | <path> | Yes / No | |
| offloads | <path or N/A> | Yes / No | |

## Scoring Rubric

| Dimension | Passing Signal | Failure Signal | Weight Or Threshold |
|---|---|---|---|
| <dimension> | <what pass looks like> | <what fail looks like> | <weight or hard threshold> |

## Generator Response Rule

Describe when the generator should refine the current direction, when it should pivot, and what evidence the next round must include.

## Calibration Gate (Eval Suites Only)

When this contract governs an eval suite (seed-catalog, seed-ledger, coverage-matrix), apply this gate before the suite is marked complete.

### Trigger Condition

The calibration gate fires when **external peer CLI mode is active** — i.e., the work session has access to at least one external LLM CLI (`gemini`, `codex`, or equivalent) beyond the primary model. This occurs naturally during `/cowork`, `/debate`, or `/audit-work` sessions but is not coupled to those commands. If no external peer is available, the gate is deferred (not skipped) and must be satisfied before the suite reaches `benchmark` status.

### Calibration Protocol

1. Dispatch one external peer CLI with the seed-ledger and complexity tier definitions.
2. The peer independently rates each seed's `domain_complexity` using only the seed description and expected signal (not the assigned label).
3. Collect disagreements: any seed where the peer's independent rating differs from the assigned rating.
4. **Threshold:** If disagreements exceed **20%** of depth-eligible seeds, the suite cannot advance to `benchmark` status until disagreements are resolved (accepted, contested with rationale, or seeds revised).
5. **Resolution options per disagreement:**
   - Accept the peer rating and update the seed
   - Contest with written rationale (must explain why the assigned complexity requires cross-boundary reasoning that the peer's lower rating misses)
   - Revise the seed to genuinely match the target complexity tier
   - Add compensating seeds if downgrades push the suite below the 80% staff+ floor

### Recording

Save calibration results in the run folder:
```
<suite>/calibration/<timestamp>-<peer-model>.md
```

Include: peer model identity, per-seed ratings, disagreement count, resolution decisions, and final complexity distribution after resolution.

### Relationship to Coverage Gates

The calibration gate is independent of seed-count floors, dimension density, and negative-control ratios. It validates that complexity *labels* are defensible, not that the *structure* is complete. Both must pass for benchmark certification.
