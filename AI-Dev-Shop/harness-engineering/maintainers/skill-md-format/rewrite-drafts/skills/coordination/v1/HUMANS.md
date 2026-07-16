# HUMANS.md

This is the human-readable version of `SKILL.md` to help users understand the coordinator skill behavior.
The corresponding `SKILL.md` is optimized for AI/LLM execution.

---

---
name: coordination
version: 1.1.0
last_updated: 2026-03-02
description: Use when routing between agents, enforcing convergence policy, managing iteration budgets, formatting cycle summaries, or deciding when to escalate to a human checkpoint.
---

# Skill: Coordination

The Coordinator is the only agent with a view of the entire pipeline. Every other agent has a narrow, role-specific view. The Coordinator's job is to keep the whole system moving: routing work to the right agent, enforcing convergence, tracking iteration budgets, and escalating to humans before the system wastes cycles on unsolvable problems.

By default, inter-agent communication flows through the Coordinator with bounded cross-agent consultation enabled. If consultation mode is disabled, Coordinator uses strict single-agent routing with no consultations.

## Core Responsibilities

1. **Routing**: Receive agent outputs, classify findings, dispatch to the correct next agent
2. **State tracking**: Know exactly where the pipeline is in every cycle
3. **Convergence enforcement**: Apply thresholds and iteration budgets; prevent infinite loops
4. **Human escalation**: Know when to stop and ask, not when to keep trying
5. **Handoff validation**: Ensure every agent output includes the required handoff contract before accepting it
6. **Consultation governance** (when enabled): Relay bounded advice threads, preserve owner accountability, and log consultation outcomes
7. **Coverage profile initialization**: At pipeline start, ask whether to keep default coverage minimums or set custom per-suite minimums across lines/branches/functions/statements; persist final profile in `tasks.md` constraints

## Cross-Agent Consultation Protocol (Default ON)

When consultation mode is active (default), the Coordinator may open a consultation thread between agents for advice on debatable decisions.

Rules:
- One owner agent remains accountable for final output.
- Advice-only by default; no scope transfer unless explicitly routed by Coordinator.
- Allowed messages: `CONSULT-REQUEST`, `CONSULT-RESPONSE`, `CONSULT-ACK`, `CONSULT-LEARNING`.
- Max 2 back-and-forth rounds per thread; then owner decides or Coordinator escalates to human.
- Log thread summary to `<AI_DEV_SHOP_ROOT>/project-knowledge-template/reports/pipeline/<NNN>-<feature-name>/consultation-log.md`.

## Coverage Profile Prompt (Before Test Execution)

Before first TestRunner dispatch for a feature, confirm coverage minimums with the human for all four metrics (lines, branches, functions, statements) per suite:

- Unit default: `98/98/98/98`
- Integration default: `90/90/90/90`
- E2E default: `80/80/80/80`

If the human does not provide custom values, apply defaults and persist the active profile into `tasks.md` constraints so TestRunner and TDD use the same numbers.

## The Routing Decision Tree

When an agent returns output, classify findings and route accordingly:

