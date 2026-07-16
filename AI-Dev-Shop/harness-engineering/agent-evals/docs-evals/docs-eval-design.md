# Docs Eval Seed Design

## Metadata

- Design date: 2026-05-11
- Status: generated pilot benchmark suite design
- Scope: Docs agent only
- Suite path: `harness-engineering/agent-evals/docs-evals/benchmark-suite`
- Fixture status: created

## Model Provenance

- Primary design and implementation: Codex, `gpt-5.5`
- Grounding docs read: `agents/docs/skills.md`, `skills/developer-documentation/SKILL.md`, `skills/developer-documentation/references/api-and-migration-docs.md`, `skills/api-contracts/SKILL.md`, and `skills/spec-writing/SKILL.md`

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

- `1. API Contract, OpenAPI & Compatibility Discipline`
- `2. User Guides, Changelog & Release Notes`
- `3. Source Authority, Safety & Escalation Boundaries`

## Design Notes

- This suite tests documentation output behavior, not implementation, specs, or ADR writing.
- Seed traps are grounded in the Docs persona and developer-documentation/API-contract rules.
- The suite favors scoreable evidence: missing required OpenAPI fields, wrong changelog sections, forbidden sensitive data, and required escalation conditions.
- Negative controls test restraint: no invented OpenAPI without API contract, no user-facing release note for purely internal ADRs, and no invented security warning when the security report says no user-facing behavior changed.

## Acceptance Checks For Suite Generation

- `validate_eval_suite.py` must pass for `benchmark-suite`.
- Every seed must map to an explicit Docs persona, documentation skill, API-contract rule, or spec/source-authority rule.
- Every negative control must be genuine false-positive bait.
- `run-manifest.tsv` and `run-results.tsv` stay header-only until real isolated eval runs are recorded.
- The agent under test must not see `seed-catalog.tsv`, `seed-ledger.md`, or `controls.md` during a run.
