# QA/E2E Eval Seed Design

## Metadata

- Design date: 2026-05-11
- Source cowork run: `20260511T052905Z`
- Status: canonical seed design for future suite generation
- Scope: QA/E2E agent only
- Future suite directory: `benchmark-suite/` inside this bucket
- Fixture status: not created

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T052905Z/`

## Suite Shape

- Seeds: 27
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 3
- Scoring target: 24 flaw-catching seeds and 3 false-positive controls

## Dimensions

- `1. Journey Selection, AC Traceability & Coverage Strategy`
- `2. Playwright Stability, Fixture Isolation & Browser Evidence`
- `3. Auth, Accessibility, Compliance & Escalation Discipline`

## Design Notes

- QA/E2E owns browser-level user journeys, not unit logic, integration contracts, or backend-only behavior.
- Browser automation evidence must be honest. If `browser_automation` is unavailable, the agent may design tests but must not claim live verification.
- E2E tests must be stable under CI parallelism: no hard waits, brittle selectors, shared mutable fixtures, direct DB fixture shortcuts, or role-state leakage.
- Compliance-sensitive website flows are first-class E2E targets when rendered UX, network behavior, consent state, account controls, or disclosures are observable in the browser.
- Negative controls must test restraint: valid `waitForResponse`, out-of-scope backend-only ACs, compliant age gates, and existing lower-level coverage must not be flagged or duplicated.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| QA-SEED-01 | qa-e2e-eval-1-journey-strategy | 1 | missing_test | single | Easy | positive_control | Critical | None | Clear checkout journey has no lower-level journey coverage; QA/E2E should produce a multi-step Playwright test with AC traceability. |
| QA-SEED-02 | qa-e2e-eval-1-journey-strategy | 1 | omission | distributed | Medium | standard | Required | Low | System Blueprint marks onboarding as a cross-domain critical journey, but agent covers only a simple profile-render AC. |
| QA-SEED-03 | qa-e2e-eval-1-journey-strategy | 1 | anti_pattern | camouflaged | Medium | standard | Required | Medium | Agent writes E2E permutations for validation logic already certified at unit/integration level while missing the actual submit-and-redirect journey. |
| QA-SEED-04 | qa-e2e-eval-1-journey-strategy | 1 | omission | single | Easy | standard | Required | Low | Third-party OAuth or hardware-backed flow is silently skipped instead of documented as untestable with an escalation target. |
| QA-SEED-05 | qa-e2e-eval-1-journey-strategy | 1 | semantic_mismatch | layered | Hard | standard | Required | Medium | Ambiguous AC "manage preferences" is guessed into a browser test without Spec clarification, wireframe, or defined expected state. |
| QA-SEED-06 | qa-e2e-eval-1-journey-strategy | 1 | hidden_dependency | distributed | Medium | standard | Required | Medium | AC coverage map claims journey coverage but omits spec hash, AC IDs, test IDs, and evidence tying each test to a user-visible outcome. |
| QA-SEED-07 | qa-e2e-eval-1-journey-strategy | 1 | boundary_error | combined | Hard | standard | Critical | Medium | Agent treats backend email, cache, or rate-limit behavior as E2E coverage by asserting only that a form submits, creating false coverage. |
| QA-SEED-08 | qa-e2e-eval-1-journey-strategy | 1 | cosmetic_fix | camouflaged | Medium | negative_control | Recommended | High | Welcome-email AC has no browser-observable state and is already covered by integration tests; QA/E2E should document no E2E test, not invent one. |
| QA-SEED-09 | qa-e2e-eval-1-journey-strategy | 1 | missing_test | camouflaged | Medium | regression | Required | Low | Prior guarded failure mode: debounce and API are unit-tested, but the combined type-to-results-update journey is still untested and needs E2E. |
| QA-SEED-10 | qa-e2e-eval-2-playwright-stability | 2 | missing_test | single | Easy | positive_control | Critical | None | File-upload flow needs browser coverage with a synthetic file fixture, upload response wait, preview assertion, and cleanup. |
| QA-SEED-11 | qa-e2e-eval-2-playwright-stability | 2 | anti_pattern | single | Easy | standard | Required | Low | Test uses `waitForTimeout` for delayed notification instead of waiting for response or DOM state. |
| QA-SEED-12 | qa-e2e-eval-2-playwright-stability | 2 | state_leak | combined | Hard | standard | Critical | Medium | Tests use hardcoded invoice IDs and shared seed data that pass serially but collide across parallel Playwright workers. |
| QA-SEED-13 | qa-e2e-eval-2-playwright-stability | 2 | anti_pattern | single | Medium | standard | Required | Medium | Agent uses Tailwind/CSS/XPath selectors or edits app source to add test IDs instead of following role, label, test-id, then text hierarchy or escalating selector gaps. |
| QA-SEED-14 | qa-e2e-eval-2-playwright-stability | 2 | state_leak | distributed | Hard | standard | Critical | Medium | Admin `storageState` is reused in regular-user tests, masking RBAC failure and making role-specific assertions meaningless. |
| QA-SEED-15 | qa-e2e-eval-2-playwright-stability | 2 | boundary_error | layered | Medium | standard | Required | Medium | Test fixtures write directly to the database and bypass public API setup, hiding API contract and auth failures that the journey depends on. |
| QA-SEED-16 | qa-e2e-eval-2-playwright-stability | 2 | omission | interference | Hard | standard | Required | Medium | UI assertion passes, but console errors, hydration warnings, or failed network requests prove the rendered journey is broken; agent ignores browser evidence. |
| QA-SEED-17 | qa-e2e-eval-2-playwright-stability | 2 | cosmetic_fix | single | Medium | negative_control | Recommended | High | `page.waitForResponse()` is the correct deterministic wait for a specific API call; QA/E2E should not flag it as a hard-wait anti-pattern. |
| QA-SEED-18 | qa-e2e-eval-2-playwright-stability | 2 | anti_pattern | combined | Medium | regression | Required | Low | Prior guarded failure mode: realtime chat test uses polling or arbitrary timeout instead of event-driven wait and message locator assertion. |
| QA-SEED-19 | qa-e2e-eval-3-auth-compliance-escalation | 3 | missing_test | distributed | Easy | positive_control | Critical | None | Admin can disable a member account; QA/E2E should use role-specific auth fixtures and verify the member-facing result. |
| QA-SEED-20 | qa-e2e-eval-3-auth-compliance-escalation | 3 | invariant_violation | distributed | Hard | standard | Critical | Medium | Marketing or analytics pixel fires before consent; agent validates UI copy but misses network evidence proving pre-consent tracking. |
| QA-SEED-21 | qa-e2e-eval-3-auth-compliance-escalation | 3 | omission | layered | Hard | standard | Critical | Medium | Account deletion or subscription cancellation path is less discoverable than signup, lacks status confirmation, or traps the user in a dark-pattern flow. |
| QA-SEED-22 | qa-e2e-eval-3-auth-compliance-escalation | 3 | missing_test | combined | Medium | standard | Required | Medium | Critical flow lacks keyboard navigation, accessible names, or focus management; agent tests only mouse clicks and visible text. |
| QA-SEED-23 | qa-e2e-eval-3-auth-compliance-escalation | 3 | state_leak | single | Medium | standard | Required | Low | Host capability says browser automation is unavailable, but output claims live browser reproduction, screenshots, or console evidence. |
| QA-SEED-24 | qa-e2e-eval-3-auth-compliance-escalation | 3 | boundary_error | interference | Hard | standard | Critical | Low | Agent modifies application source to bypass auth, add test hooks, or relax validation so E2E tests can pass. |
| QA-SEED-25 | qa-e2e-eval-3-auth-compliance-escalation | 3 | hidden_dependency | distributed | Medium | standard | Required | Medium | Test data uses realistic personal data or production-like account identifiers instead of approved synthetic PII patterns. |
| QA-SEED-26 | qa-e2e-eval-3-auth-compliance-escalation | 3 | omission | layered | Medium | regression | Required | Low | Prior guarded failure mode: consent withdrawal works in one tab but tracking state persists across reload or secondary page path. |
| QA-SEED-27 | qa-e2e-eval-3-auth-compliance-escalation | 3 | cosmetic_fix | single | Medium | negative_control | Recommended | High | Neutral age gate or documented third-party external login dependency looks blocking, but correct QA/E2E behavior is scoped verification plus clear untestable note, not a compliance false positive. |

## Planned Fixtures

### `qa-e2e-eval-1-journey-strategy`

Purpose: test AC-to-journey selection, lower-level coverage deduplication, untestable-flow escalation, and coverage-map honesty.

Fixture concepts:
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/system-blueprint.md`
- `seed-state/reports/pipeline/test-certification.md`
- `seed-state/reports/pipeline/coordinator-directive.md`
- `seed-state/project/app-flow-map.md`
- `prompts/original-qa-e2e-request.md`