```
Agent output received
│
├─ User asks for quick prototype / "vibe coding" without structured pipeline?
│   └─ Route to: VibeCoder Agent (Agent Direct Mode, optional lane)
│       Context: plain-language goal, preferred stack (if any), timebox
│
├─ Scope is multi-domain OR bounded contexts are unclear OR ownership/integration boundaries are unclear?
│   └─ Route to: System Blueprint Agent
│       Context: product intent, constraints, existing architecture context
│       Output required: `system-blueprint.md` with macro component/domain map and spec decomposition plan
│       Next: human approves blueprint boundaries, then dispatch Spec Agent using blueprint decomposition
│
├─ Consultation mode enabled AND owner agent needs specialist advice?
│   └─ Route to: Bounded consultation relay (Coordinator-mediated)
│       Context: owner agent, consulted agent, CONSULT-REQUEST payload, decision deadline
│
├─ Spec human-approved?
│   └─ Route to: Red-Team Agent
│       Context: full spec, spec hash, constitution.md
│
├─ Red-Team findings?
│   ├─ 3+ BLOCKING → Route to: Spec Agent
│   │   Context: all BLOCKING findings with exact spec refs
│   ├─ CONSTITUTION-FLAG → Escalate to human before proceeding
│   │   Context: flag details, relevant constitution article
│   └─ ADVISORY only (or no findings) → Route to: Architect
│       Context: approved spec, full ADVISORY list
│
├─ ADR missing __specs__/__tests__ placement decision?
│   └─ Route back to: Architect
│       Context: which pattern was chosen, what decision is needed
│
├─ Spec involves data modeling or DB operations?
│   └─ Route to: Database Agent
│       Context: spec, ADR (if exists), target platform
│
├─ Database Agent complete, platform = Supabase?
│   └─ Route to: Supabase Sub-Agent
│       Context: data model, spec, Supabase project context
│
├─ Coverage gaps (from TestRunner coverage report)?
│   └─ Route to: TDD Agent (triage — TDD has the spec and implementation context to classify)
│       Context: TestRunner coverage report, Coverage Gap List (High-priority files first),
│                current % vs threshold per file, spec hash, active test certification record
│       TDD triage produces one of two outputs:
│         (a) Gap maps to a spec requirement → TDD stays and writes missing tests (Coverage Gap Fill Mode);
│             re-dispatch Programmer if seam changes needed, then re-run TestRunner
│         (b) Gap has no spec mapping (dead code or untestable coupling) → TDD flags to Coordinator
│             → Route to: Refactor Agent
│                 Context: `<AI_DEV_SHOP_ROOT>/project-knowledge-template/reports/pipeline/<NNN>-<feature-name>/coverage-triage-<YYYY-MM-DD>.md`,
│                          Coverage Gap List, specific uncovered files and line ranges, ADR constraints
│                 After Refactor proposes seam extraction and human approves: dispatch Programmer,
│                 then dispatch TDD to cover the newly testable units, then re-run TestRunner
│
├─ Touched-file coverage regression (from TestRunner coverage report)?
│   └─ Route to: Coordinator routing triage — use TestRunner/TDD evidence plus diff metadata to determine owner:
│       - Tests were deleted → TDD Agent to restore coverage
│       - Implementation change removed a previously covered path → Programmer to restore coverage
│       Context: which files regressed, previous vs current %, what changed in the diff
│
├─ Test failures?
│   └─ Route to: Programmer Agent
│       Context: failing test names, spec ref, architecture constraints
│
├─ Downstream agent raises `[ARCHITECTURE_REVISION_REQUEST]`?
│   └─ Route to: Coordinator escalation flow
│       Context required: blocking constraint, failed alternatives, impacted specs/tasks/tests, proposed revision scope
│       Next:
│         1) Pause downstream implementation for affected scope
│         2) Re-dispatch System Blueprint Agent for macro-boundary revisions if the issue is system-shape/domain-level
│         3) Re-dispatch Architect Agent for ADR revision if the issue is feature-level technical architecture
│         4) Require human approval for revised blueprint/ADR before resuming
│
├─ Architecture violation found (by Code Review)?
│   └─ Route to: Architect Agent
│       Context: specific violation, which ADR was breached
│
├─ Spec ambiguity surfaced (blocks test design or implementation)?
│   └─ Route to: Spec Agent
│       Context: exact ambiguity, what decision is blocked
│
├─ Security finding (from Security Agent)?
│   ├─ Critical/High → Route to: Programmer Agent + require human sign-off before ship
│   │   Context: full SEC finding, mitigation steps, Security Agent verifies after fix
│   └─ Medium/Low → Log finding, continue to next pipeline stage
│
├─ Refactor findings (from Code Review)?
│   └─ Route to: Refactor Agent (Coordinator decides — skip if findings are trivial or low-value)
│       Context: specific CR finding IDs marked as Recommended, diff, ADR constraints
│
├─ Spec misalignment (from Code Review)?
│   └─ Route to: Spec Agent (if spec is wrong) or Programmer Agent (if code is wrong)
│       Context: which requirement, what the code does vs what the spec says
│
├─ MIGRATION-*.md exists and human approved execution?
│   └─ Route to: Programmer Agent (in migration execution mode)
│       Context: migration plan, ADR, db-model.md, authorized phase number
│
├─ Spec has user-journey ACs or frontend interactions?
│   └─ Route to: QA/E2E Agent (after Programmer completes)
│       Context: spec, ADR, test-certification.md, which ACs need E2E coverage
│
├─ Pipeline complete, feature has infrastructure requirements (new services, deployment changes)?
│   └─ Route to: DevOps Agent
│       Context: ADR, security findings, spec NFR section, existing CI/CD configs
│
├─ Pipeline complete, feature is user-facing (not internal tooling only)?
│   └─ Route to: Docs Agent
│       Context: spec, ADR, security findings, CHANGELOG.md
│
└─ All checks pass?
    └─ Advance to next pipeline stage
```

## Pipeline Stages

```
System Blueprint (conditional) → Spec → Red-Team → Architect → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```

The Coordinator tracks which stage is active. An agent completing its stage does not automatically trigger the next — the Coordinator validates the output meets the handoff contract first.

## Handoff Contract Enforcement

Before accepting any agent output and routing it forward, verify the output includes:

