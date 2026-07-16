# ADR-<id>: <short title>

- Status: PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED
- Date: <ISO-8601 UTC>
- Spec: <SPEC-id> v<version> (hash: <sha256>)
- Author: Software Architect Agent / <human reviewer>

## Constitution Check

*Complete this before writing any other section. An unjustified violation is a blocking escalation.*

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | COMPLIES / EXCEPTION / N/A | |
| II — Test-First | COMPLIES / EXCEPTION / N/A | |
| III — Simplicity Gate | COMPLIES / EXCEPTION / N/A | |
| IV — Anti-Abstraction Gate | COMPLIES / EXCEPTION / N/A | |
| V — Integration-First Testing | COMPLIES / EXCEPTION / N/A | |
| VI — Security-by-Default | COMPLIES / EXCEPTION / N/A | |
| VII — Spec Integrity | COMPLIES / EXCEPTION / N/A | |
| VIII — Observability | COMPLIES / EXCEPTION / N/A | |

Any EXCEPTION must have a row in the Complexity Justification table below.

## Research Summary

- Research artifact: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/research.md` / N/A (no library or technology choices in spec)
- Key decision: <one-sentence summary of what was selected and why, or N/A>

## Planning Preflight Evidence

- Coordinator Planning Preflight: PASS / FAIL
- Spec hash verified at:
- Red-Team status and artifact:
- System Blueprint status and artifact:
- CodeBase Analyzer reports consumed:
- Reverse-spec artifacts consumed:
- Validator result or waiver:

## Context

What problem are we solving? What forces are acting on this decision?

Describe the situation that makes this decision necessary. Include:
- The relevant system drivers (scale, complexity, coupling, release cadence, team size)
- Constraints that cannot be changed (latency SLAs, regulatory, existing infrastructure)
- What happens if we do nothing

## Decision

What have we decided to do?

State the decision in one or two sentences. Be direct — no "we are considering" or "we might." This is a decision record, not a discussion document.

**Pattern(s) selected:** e.g., Clean Architecture + CQRS

## Default Heuristic Alignment

State whether this decision follows or departs from the project's default architecture heuristic.

- Default heuristic: modular monolith at the macro level, vertical slices for feature ownership, and hexagonal boundaries only where external I/O or business-critical logic justify them. Frontend applications use Feature-Sliced Design. Small or simple features should avoid unnecessary architecture ceremony.
- Alignment: FOLLOWS / DEPARTS
- Notes: <why this decision follows the default, or which concrete constraints justify a departure>

## Rationale

Why this decision and not the alternatives?

Map the decision to the system drivers:
- Driver 1 (e.g., complex domain logic) → addressed by Clean Architecture's explicit Entities ring
- Driver 2 (e.g., asymmetric read/write load) → addressed by CQRS read model separation
- Driver 3 (e.g., audit trail required) → addressed by...

## Pattern Evaluation

All candidate patterns evaluated before selection. Fit Band is qualitative, not
a fake precision score. Adaptability reflects how easily this choice can be
replaced or extended as requirements and technology evolve. When two patterns
land in the same Fit Band, the higher-adaptability pattern is preferred per the
Adaptability First principle unless a hard requirement rules it out.

| Pattern | Fit Band | Adaptability | Evidence Basis | Pros | Cons | Key Tradeoffs | Verdict |
|---------|----------|--------------|----------------|------|------|---------------|---------|
| Clean Architecture + CQRS | Strong fit | High | analogical | Business logic isolated from deps; read/write concerns separated; highly testable | Higher initial structure; CQRS projection lag requires UI handling | Eventual consistency in read models; justified by long-term swap flexibility | **SELECTED** |
| Layered Architecture | Weak fit | Low | prior_art | Familiar pattern; low upfront effort | Business logic coupled to layers; framework lock-in | Costly migration when stack changes; poor long-term adaptability | Not selected — low adaptability despite lower initial cost |
| Vertical Slice | Viable fit | Medium | analogical | Feature-focused; clean feature addition and deletion | Overhead not justified for team size | Cross-slice duplication expected; shared logic extraction required at scale | Not selected — team size does not justify feature ownership model |
| Microservices | Rejected | Medium | analogical | Independent deployment per service | Distributed systems complexity pre-PMF | Operational overhead slows delivery; complexity not justified at current stage | Not selected — violates current operations constraint |

## Quality Attribute Scorecard

Score the selected architecture across all core axes plus any triggered optional axes from `skills/architecture-decisions/SKILL.md`.

- Core axes are always required.
- Optional axes require an `Activation Source`.
- If `Score <= 2`, mitigation details are required.
- Do not use weighted sums. The scorecard supports judgment; it does not replace it.

| Axis | Definition | Score (1-5) | Confidence | Strengths | Weaknesses | Rationale | Assumptions | Activation Source | Mitigation / Owner / Enforcement / Deadline | Review Trigger | Delta vs Runner-up |
|---|---|---|---|---|---|---|---|---|---|---|---|
| modifiability | | | `measured` / `prior_art` / `analogical` / `assumed` | | | | | `always-on` | | | |
| modularity | | | | | | | | `always-on` | | | |
| scalability | | | | | | | | `always-on` | | | |
| reliability | | | | | | | | `always-on` | | | |
| security | | | | | | | | `always-on` | | | |
| operability | | | | | | | | `always-on` | | | |
| cost | | | | | | | | `always-on` | | | |
| testability | | | | | | | | `always-on` | | | |
| <optional-axis> | | | | | | | | <cite the activating requirement or blueprint signal> | | | |

## Overall Strengths

- <What this architecture naturally does well overall>

## Overall Weaknesses

- <What this architecture makes harder overall>

## Tradeoff Tension

State the main sacrifice this decision accepts.

- Example: `We are trading deployment independence for lower operational cost.`

## Why This Won

Explain why the selected candidate won despite its weaknesses. Reference dominant drivers, critical constraints, and the runner-up tradeoff.

## Runner-Up Comparison

Identify the strongest rejected alternative and the decisive differences.

- Runner-up:
- Why it lost:

## Consequences

**Positive:**
- Testable business logic without database or framework dependencies
- Read models can be optimized independently of write throughput
- ...

**Negative / Tradeoffs:**
- Higher initial complexity; steeper onboarding for developers unfamiliar with CQRS
- Eventual consistency in read models requires UI handling strategy
- ...

**Risks:**
- Risk: Projection rebuild time not tested early → plan: include rebuild time in acceptance criteria for first projection
- Risk: ...

## Mitigations Required

List mitigations for any axis scored `1` or `2`.

- Weak axis:
- Mitigation:
- Owner:
- Enforcement:
- Deadline or trigger:

## Migration Safety (required for brownfield, reverse-spec, or migration work)

| Safety Item | Decision / Evidence | Owner |
|---|---|---|
| Expand/contract shape | | |
| Dual-write or read-routing plan | | |
| Backfill plan | | |
| Reconciliation checks | | |
| Observability proving phase health | | |
| Rollback test | | |
| Cutover approval and timing | | |
| Point of no return | | |
| Post-cutover verification | | |

If not applicable, state why. Do not leave this section blank for brownfield,
reverse-spec, or migration-driven architecture.

## Re-evaluation Triggers

Define when this scorecard must be revisited.

- Calendar trigger:
- Scale trigger:
- Topology trigger:
- Dependency trigger:

## Module / Service Boundaries

What are the explicit boundaries this decision creates?

```
src/
  domain/         # Ring 1: Entities — no external dependencies
  application/    # Ring 2: Use Cases — depends on domain only
  adapters/       # Ring 3: Interface Adapters
  infrastructure/ # Ring 4: Frameworks & Drivers
```

## API / Event Contract Summary

What interfaces does this decision define that other agents must respect?

- `IInvoiceRepository` — interface defined in Ring 2, implemented in Ring 3
- `InvoiceCreated` integration event — published by Order Service, consumed by Notification and Analytics
- ...

## Enforcement

How do we prevent violations?
- CI lint rule: no imports from `infrastructure/` in `domain/` or `application/`
- Code Review Agent must flag any direct ORM usage in use cases
- Architecture compliance is a Required finding in Code Review

## Complexity Justification

*Fill only if Constitution Check has EXCEPTION entries. Empty = no violations.*

| Article Violated | Why This Complexity Is Needed | Simpler Alternative Considered | Why Simpler Alternative Was Insufficient |
|-----------------|-------------------------------|-------------------------------|------------------------------------------|
| | | | |

## Related Decisions

- Supersedes: ADR-<id> (if applicable)
- Relates to: ADR-<id> (if applicable)
