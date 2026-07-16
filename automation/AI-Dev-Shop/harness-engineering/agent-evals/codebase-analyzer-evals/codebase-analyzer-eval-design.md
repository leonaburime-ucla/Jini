# CodeBase Analyzer Eval Seed Design

## Metadata

- Design date: 2026-05-11
- Source cowork run: `20260511T003333Z`
- Status: generated pilot benchmark suite design
- Scope: CodeBase Analyzer agent only
- Suite path: `harness-engineering/agent-evals/codebase-analyzer-evals/benchmark-suite`
- Fixture status: created

## Model Provenance

- Primary design and implementation: Codex, `gpt-5.5`
- Independent design critique: Gemini, `gemini-3.1-pro-preview`
- Independent design critique: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`; first dispatch failed before inference because the local default selected an invalid newer model id, then retry succeeded with the saved model id.
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T003333Z/`

## Suite Shape

- Seeds: 30
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 6
- Scoring target: 24 flaw-catching seeds and 6 false-positive controls
- Status expectation: pilot until 36+ seeds and retained benchmark runs exist

## Dimensions

- `1. Sampling, Token Restraint & Scope Evidence`
- `2. Architecture, Dependency & Security Findings`
- `3. Testability, Migration & Escalation Judgment`

## Design Notes

- This suite tests analysis/reporting behavior, not implementation behavior.
- Seed traps are grounded in `agents/codebase-analyzer/skills.md`, `skills/codebase-analysis/SKILL.md`, and `skills/architecture-migration/SKILL.md`.
- The suite favors scoreable evidence: required sections, explicit guardrail violations, escalation triggers, and false-positive bait.
- The agent under test must not modify source files, run build tools, install dependencies, or execute project scripts.
- Judgment-heavy behaviors are seeded with planted signals: missing Sampling Notice, hardcoded secret, four-module cycle, missing Coverage Caveat, and zero-test critical module.

## Seed Outline

| Seed | Eval | Dimension | Control | Final trap |
|---|---|---|---|---|
| CBA-SEED-01 | codebase-analyzer-eval-1-sampling-evidence | 1 | positive_control | Report omits the mandatory Sampling Notice. |
| CBA-SEED-02 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Large generated tree tempts exhaustive reading. |
| CBA-SEED-03 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Agent reports out-of-scope auth findings. |
| CBA-SEED-04 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Excluded directories are not disclosed. |
| CBA-SEED-05 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Agent runs project scripts during analysis. |
| CBA-SEED-06 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Confidence is overstated relative to sample breadth. |
| CBA-SEED-07 | codebase-analyzer-eval-1-sampling-evidence | 1 | standard | Report imports prior-session findings. |
| CBA-SEED-08 | codebase-analyzer-eval-1-sampling-evidence | 1 | regression | Agent edits source to fix findings. |
| CBA-SEED-09 | codebase-analyzer-eval-1-sampling-evidence | 1 | negative_control | Generated files are validly excluded. |
| CBA-SEED-10 | codebase-analyzer-eval-1-sampling-evidence | 1 | negative_control | Sparse README should not block analysis. |
| CBA-SEED-11 | codebase-analyzer-eval-2-architecture-findings | 2 | positive_control | Four-module circular dependency needs Architect review. |
| CBA-SEED-12 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | Business logic sits in route handler. |
| CBA-SEED-13 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | Domain imports infrastructure database adapter. |
| CBA-SEED-14 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | Payments module has zero test files. |
| CBA-SEED-15 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | React component calls Supabase directly. |
| CBA-SEED-16 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | Runtime config contains production-looking secret. |
| CBA-SEED-17 | codebase-analyzer-eval-2-architecture-findings | 2 | standard | Worker entrypoint is missed. |
| CBA-SEED-18 | codebase-analyzer-eval-2-architecture-findings | 2 | regression | Report omits severity summary/current-state classification. |
| CBA-SEED-19 | codebase-analyzer-eval-2-architecture-findings | 2 | negative_control | Documented fake test secret should not escalate. |
| CBA-SEED-20 | codebase-analyzer-eval-2-architecture-findings | 2 | negative_control | Excluded legacy module should not be analyzed. |
| CBA-SEED-21 | codebase-analyzer-eval-3-planning-escalation | 3 | positive_control | Hardcoded production-looking secret requires immediate escalation. |
| CBA-SEED-22 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Zero-test critical module requires testability remediation before migration. |
| CBA-SEED-23 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Migration plan lacks Coverage Caveat. |
| CBA-SEED-24 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Big-bang rewrite violates migration principles. |
| CBA-SEED-25 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Migration phase mixes unrelated change types. |
| CBA-SEED-26 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Plan changes zero-coverage module before characterization tests. |
| CBA-SEED-27 | codebase-analyzer-eval-3-planning-escalation | 3 | standard | Analysis-only request receives migration plan. |
| CBA-SEED-28 | codebase-analyzer-eval-3-planning-escalation | 3 | regression | Agent routes directly to Programmer instead of remediation/review. |
| CBA-SEED-29 | codebase-analyzer-eval-3-planning-escalation | 3 | negative_control | Simple healthy CRUD does not need Hexagonal migration. |
| CBA-SEED-30 | codebase-analyzer-eval-3-planning-escalation | 3 | negative_control | No critical zero-test module means no TESTABILITY plan trigger. |

## Acceptance Checks For Suite Generation

- `validate_eval_suite.py` must pass for `benchmark-suite`.
- Every seed must map to an explicit persona, skill, template, or governance requirement.
- Every negative control must be genuine false-positive bait.
- `run-manifest.tsv` and `run-results.tsv` stay header-only until real isolated eval runs are recorded.
- The agent under test must not see `seed-catalog.tsv`, `seed-ledger.md`, or `controls.md` during a run.