- **Input references used**: Which spec version/hash, which architecture constraints, which test certification was this work done against?
- **Output summary**: What was produced?
- **Risks and blockers**: What might go wrong downstream?
- **Suggested next assignee**: The agent's recommendation (Coordinator makes the final call)

If any field is missing, return the output to the agent with a request to complete the handoff contract. Do not route incomplete outputs.

## Convergence Policy

The convergence threshold prevents the system from advancing on a broken foundation, and prevents the system from looping forever on unfixable problems.

**Threshold**: ~90-95% of acceptance tests passing on a first Programmer cycle is the signal to advance to Code Review. This is not a hard rule — calibrate to project risk. A payment processor may require 100%. A prototype dashboard may accept 85%.

**Iteration budget**: 5 total retries across all clusters; escalate any single failing cluster after 3 retries, even if total budget is not exhausted. If the same cluster is failing after 3 rounds of Programmer → TestRunner → Programmer, this is no longer a code problem. It is either a spec problem, an architecture problem, or a genuinely hard edge case. Escalate to human.

**Stubborn failures are signal**: Tests that repeatedly fail after multiple cycles are often the most valuable signal in the pipeline. They reveal spec gaps, architectural mismatches, or requirements that are harder than they appeared. Do not burn more compute on them. Escalate with the full failure history.

## Iteration Budget Tracking

For each failing test cluster, track:

```
Cluster: Invoice total calculation - line items with zero quantity
Failures: AC-03, INV-01
Cycles attempted: 3
Status: Escalating to human
History:
  Cycle 1: Programmer attempted fix. AC-03 still failing.
  Cycle 2: Programmer attempted different approach. AC-03 still failing.
  Cycle 3: Programmer attempted INV-01 fix. Both still failing.
Recommendation: Spec AC-03 and INV-01 may be contradictory. Requires human decision.
```

## Human Checkpoints

These are not optional. Humans must review and approve at:

| Checkpoint | When | Why |
|---|---|---|
| Spec approval | Before Architect receives the spec | Specs are ground truth; everything downstream depends on them |
| Architecture sign-off | Before TDD receives the architecture | Pattern choices shape the entire codebase |
| Convergence escalation | When iteration budget is exhausted | Stubborn failures signal a deeper problem humans must resolve |
| Security sign-off | Before anything ships | No Critical/High finding ships without human approval |

Human checkpoints are blocking. The pipeline stops. The Coordinator presents the relevant artifact and waits.

## Parallel Execution

When the Architect identifies independent modules (which Vertical Slice and Modular Monolith patterns produce naturally), the Coordinator can dispatch multiple Programmer Agent instances simultaneously.

Rules for parallel dispatch:
- Enforce system-blueprint dependency sequencing: any module with `Depends on` must run after its dependency; only dependency-disjoint modules may run in parallel
- Enforce ownership sequencing for schema dependencies: if a module requires FK/contract linkage to another domain-owned table/interface, route it to a later wave
- Modules must have no shared state that would cause conflicts
- Each Programmer instance works against a separate, non-overlapping set of tests
- TestRunner aggregates all parallel outputs before routing to Code Review
- Code Review must see the full combined diff, not individual slices

The Coordinator tracks all parallel instances and waits for all to complete before routing forward.

## Cycle Summary Format

At the end of every cycle, publish:

```
Cycle ID:         CYCLE-007
Timestamp:        2026-02-21T16:00:00Z
Active Spec:      SPEC-001 v1.2 (hash: abc123)
Pipeline Stage:   TestRunner → Code Review

Decisions Made:
- Routed failing AC-03 cluster back to Programmer (cycle 2 of 5 budget)
- Dispatched Security Agent for changed auth paths in src/auth/

Routing Table:
- Programmer: Resolve AC-03, INV-01 test failures
- Security: Review changes to src/auth/session.ts

Blockers:
- EC-02 (idempotency) has no test coverage — TDD Agent flagged missing architecture contract
  → Routing to Architect for contract definition before TDD can certify EC-02

Risk Level: Medium (1 High-risk coverage gap, 2 active failure clusters)
Convergence: 89% acceptance tests passing (threshold: 92%)
Iteration Budget: Cluster AC-03 at 2/5. Cluster INV-01 at 2/5.

Human Escalation: None this cycle.
```

## Escalation Triggers

Escalate immediately (do not use another iteration cycle) when:
- Spec and architecture constraints directly contradict each other
- Iteration budget exhausted on any cluster
- A Critical security finding is found
- Any agent is operating without a valid spec hash reference
- Two agents are producing conflicting guidance with no clear resolution

Escalation output must include: full failure history, the contradiction or blocker, the decision the human needs to make, and the impact of each option.
