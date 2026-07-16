# Skill-MD-Format Failure-Mode Matrix

Standard schema per agent:
- Failure mode
- Detection signal
- Recovery route
- Escalation trigger

## Coordinator
- Failure mode: Routes using stale spec/ADR inputs.
- Detection signal: Handoff references old spec hash or missing current-stage artifact.
- Recovery route: Re-run input validation, then re-dispatch with current spec hash + latest artifacts.
- Escalation trigger: Same stale-input failure repeats 2 times in one feature cycle.

## Spec
- Failure mode: Leaves ambiguous requirements that are not testable.
- Detection signal: `[NEEDS CLARIFICATION]` remains or acceptance criteria cannot map to tests.
- Recovery route: Run clarify pass and resolve markers before Architect handoff.
- Escalation trigger: Clarification loop exceeds 2 rounds for same unresolved requirement.

## Architect
- Failure mode: Produces ADR that violates constitution or leaves boundary ambiguity.
- Detection signal: Constitution check fails or module ownership/contracts are missing.
- Recovery route: Return to Architect with explicit violation list and required boundary contract fixes.
- Escalation trigger: Constitution violation persists after one revision.

## TDD
- Failure mode: Tests assert implementation details instead of behavior/spec outcomes.
- Detection signal: High brittleness, low requirement traceability, or failed requirement-to-test mapping.
- Recovery route: Re-dispatch TDD with strict behavior-level test requirement and traceability matrix.
- Escalation trigger: Same AC remains untestable after 2 redesign attempts.

## Programmer
- Failure mode: Drifts outside task scope or bypasses ADR constraints.
- Detection signal: Unplanned file/domain edits or repeated failures in same cluster with off-scope changes.
- Recovery route: Re-dispatch with narrowed scope, explicit task IDs, and failing-cluster-only focus.
- Escalation trigger: 3 consecutive failures on same cluster.

## TestRunner
- Failure mode: Reports pass/fail without actionable clustering.
- Detection signal: Test report lacks grouped failure clusters and AC mapping.
- Recovery route: Re-run with required output schema including cluster IDs and AC linkage.
- Escalation trigger: Two incomplete reports in the same implementation cycle.

## Code Review
- Failure mode: Focuses on style noise while missing behavioral/spec regressions.
- Detection signal: Low-severity comments dominate; post-merge behavioral defects found.
- Recovery route: Re-dispatch with spec-alignment and regression checks as required dimensions.
- Escalation trigger: Required findings missed in two consecutive review cycles.

## Security
- Failure mode: Incomplete threat analysis on changed auth/payment/data paths.
- Detection signal: Security output lacks exploit scenario classification by severity.
- Recovery route: Re-dispatch with explicit changed-path inventory and required exploit narratives.
- Escalation trigger: Any unresolved Critical/High finding or repeated incomplete report.

## QA/E2E
- Failure mode: Tests validate brittle selectors/implementation detail instead of user journeys.
- Detection signal: Frequent non-functional test failures after minor UI refactors; weak AC-to-journey mapping.
- Recovery route: Re-dispatch QA/E2E with journey-based scenarios, stable selectors, and AC traceability requirement.
- Escalation trigger: Same journey remains flaky across 2 consecutive runs.

## Refactor
- Failure mode: Proposes or applies behavior-changing edits under non-behavioral refactor scope.
- Detection signal: Test assertions require updates for accepted refactor proposal or regression appears after refactor.
- Recovery route: Route behavioral change back through Spec/TDD flow; keep Refactor scope structural only.
- Escalation trigger: Any refactor proposal repeatedly causes behavioral drift in 2 cycles.

## DevOps
- Failure mode: Delivery artifacts omit runtime constraints/secrets/deployment rollback details.
- Detection signal: CI/CD config exists but lacks required env var contracts, health checks, or rollback path.
- Recovery route: Re-dispatch DevOps with required deployment checklist and environment contract schema.
- Escalation trigger: Release-blocking deployment gap persists after one revision.

## Docs
- Failure mode: Documentation diverges from approved spec/ADR/test behavior.
- Detection signal: API/user guide content conflicts with current artifact hashes or shipped behavior.
- Recovery route: Re-dispatch Docs with explicit spec hash, ADR path, and latest test-certification summary.
- Escalation trigger: Same divergence repeats in 2 documentation cycles.

## Observer
- Failure mode: Produces non-actionable trend notes without evidence links or ownership.
- Detection signal: Recommendations lack cited entries, score impact, or suggested next owner.
- Recovery route: Re-dispatch Observer with evidence-required template and explicit decision targets.
- Escalation trigger: Two consecutive Observer reports fail evidence/ownership checks.

## Red-Team
- Failure mode: Findings are generic and not tied to concrete spec clauses or exploit paths.
- Detection signal: BLOCKING/CONSTITUTION flags missing reproducible rationale or clause references.
- Recovery route: Re-dispatch Red-Team with requirement for clause-linked findings and exploit narratives.
- Escalation trigger: Blocking finding quality remains insufficient after one revision.

## CodeBase Analyzer
- Failure mode: Analysis misses migration-critical coupling or understates legacy risk.
- Detection signal: Downstream architecture/implementation uncovers major constraints absent from analysis report.
- Recovery route: Re-dispatch Analyzer with explicit focus on ownership boundaries, dependency graph, and migration hazards.
- Escalation trigger: Same missed critical constraint appears in 2 features.

## Database
- Failure mode: Schema/query guidance violates domain ownership or introduces cross-domain coupling.
- Detection signal: Proposed DDL touches non-owned domain boundaries without contract justification.
- Recovery route: Re-dispatch Database with ownership map + ADR constraints and boundary check as hard gate.
- Escalation trigger: Ownership violation persists after one revision.

## Supabase Sub-Agent
- Failure mode: Platform-specific migration/RLS/index changes are incomplete or unsafe.
- Detection signal: Migration passes syntax but fails policy/security/performance advisor checks.
- Recovery route: Re-dispatch with required advisor pass, RLS validation, and migration safety checklist.
- Escalation trigger: Critical/High advisor issue remains unresolved after one fix cycle.

## System Blueprint
- Failure mode: Macro boundaries are vague, causing domain overlap and weak decomposition.
- Detection signal: Spec package cannot cleanly assign ownership or has recurring `[OWNERSHIP UNCLEAR]` markers.
- Recovery route: Re-dispatch Blueprint with explicit component ownership map and integration contracts.
- Escalation trigger: Boundary ambiguity persists after one revision.

## VibeCoder
- Failure mode: Prototype choices become de facto architecture without formal promotion.
- Detection signal: Downstream stages treat exploratory output as binding without spec/ADR confirmation.
- Recovery route: Route through Blueprint/Spec to formalize or reject prototype decisions.
- Escalation trigger: Prototype-to-production drift repeats in 2 consecutive features.
