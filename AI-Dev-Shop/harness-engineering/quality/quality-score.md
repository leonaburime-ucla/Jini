# Harness Quality Score

Updated baseline for this repository after the follow-up harness slice landed on 2026-03-22.

Grades are evidence-based summaries, not aspirations. Re-score after meaningful harness changes.

| Area | Grade | Evidence | Why It Is Not Higher Yet |
|---|---|---|---|
| Knowledge Map And Progressive Disclosure | B+ | `AGENTS.md`, `framework/operations/pipeline-quickstart.md`, `framework/routing/agent-index.md`, `agents/*/skills.md`, `skills/`, `harness-engineering/references/` | The root map is now safer, but keeping it slim requires ongoing discipline as new framework rules land. |
| Mechanical Enforcement | B | `harness-engineering/validators/`, `.github/framework/workflows/harness-validators.yml`, `harness-engineering/policy/ci-enforcement.md`, `harness-engineering/policy/registry-integrity-policy.md` | More rules are enforced mechanically now, but most behavioral quality rules still depend on markdown gates rather than executable checks. |
| Evaluation And Benchmarking | B- | `project-knowledge-template/reports/benchmarks/README.md`, `project-knowledge-template/reports/benchmarks/spec-agent/`, `project-knowledge-template/reports/benchmarks/architect-agent/`, `project-knowledge-template/reports/benchmarks/tdd-agent/`, `project-knowledge-template/reports/benchmarks/programmer-agent/`, `project-knowledge-template/reports/benchmarks/testrunner-agent/`, `project-knowledge-template/reports/benchmarks/code-review-agent/`, `project-knowledge-template/reports/benchmarks/security-agent/`, `skills/evaluation/eval-rubrics.md` | Benchmarks now span implementation and verification roles, but they are still scenario-based seed fixtures rather than executable eval harnesses. |
| Closed-Loop Feedback | B+ | `project-knowledge-template/knowledge/learnings.md`, `agents/observer/skills.md`, `harness-engineering/quality/failure-promotion-policy.md`, `harness-engineering/runtime/tripwires.md` | Repeated failures now have promotion and tripwire rules, but the loop is still mostly human-driven rather than automated. |
| Entropy Management | B | `agents/observer/skills.md`, `harness-engineering/maintenance/observer-cadence.md`, `harness-engineering/validators/doc_garden_audit.py`, `.github/framework/workflows/harness-maintenance.yml`, `project-knowledge-template/reports/maintenance/harness-maintenance.md` | Cleanup is now scheduled and report-driven, but repair automation still opens reviewable PRs instead of silently fixing drift. |
| Self-Validation Loops | C+ | `harness-engineering/runtime/self-validation.md`, `framework/templates/self-validation/`, `project-knowledge-template/reports/self-validation/README.md`, `agents/programmer/skills.md`, `framework/workflows/job-lifecycle.md` | The templates and gates now exist, but real downstream repos still need project-specific commands and environment wiring. |
| Run-Level Observability | B- | `pipeline-state.md`, `framework/templates/progress-ledger-template.md`, `harness-engineering/runtime/session-continuity.md`, `harness-engineering/runtime/context-offloading.md`, `project-knowledge-template/reports/offloads/README.md`, `framework/workflows/trace-schema.md`, Observer outputs | Resume quality and evidence hygiene are better, but there is still no consolidated dashboard or automatic artifact summarization layer. |

## Overall

Current repo harness maturity: **B**

This repo now has a credible repo-level harness layer: validators, CI wiring, benchmark seeds across upstream and downstream roles, article-local references, runtime self-validation templates, context-offload rules, and a scheduled cleanup cadence. The next leverage point is still the same: convert more recurring failure classes into mechanical checks and executable evals.
