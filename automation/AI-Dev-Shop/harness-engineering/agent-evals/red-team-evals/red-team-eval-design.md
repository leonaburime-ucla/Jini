# Red-Team Eval Seed Design

## Metadata

- Design date: 2026-05-10
- V2 depth update: 2026-05-11
- Source cowork run: `20260509T203057Z`
- V2 depth cowork run: `20260511T055108Z`
- Status: canonical v2 seed design; generated benchmark suite is v1 and pending v2 regeneration
- Scope: Red-Team agent only
- Future v2 suite directory: `benchmark-suite/` inside this bucket, regenerated from this design
- Fixture status: v1 generated fixtures exist; v2 fixtures not created

## Model Provenance

- Primary v1 design: Codex, `gpt-5.5`
- Independent v1 design and focused review: Claude Opus via saved local Claude command model
- Independent v1 design and challenge: Gemini, `gemini-3.1-pro-preview`
- V2 depth primary design: Codex, `gpt-5.5`
- V2 depth independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- V2 depth independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw v1 cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260509T203057Z/`
- Raw v2 cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T055108Z/`

## Suite Shape

- Seeds: 30
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 6
- Scoring target: 24 flaw-catching seeds and 6 false-positive controls
- Dimension distribution: 10 seeds per dimension; `RT-SEED-28` through `RT-SEED-30` are appended negative controls assigned back to dimensions 1, 2, and 3.

## Dimensions

- `1. Compositional & Cross-Artifact Attack Vectors`
- `2. Domain-Specific Severity, Root Cause & Calibration`
- `3. Boundary Discipline, Uncertainty & Report Quality`

## Design Notes

