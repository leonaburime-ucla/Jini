# Seed Ledger — arch-eval-1-billing-ledger-migration (v2 — post-audit)

**Eval ID**: benchmark-suite / arch-eval-1-billing-ledger-migration
**Purpose**: Test Software Architect agent's scorecard judgment, axis
activation discipline, blocking rule enforcement, confidence calibration,
adaptability application, and migration safety reasoning.
**Difficulty**: Staff-to-Distinguished. 34 seeds across 4 tiers.
**Post-audit**: Merged duplicates (16/28, 18/30, 21/32, 11/29), fixed
contradictions, tightened scoring criteria, added fixture grounding.

## Scoring Model

| Score | Criteria |
|-------|----------|
| CAUGHT | ADR demonstrates correct judgment |
| PARTIAL | Partially addresses but with wrong reasoning or missing detail |
| MISSED | Fails to exhibit required judgment |
| FALSE_POSITIVE | Incorrectly flags/activates something that shouldn't be |
| CORRECT_SKIP | Correctly does NOT activate/flag (for NCs) |

**Gated scoring:** Missing SEED-ARCH-01 or SEED-ARCH-04 caps total at 60%.

---

## TIER 1-2 (Baseline — expect 85-100%)

### SEED-ARCH-01 — compliance_auditability MUST Activate (T2)

SOC 2 + actor traceability + 5-year retention + known trigger-bypass incidents.
- CAUGHT: Activates compliance_auditability with cited sources
- MISSED: No compliance axis in scorecard

### SEED-ARCH-02 — tenant_isolation Must NOT Activate (NC) (T2)

Fixture explicitly states: "Customer data separation is a SECURITY concern but NOT an architectural multi-tenancy concern." HIPAA isolation is a separate compliance concern.
- CORRECT_SKIP: Does NOT activate tenant_isolation (may address customer data security under security axis instead)
- FALSE_POSITIVE: Activates tenant_isolation based on "2,400 customers"
- Note: HIPAA environment isolation is scored separately under compliance, not tenant_isolation

### SEED-ARCH-04 — Microservices Must Be REJECTED (T2)

5 FTE, no distributed saga experience, shared platform engineer at 33%. 4 services for this team = critical operability/cognitive_load failure.
- CAUGHT: Rejects Candidate C citing team capacity, marks operability or cognitive_load ≤2, or assigns "Weak fit" / "Rejected" fit band
- MISSED: Evaluates microservices as viable without blocking

### SEED-ARCH-06 — Confidence Must Use Available Evidence (T2)

340 tests, 12K events/sec load data (8 months), incident postmortems, batch timing (2.5hr) = real evidence.
- CAUGHT: Uses prior_art/measured for axes where evidence exists; ≤2 core axes at "assumed"
- MISSED: Defaults majority to "assumed" despite documented evidence

### SEED-ARCH-08 — Tradeoff Tension Must Name a Real Sacrifice (T2)

Acceptable tensions include: "trading architectural elegance for team operational safety," "trading scalability ceiling for delivery predictability," "trading replay capability for operational simplicity."
- CAUGHT: Names a concrete sacrifice (something the winner is genuinely worse at than the runner-up)
- PARTIAL: Generic "we trade complexity for simplicity" without specifics
- MISSED: No tension articulated, or claims winner has no real weakness

### SEED-ARCH-10 — Conditional Skill: No RAG, Yes Data-Engineering (T1)

Nothing involves AI/ML/RAG. Usage event ingestion = data engineering signal.
- CAUGHT: Does not load rag-ai-integration; loads or references data-engineering/event-pipeline skills
- MISSED: Loads irrelevant AI skills or omits data-engineering

---

## TIER 2-3 (Solid Judgment — expect 60-85%)

### SEED-ARCH-03 — Event Sourcing Operability ≤3 (T3)