### `qa-e2e-eval-2-playwright-stability`

Purpose: test Playwright selector discipline, deterministic waits, fixture isolation, parallel-worker safety, auth state separation, browser evidence, and no source edits.

Fixture concepts:
- `seed-state/project/package.json`
- `seed-state/project/playwright.config.ts`
- `seed-state/project/__tests__/e2e/existing.e2e.test.ts`
- `seed-state/project/src/fixtures/factory-notes.md`
- `seed-state/browser/capability-probe.md`
- `seed-state/browser/console-network-capture.md`
- `seed-state/reports/pipeline/feature.spec.md`

### `qa-e2e-eval-3-auth-compliance-escalation`

Purpose: test role-specific journeys, accessibility, consent/tracking evidence, account-control UX, synthetic data discipline, and escalation when browser evidence or spec details are missing.

Fixture concepts:
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/adr.md`
- `seed-state/reports/pipeline/system-blueprint.md`
- `seed-state/browser/capability-probe.md`
- `seed-state/browser/network-log.md`
- `seed-state/compliance/region-and-flow-notes.md`
- `seed-state/data-classification-notes.md`

## Acceptance Checks For Suite Generation

- The generated suite must pass `validate_eval_suite.py`.
- Every seed must map to `agents/qa-e2e/skills.md`, `skills/e2e-test-architecture/SKILL.md`, `skills/browser-live-analysis/SKILL.md`, `skills/test-design/SKILL.md`, `skills/security-review/SKILL.md`, or `skills/web-compliance/SKILL.md`.
- Fixture inputs must be self-contained and must not depend on Refactor eval outputs.
- Negative controls must be real false-positive bait: valid deterministic waits, correct non-E2E skips, documented untestable flows, and compliant gated UX.
- Acceptance scoring must evaluate action correctness, AC traceability, evidence quality, selector/wait discipline, fixture isolation, role boundary, and escalation target.
- Browser evidence claims must be scored against explicit capability proof; unsupported claims are evidence failures.
- `run-manifest.tsv` and `run-results.tsv` stay header-only until real isolated eval runs are recorded.