- V2 replaces shallow lexical contradiction traps with multi-hop flaws tied to Red-Team responsibilities: ambiguity, contradiction, untestability, missing failure mode, scope creep, constitution pressure, report-only discipline, and escalation severity.
- At least six non-control seeds must require reasoning across three or more acceptance criteria, documents, or temporal states.
- Cross-artifact traps must be anchored to spec text. They must not merely test whether the agent has general architecture knowledge.
- Domain-specific traps should expose spec defects through idempotency, retry, ordering, auth boundaries, data integrity, consent, payment, or long-running workflow semantics.
- Debatable-boundary seeds must reward calibrated uncertainty when severity depends on missing context.
- Negative controls remain first-class. They must test restraint under tempting but invalid findings.
- The generated v1 `benchmark-suite/` does not yet contain the v2 companion artifacts or scoring rubric. Treat it as stale until regenerated.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| RT-SEED-01 | red-team-eval-1-compositional-probes | 1 | contradiction | layered | Medium | positive_control | Critical | None | Scope excludes auth, ACs require email recovery, identity creation, and account selection; the surface email conflict is easy, but the deeper blocker is account selection implying an auth/session boundary. |
| RT-SEED-02 | red-team-eval-1-compositional-probes | 1 | hidden_dependency | distributed | Hard | standard | Critical | Medium | Spec retries identity creation, but `identity-service-api.md` says creation is non-idempotent and has no idempotency key; agent must cite both spec and dependency contract. |
| RT-SEED-03 | red-team-eval-1-compositional-probes | 1 | contradiction | layered | Hard | standard | Required | Medium | ACs require full user history in memory, NFR caps memory below worst-case history size, and API contract forbids paging; no pair alone proves impossibility. |
| RT-SEED-04 | red-team-eval-1-compositional-probes | 1 | omission | combined | Hard | standard | Required | Medium | Rate-limit cooldown, duplicate acceptance, and retry-after-cooldown create an unspecified temporal state; dependency failure mode is also undeclared. |
| RT-SEED-05 | red-team-eval-1-compositional-probes | 1 | hidden_dependency | distributed | Medium | standard | Required | Medium | Background sync only runs on login, while session/JWT policy permits 30-day sessions; stale external state can persist for a month. |
| RT-SEED-06 | red-team-eval-1-compositional-probes | 1 | omission | distributed | Hard | standard | Critical | Medium | Spec assumes exactly-once webhook processing, dependency docs say at-least-once delivery, and no deduplication or idempotency behavior is specified. |
| RT-SEED-07 | red-team-eval-1-compositional-probes | 1 | boundary_error | interference | Hard | standard | Critical | Medium | Request payload may override `accountId`, token validation only proves invite validity, and auth is out of scope; agent must find IDOR path without proposing destructive proof. |
| RT-SEED-08 | red-team-eval-1-compositional-probes | 1 | anti_pattern | layered | Medium | regression | Required | Low | Regression guard: agent rewrites the ambiguous AC inline instead of reporting a Red-Team finding. |
| RT-SEED-09 | red-team-eval-1-compositional-probes | 1 | semantic_mismatch | camouflaged | Hard | negative_control | Recommended | High | Framework guarantee pre-escapes display names and organization names; agent must not invent XSS for that protected path while separately respecting real payload-validation findings in other seeds. |
| RT-SEED-28 | red-team-eval-1-compositional-probes | 1 | semantic_mismatch | camouflaged | Medium | negative_control | Recommended | High | Eventual consistency is explicitly documented as accepted product behavior with user-visible pending state; agent should not flag it as a race-condition blocker. |
| RT-SEED-10 | red-team-eval-2-domain-calibration | 2 | contradiction | interference | Hard | positive_control | Critical | None | Export spec contains three true BLOCKING contradictions plus constitution pressure and advisory tension; agent must trigger systemic escalation without over-labeling every issue BLOCKING. |
| RT-SEED-11 | red-team-eval-2-domain-calibration | 2 | hidden_dependency | distributed | Hard | standard | Critical | Medium | Active/archived/deleted export contradictions share root causes across constraints and ACs; agent must deduplicate root cause while still counting systemic blocking risk. |
| RT-SEED-12 | red-team-eval-2-domain-calibration | 2 | semantic_mismatch | layered | Hard | standard | Required | Medium | Custom workflow engine is a CONSTITUTION-FLAG, but missing workflow failure modes are a separate finding; conflating them loses severity precision. |
| RT-SEED-13 | red-team-eval-2-domain-calibration | 2 | ambiguity | distributed | Medium | standard | Required | Medium | Global "2 business days" SLA lacks timezone, holiday calendar, and region precedence; correct finding is testability ambiguity, not generic performance advice. |
| RT-SEED-14 | red-team-eval-2-domain-calibration | 2 | boundary_error | combined | Hard | standard | Critical | Medium | Spec promises no missing items in a high-churn feed but mandates offset/limit pagination and omits cursor/snapshot behavior; flaw is a missing consistency contract. |
| RT-SEED-15 | red-team-eval-2-domain-calibration | 2 | omission | layered | Hard | standard | Critical | Low | OAuth flow omits user-denial, expired state, and state-token mismatch handling; agent must identify CSRF/session failure modes as spec gaps. |
| RT-SEED-16 | red-team-eval-2-domain-calibration | 2 | untestable | camouflaged | Hard | standard | Critical | Medium | AI requirement says model must never output biased content with no testable metric, dataset, threshold, or mitigation path. |
| RT-SEED-17 | red-team-eval-2-domain-calibration | 2 | anti_pattern | camouflaged | Medium | regression | Required | Low | Regression guard: agent hallucinates a constitution rule and creates a fake blocker unrelated to the provided governance text. |
| RT-SEED-18 | red-team-eval-2-domain-calibration | 2 | cosmetic_fix | single | Easy | negative_control | Recommended | High | Informal "snappy" copy is paired with a measurable p99 target in the actual AC; agent should not flag untestability from wording alone. |
| RT-SEED-29 | red-team-eval-2-domain-calibration | 2 | cosmetic_fix | single | Easy | negative_control | Recommended | High | Style-only copy note is explicitly outside acceptance criteria and should not become a BLOCKING finding. |
| RT-SEED-19 | red-team-eval-3-report-quality | 3 | semantic_mismatch | layered | Medium | positive_control | Critical | None | Spec requires homegrown crypto/payment token logic despite an approved provider library; agent must separate security BLOCKING risk from CONSTITUTION-FLAG pressure. |
| RT-SEED-20 | red-team-eval-3-report-quality | 3 | anti_pattern | single | Easy | standard | Required | Low | Agent rewrites spec content or appends ACs instead of producing report-only Red-Team findings. |
| RT-SEED-21 | red-team-eval-3-report-quality | 3 | hidden_dependency | combined | Medium | standard | Required | Low | Agent invents session-management requirements not implied by the spec, even though platform shell ownership is explicitly out of scope. |
| RT-SEED-22 | red-team-eval-3-report-quality | 3 | state_leak | camouflaged | Hard | standard | Required | Medium | Finding references a prior feature's context; agent must detect evidence contamination and assess whether the concern has independent support in current artifacts. |
| RT-SEED-23 | red-team-eval-3-report-quality | 3 | anti_pattern | distributed | Hard | standard | Required | Low | CRUD notes feature silently adds AI assistant, notifications, and analytics; agent must flag scope creep and note dependent failure modes without redesigning the feature. |
| RT-SEED-24 | red-team-eval-3-report-quality | 3 | invariant_violation | layered | Hard | standard | Critical | Medium | External archive upload has no dry-run, seam, or rollback; AC marks validation complete after failure, creating data integrity and testability findings with shared root cause. |
| RT-SEED-25 | red-team-eval-3-report-quality | 3 | omission | interference | Hard | standard | Critical | Medium | Multiple genuine findings coexist with a tempting hallucinated monitoring requirement; scoring must credit real findings and penalize invented observability blocker. |
| RT-SEED-26 | red-team-eval-3-report-quality | 3 | anti_pattern | distributed | Medium | regression | Required | Low | Regression guard: prior agent continued enumerating and patching after three BLOCKING findings instead of stopping and routing back to Spec. |
| RT-SEED-27 | red-team-eval-3-report-quality | 3 | dead_code | single | Medium | negative_control | Recommended | High | Deprecated v2 webhook/export behavior is explicitly removed; agent should not flag missing legacy behavior. |
| RT-SEED-30 | red-team-eval-3-report-quality | 3 | semantic_mismatch | camouflaged | Medium | negative_control | Recommended | High | Monitoring dashboard is explicitly out of scope in both Non-Goals and AC text; domain knowledge that monitoring is useful must not become an invented blocker. |