ES fits the domain but team has zero ES production experience. Scoring operability 4-5 ignores operational reality. Scoring 1 ignores that the PATTERN is proven (just not by this team).
- CAUGHT: Scores ES operability 2-3 with team gap AND incident-rate risk cited
- PARTIAL: Acknowledges gap but scores 4 ("pattern is well-documented")
- MISSED: Scores 4-5 on theoretical benefits

### SEED-ARCH-05 — Modular Monolith Has Real Strengths (T3)

Candidate D uses team's known stack, satisfies Simplicity Gate, lowest risk. Must not be reflexively dismissed. However, fixture says extraction is required (standalone ledger service), so rejection is correct — but strengths must be acknowledged first.
- CAUGHT: Evaluates D as "Viable but insufficient" or "Partial fit" with genuine strengths before rejecting on spec grounds (independent deployment required)
- MISSED: Assigns "Rejected" / "Weak fit" based on "monolith = bad" without acknowledging strengths

### SEED-ARCH-07 — Adaptability First: Apply Only Within Same Fit Band (T3)

Constitution states: "Adaptability does NOT override a superior Fit Band." If Candidate A (ES) is "Viable fit" and Candidate B (Hexagonal) is "Strong fit," adaptability cannot make A win.
- CAUGHT: Explicitly states adaptability tiebreaker applies only within same band; if bands differ, higher band wins
- PARTIAL: Selects correctly but doesn't cite the rule
- MISSED: Uses adaptability to override a fit-band advantage

### SEED-ARCH-09 — Migration Safety: Shadow + Reconciliation + Rollback + Ownership (T2)

Brownfield extraction requires: shadow/dual-write, reconciliation (with criteria), rollback mechanism, split-brain prevention, cutover criteria.
- CAUGHT: Addresses all 5 elements with specifics
- PARTIAL: Mentions phasing without reconciliation or rollback details
- MISSED: Target-architecture-only ADR with no migration path

### SEED-ARCH-11 — Contradicting Exec Constraints: Reframe AND Escalate (T3)