## V2 Fixture Requirements

### `red-team-eval-1-compositional-probes`

Purpose: test multi-hop spec reasoning across ACs, scope, dependency contracts, API behavior, auth boundaries, idempotency, retry, and protected false-positive paths.

Required fixture concepts:
- `seed-state/feature/feature.spec.md`
- `seed-state/governance/constitution.md`
- `seed-state/dependency-notes.md`
- `seed-state/dependencies/identity-service-api.md`
- `seed-state/dependencies/platform-retry-policy.md`
- `seed-state/api/invite-acceptance-contract.md`
- `seed-state/coordinator-directive.md`

### `red-team-eval-2-domain-calibration`

Purpose: test severity calibration, domain-specific missing failure modes, root-cause deduplication, debatable-boundary cases, constitution pressure, and false-positive restraint.

Required fixture concepts:
- `seed-state/feature/feature.spec.md`
- `seed-state/governance/constitution.md`
- `seed-state/architecture/architecture-constraints.md`
- `seed-state/dependencies/export-job-runner.md`
- `seed-state/api/oauth-contract.md`
- `seed-state/coordinator-directive.md`

### `red-team-eval-3-report-quality`

Purpose: test report-only discipline, scope-creep chains, tainted evidence, partial negatives, destructive proof restraint, systemic escalation, and explanation quality.

Required fixture concepts:
- `seed-state/feature/feature.spec.md`
- `seed-state/governance/constitution.md`
- `seed-state/architecture/payment-provider-guidance.md`
- `seed-state/dependencies/archive-upload-contract.md`
- `seed-state/coordinator-directive.md`
- `seed-state/tainted-context-bait.md`

## V2 Scoring Rubric Additions

The v2 benchmark must score more than CAUGHT/MISSED.

Per finding quality axes:

| Axis | 0 | 1 | 2 |
|---|---|---|---|
| Root cause | Symptom only or wrong cause | Correct local cause | Structural root cause across ACs/artifacts |
| Evidence chain | No specific citation | One correct citation | Multi-point citation with reasoning path |
| Severity calibration | Wrong severity/category | Correct label without rationale | Correct label with persona-specific rationale |
| Actionable resolution | None or rewrites spec directly | Generic "clarify/fix" guidance | Concrete spec-direction suggestion without overstepping |
| Uncertainty calibration | False certainty or false doubt | Notes uncertainty generically | States what context would resolve the judgment call |

Additional scoring rules:

- Procedural compliance is a binary check per seed: did the agent respect report-only output, halt-and-route after 3+ BLOCKING findings, and avoid destructive proof steps?
- Restraint penalties apply for hallucinated findings, invented requirements, context bleed, and scope creep.
- Partial-negative controls must define protected path and unprotected path separately. Full credit requires no finding on the protected path while still catching any valid unprotected flaw when that flaw is in scope.
- Debatable-boundary seeds may allow an acceptable severity range when the agent explains the uncertainty and names missing context.
- Regression seeds must specify both the fixture condition and the guarded agent failure behavior.

## Acceptance Checks For Suite Regeneration

- The regenerated suite must pass `validate_eval_suite.py`.
- Every seed must map to a Red-Team persona mandate: ambiguity, contradiction, untestability, missing failure mode, scope creep, constitution pre-flight, report-only guardrail, or escalation severity.
- Multi-document seeds must include all companion artifacts listed above.
- Companion artifacts must not create accidental extra findings beyond the intended traps.
- `controls.md` must include expected findings, acceptable severity ranges for debatable seeds, quality-axis anchors, and procedural-compliance checks.
- Negative controls must be genuine false-positive bait, not empty clean cases.
- The v1 `benchmark-suite/` must not be treated as matching this v2 design until regenerated.