CFO "exactly-once, not at-least-once with dedup" vs CTO "zero loss under partitions." True exactly-once is impossible. Correct answer: reframe to "effectively exactly-once via idempotent processing" (satisfies CFO's business intent) AND flag that the literal wording contradicts distributed systems reality AND name who must align the stakeholders.
- CAUGHT: Both reframes practically (idempotency = business-exactly-once) AND flags the literal contradiction AND names escalation path
- PARTIAL: Either reframes without flagging, or flags without proposing resolution
- MISSED: Claims architecture satisfies both literally, or rejects all candidates

### SEED-ARCH-12 — HIPAA Roadmap: Approve With Isolation Conditions (T2)

Q4 2026 healthcare customer = ~4 months out. Correct answer: approve current architecture WITH explicit conditions (data classification boundaries, environment isolation seams by week N, BAA validation).
- CAUGHT: Approves with HIPAA-readiness conditions and timeline gate
- PARTIAL: Mentions HIPAA only in re-evaluation triggers without influencing current design
- MISSED: Ignores or blocks current architecture entirely due to HIPAA

### SEED-ARCH-14 — Kafka Unreliable: Adjust or Mitigate (T3)

3 outages/6 months, no SLA. If architecture depends on Kafka for billing events, must either lower reliability score OR mandate buffering (SQS, local file) OR adopt the metering team's proven workaround.
- CAUGHT: Acknowledges risk AND either adjusts reliability score downward or mandates durable buffer mitigation
- PARTIAL: Mentions Kafka instability without scoring impact or mitigation
- MISSED: Assumes Kafka is reliable
- CORRECT_SKIP: If architecture avoids Kafka dependency entirely, no penalty required

---

## TIER 3 (Genuine Ambiguity — expect 50-75%)

### SEED-ARCH-15 — Bounded Event Sourcing Is Valid (T3)

All-or-nothing ES rejection is wrong. Append-only audit ledger (a subset of ES semantics) for the financial core, standard CRUD for operational state, is a legitimate hybrid. The fixture's audit-trigger bypass history strengthens this case.
- CAUGHT: Proposes or acknowledges bounded ES application (append-only audit layer only) as viable, distinct from full ES+CQRS platform
- PARTIAL: Mentions "maybe for audit" without architectural bounds or conditions
- MISSED: Hard blocks all ES or approves full ES platform

### SEED-ARCH-16 — Operability Should Be 3 During Migration (T3)

Hexagonal service on team's stack sounds like operability 4-5. But migration adds: shadow mode complexity, dual-write monitoring, reconciliation tooling, new consumer debugging. During transition, operability is honestly 3.
- CAUGHT: Scores operability 3 with migration-phase burden as specific weakness
- PARTIAL: Scores 4 with minor transition caveats
- MISSED: Scores 5 because "team knows the stack" ignoring transition overhead

### SEED-ARCH-17 — Performance Score: 3 Pending Load Test (T3)

12K events/sec on EXISTING schema is measured. Performance on NEW schema (hexagonal service, new tables, new indexes) is UNPROVEN. Confident 4-5 is overclaiming. The score should be 3 with "analogical" confidence and a research/load-test condition.
- CAUGHT: Scores 3 with analogical/assumed confidence, requires load test as validation gate
- PARTIAL: Scores 4 with minor caveat
- MISSED: Confident 4-5 claiming prior measured evidence applies to new architecture

### SEED-ARCH-18 — Shadow Mode Is Non-Negotiable (T3)

Fixture states: "Shadow mode must prove zero divergence for at least 2 full billing cycles before cutover." An agent suggesting direct cutover or abbreviated shadow violates an explicit constraint.
- CAUGHT: Requires full shadow mode with 2-cycle reconciliation proof
- PARTIAL: Mentions shadow but suggests abbreviation for timeline
- MISSED: Proposes direct cutover

### SEED-ARCH-19 — Rollback = Compensating Entries, Not Code Revert (T3)

Fixture states: "destructive state rollback violates audit trail integrity. The standard is compensating journal entries." Normal code-rollback semantics don't apply to financial ledgers.
- CAUGHT: Migration rollback strategy uses compensating entries or preserves audit trail; explicitly notes destructive rollback is forbidden
- PARTIAL: Says rollback is complex without specifying why for financial data
- MISSED: Proposes standard code-revert rollback plan

### SEED-ARCH-20 — Hot/Cold Storage: Raw Events Can Go Cold After 90 Days (T3)

Fixture: "Raw usage events must be retained for 3 years (cold storage acceptable after 90 days)." An agent assuming 3 years of raw events in hot Postgres is ignoring the stated tiering boundary.
- CAUGHT: Proposes tiered storage — hot operational (90 days) + cold archival (S3/glacier) with retrieval path for disputes
- PARTIAL: Mentions retention without cold-storage separation
- MISSED: Assumes all 3 years live in active Postgres

### SEED-ARCH-21 — Python Handles 12K/sec I/O-Bound Work (T3)

Billing event processing is I/O-bound (DB writes), not CPU-bound. Python async handles I/O concurrency fine. GIL is irrelevant. Proposing Go/Rust violates team capability constraint.
- CAUGHT: Correctly identifies I/O-bound nature, keeps Python, notes GIL irrelevant for async DB writes
- PARTIAL: Mentions Python performance concern without resolving
- MISSED: Recommends language change violating team constraint

### SEED-ARCH-22 — Strangler-Fig Should Be Data-Driven for Financial Systems (T3)

Standard strangler uses HTTP proxy. For financial ledgers where consistency > routing, data-driven migration (CDC/outbox from Django DB) is safer.
- CAUGHT: Proposes data-consistency-led migration mechanism (outbox, CDC, event publishing) as primary, not just HTTP routing
- PARTIAL: Mentions both without elevating data-driven for financial consistency
- MISSED: Only proposes HTTP API gateway proxy

### SEED-ARCH-23 — Temporal Doesn't Depend on Kafka (T3)

Fixture states: Temporal uses its own Postgres-backed persistence. The unreliable Kafka cluster is irrelevant to Temporal's viability.
- CAUGHT: Correctly notes Temporal has independent persistence, doesn't penalize it for Kafka risk
- PARTIAL: Approves Temporal but still mentions Kafka concern
- MISSED: Rejects Temporal citing Kafka instability

### SEED-ARCH-24 — Postgres Connection Exhaustion at 12K Events/sec (T3)

Fixture states: "psycopg2 driver connection pools (default max 20 connections per ECS task). No external connection pooler." 12K events/sec direct writes will exhaust connections.
- CAUGHT: Identifies connection saturation risk, mandates pooling (PgBouncer/RDS Proxy) or batch-write strategy as architectural condition
- PARTIAL: Notes high load without specific connection exhaustion mechanism
- MISSED: Approves direct 12K/sec writes with no pooling/batching

---

## TIER 4 (Wicked Problems — expect 30-60%)

### SEED-ARCH-25 — No Single Candidate Fully Satisfies All Constraints (T4)

Throughput favors streaming, audit favors ES, team skill favors simple, migration safety favors incremental, exec mandates are contradictory. No single pattern from the 5 resolves everything cleanly.
- CAUGHT: Explicitly acknowledges unresolved gaps in the winner, OR proposes bounded hybrid, OR documents accepted risk against specific constraints
- PARTIAL: Selects winner but claims it handles everything without acknowledged gaps
- MISSED: Clean single-winner ADR with no gaps, risks, or unresolved tensions documented

### SEED-ARCH-26 — Don't Over-Block Event Sourcing Entirely (T4)

ES IS the domain-correct pattern for financial ledgers. Team skill gap is real but doesn't categorically block bounded application (append-only audit subset). Over-blocking based on "team weak" ignores domain fit.
- CAUGHT: Conditionally allows bounded ES for audit layer with team ramp conditions, OR places it as a documented Phase 3 evolution path with migration conditions
- PARTIAL: Rejects all ES but acknowledges domain fit
- MISSED: Hard blocks without nuance, no evolution path documented

### SEED-ARCH-27 — Don't Over-Block Due to "Zero Loss" Impossibility (T4)

CTO's literal zero-loss is impossible under partitions. But rejecting ALL candidates on this basis is over-blocking. Correct: reframe to practical durability (SQS buffer, reconciliation, defined RPO) and approve with conditions.
- CAUGHT: Reframes to practical durability guarantees AND approves a candidate with explicit conditions
- PARTIAL: Flags impossibility but doesn't propose approval path
- MISSED: Rejects all candidates OR claims one achieves literal zero-loss

### SEED-ARCH-28 — Dual-Write Without Reconciliation Is Fatal (Under-Blocking Trap) (T4)

Shadow mode with dual-write is mandatory. But dual-write WITHOUT automated reconciliation is a time bomb for financial data. Agent must mandate reconciliation as a hard gate.
- CAUGHT: Mandates automated reconciliation with divergence thresholds as condition for dual-write; blocks cutover without zero-divergence proof
- PARTIAL: Mentions reconciliation as advisory/nice-to-have
- MISSED: Approves dual-write with no reconciliation mechanism specified

### SEED-ARCH-29 — Ledger Ownership Must Be Unambiguous at Every Phase (T4)

Fixture: "During migration, both systems may issue credits unless architecture prevents it." If BOTH can mutate billing state, you get split-brain financial corruption.
- CAUGHT: Defines single write authority at every migration phase with explicit ownership transfer mechanism (feature flag, not deployment timing)
- PARTIAL: Mentions ownership but leaves gaps during transition
- MISSED: Approves architecture where both systems can mutate simultaneously

### SEED-ARCH-30 — Customer Cohort Rollout, Not All-or-Nothing (T4)

Fixture: customer segmentation (top 50 = 72% revenue, mixed billing models). All-customer simultaneous migration is high blast radius. Correct: cohort-based rollout with per-cohort validation.
- CAUGHT: Requires cohort/canary rollout citing customer segmentation data, with per-cohort reconciliation before expanding
- PARTIAL: Generic "phased rollout" without customer segmentation logic
- MISSED: All-customer simultaneous migration

### SEED-ARCH-31 — Actor Identity Must Propagate Through Migration Boundaries (T4)

SOC 2 requires actor traceability. Any routing/event layer introduced by strangler-fig must forward identity context. Otherwise audit logs show "system" instead of the actual actor.
- CAUGHT: Mandates identity propagation (JWT/correlation ID forwarding) through all migration-introduced boundaries as architectural requirement
- PARTIAL: Mentions traceability generically without connecting to migration layers
- MISSED: Approves strangler-fig without addressing identity propagation

### SEED-ARCH-32 — HIPAA Requires Infrastructure Validation, Not Just Code (T4)

HIPAA BAA compliance requires AWS-level setup: Business Associate Agreement, HIPAA-eligible service config, RDS audit logging at infra level. Not just application encryption.
- CAUGHT: Flags HIPAA as requiring infrastructure-level validation (BAA, HIPAA-eligible ECS/RDS config) not just code-level controls
- PARTIAL: Mentions "infrastructure security" generically
- MISSED: Treats HIPAA as purely a code/encryption concern

### SEED-ARCH-33 — Constitution Exception: Simplicity Gate vs Audit-Trigger Weakness (T4)

Fixture states: "PostgreSQL triggers do not fire on COPY/bulk-insert and can be disabled by superusers. Triggers have been bypassed twice during emergency patches." This is documented evidence that the SIMPLE approach (triggers) has a known failure mode for this specific compliance requirement. The correct answer MAY be a justified EXCEPTION to Simplicity Gate for the audit layer.
- CAUGHT: Evaluates trigger limitations against the documented bypass evidence, considers whether a more complex approach (append-only ledger, application-enforced audit) is justified as a constitution EXCEPTION with documented reasoning
- PARTIAL: Notes trigger limitations without framing as constitution exception or evaluating alternatives
- MISSED: Blindly applies Simplicity Gate without evaluating the documented trigger failure mode

### SEED-ARCH-34 — Evaluate Current State as Baseline (T4)

The 5 candidates assume extraction. The agent should establish WHY extraction is necessary by evaluating the current monolith state as a formal baseline — not to select it, but to quantify the improvement the migration delivers and validate the ROI.
- CAUGHT: Formally evaluates current state (as "Rejected" baseline) with specific scores showing where it fails, establishing the gap the migration must close
- PARTIAL: Mentions current-state problems narratively without formal evaluation
- MISSED: Only evaluates the 5 provided candidates, no baseline comparison

---

## Difficulty Distribution

| Tier | Seeds | Count | Expected Score |
|------|-------|-------|----------------|
| T1 | 10 | 1 | 90-100% |
| T2 | 01, 02, 04, 06, 08, 09, 12 | 7 | 85-100% |
| T3 | 03, 05, 07, 11, 14, 15-24 | 15 | 50-75% |
| T4 | 25-34 | 11 | 30-60% |

**Total: 34 seeds**

## Control Summary

| Type | Seeds | Count |
|------|-------|-------|
| Fatal (gated) | 01, 04 | 2 |
| Negative control | 02 | 1 |
| Standard | all others | 31 |
| Over-blocking traps | 26, 27 | 2 |
| Under-blocking traps | 28, 29 | 2 |

## Category Coverage

| Category | Seeds | Count |
|----------|-------|-------|
| A: Axis activation | 01, 02, 12 | 3 |
| B: Score calibration | 03, 05, 16, 17, 20, 21, 24 | 7 |
| C: Blocking / over/under-blocking | 04, 11, 25, 26, 27, 28, 29 | 7 |
| D: Adaptability / selection | 07, 15 | 2 |
| E: Confidence calibration | 06, 17 | 2 |
| F: Tradeoff credibility | 08, 33 | 2 |
| G: Migration safety | 09, 18, 19, 22, 28, 29, 30, 31 | 8 |
| H: Conditional skill / constitution | 10, 23, 32, 33, 34 | 5 |
