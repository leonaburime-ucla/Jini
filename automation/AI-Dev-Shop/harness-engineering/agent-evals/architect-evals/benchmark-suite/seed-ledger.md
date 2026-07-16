# Seed Ledger — Architect Benchmark Suite

## Included Evals

- `arch-eval-1-billing-ledger-migration` (brownfield B2B fintech ledger
  extraction — 33 seeds)

## Total Seeds

33 seeds in 1 scenario testing Software Architect judgment: scorecard and
evidence discipline, blocking and selection judgment, and migration safety
reasoning. Detailed CAUGHT/PARTIAL/MISSED scoring criteria live in the
per-eval `arch-eval-1-billing-ledger-migration/seed-ledger.md` (the oracle
hidden from the evaluated agent). This suite-level ledger carries the
structured staff+ depth fields required for benchmark auditability.

Historical note: the per-eval ledger and older docs reference "34 seeds";
SEED-ARCH-13 was removed during the post-canary audit, so the real count is
33. Seed IDs are stable and not renumbered.

## Suite-Level Controls

- Positive controls (fatal invariants): `SEED-ARCH-01`, `SEED-ARCH-04`
- Negative controls (false-positive restraint): `SEED-ARCH-02`,
  `SEED-ARCH-05`, `SEED-ARCH-21`, `SEED-ARCH-23`, `SEED-ARCH-26`
- Regression controls: `SEED-ARCH-28`, `SEED-ARCH-29` — the two
  under-blocking traps whose scoring criteria were tightened after the
  canary run + multi-model audit (see per-eval ledger v2 header). Re-anchor
  regression selection from run-results.tsv once the first benchmark_full
  run is retained.

---

## Staff+ Seed Entries

### SEED-ARCH-02

- production_trigger: An architect activates the tenant_isolation scorecard
  axis for a single-operator billing platform, driving an unnecessary
  cell-based isolation design that adds months of work with no requirement
  behind it.
- deceptive_cues: "2,400 enterprise customers" and a HIPAA roadmap read like
  multi-tenancy signals; the fixture explicitly frames customer data
  separation as a security concern, not an architectural multi-tenancy
  concern.
- required_concepts: multi-tenancy, trust-boundaries.
- causal_chain: Surface-level customer-count pattern matching activates an
  optional axis without an architectural trigger, which distorts candidate
  scoring and can flip the selected pattern.
- why_local_review_passes: Activating "one more axis" looks diligent; a
  reviewer skimming the scorecard sees extra rigor rather than a scoring
  distortion.
- acceptable_root_cause: Correctly skips tenant_isolation and handles
  customer data separation under the security axis, citing the fixture's
  explicit framing.
- unacceptable_shallow_answers: "Many customers means multi-tenant" or
  activating the axis "to be safe" without an architectural trigger.
- minimum_evidence_chain: Cite feature-spec.md's single-operator platform
  statement and the explicit "security concern, NOT multi-tenancy" language.
- domain_expert_note: Multi-customer is a data-scoping problem; multi-tenant
  is an architecture problem. Conflating them is a classic optional-axis
  false positive.

### SEED-ARCH-03

- production_trigger: An event-sourced ledger ships with a team that has
  never operated projections or replay; the first production incident takes
  days to debug and erodes billing trust.
- deceptive_cues: Event sourcing is the textbook-correct pattern for
  financial ledgers, and the pattern itself is mature and well documented.
- required_concepts: event-sourcing, observability-design.
- causal_chain: Scoring operability on pattern maturity instead of team
  operational experience hides the real incident-response risk, so the
  scorecard overstates the candidate.
- why_local_review_passes: A 4-5 operability score with "well-documented
  pattern" rationale reads as informed; the team-experience gap lives in a
  different fixture document.
- acceptable_root_cause: Operability scored 2-3 with the team's zero ES
  production experience and incident-rate risk cited from
  team-and-operations.md.
- unacceptable_shallow_answers: "Pattern is proven" (ignores who operates
  it) or a reflexive 1 (ignores that the pattern is mature).
- minimum_evidence_chain: Cite team-and-operations.md experience inventory
  and the constitution's operability scoring guidance.
- domain_expert_note: Operability is a property of pattern-plus-team, never
  of the pattern alone.

### SEED-ARCH-04

- production_trigger: A 5-FTE team adopts a 4-service microservice split,
  then spends its entire capacity on distributed debugging, deployment
  orchestration, and cross-service saga failures instead of features.
- deceptive_cues: Microservices are presented as a first-class candidate
  with genuine benefits (independent scaling, clear ownership seams).
- required_concepts: distributed-state, modularity.
- causal_chain: Without a blocking rule keyed on team capacity, the
  scorecard averages away a fatal axis: a critical-axis-1 candidate survives
  into consideration and can win on other strengths.
- why_local_review_passes: The candidate's pros are real; only synthesis of
  team size, missing saga experience, and 33% platform-engineer availability
  reveals the fatal floor.
- acceptable_root_cause: Candidate rejected via blocking rule with
  operability or cognitive_load at 1-2 for THIS team, or an explicit
  Weak-fit/Rejected band citing team capacity.
- unacceptable_shallow_answers: Scoring it viable-but-low, or rejecting on
  generic "microservices are complex" without the team-capacity evidence.
- minimum_evidence_chain: Cite team-and-operations.md FTE count and
  experience, constraints-and-nfrs.md delivery constraints.
- domain_expert_note: Blocking rules exist so a single fatal axis cannot be
  averaged away by strengths elsewhere.

### SEED-ARCH-05

- production_trigger: An architect reflexively rejects the modular-monolith
  candidate as "not a real architecture," and the ADR loses the credibility
  needed to defend the selected extraction against simpler alternatives.
- deceptive_cues: The eval context is a migration AWAY from a monolith, so
  dismissing the monolith-shaped candidate feels aligned with the mission.
- required_concepts: modularity, migration-strategy.
- causal_chain: Anti-monolith bias produces a strawman evaluation; the
  runner-up comparison becomes fake, and the real reason for rejection (the
  spec's independent-deployment requirement) never gets recorded.
- why_local_review_passes: Rejecting a monolith during a monolith-exit
  project looks obviously right; nobody asks whether the rejection grounds
  are the spec or the bias.
- acceptable_root_cause: Candidate D evaluated with genuine strengths (team
  stack fit, Simplicity Gate pass, lowest risk) and rejected specifically on
  the spec's standalone-service requirement.
- unacceptable_shallow_answers: "Monolith = legacy" or a Rejected band with
  no acknowledged strengths.
- minimum_evidence_chain: Cite pattern-candidates.md candidate D strengths
  and the feature-spec.md independent-deployment requirement.
- domain_expert_note: The strongest ADRs reject candidates for stated
  requirements, not for pattern fashion; this is a false-positive restraint
  probe.

### SEED-ARCH-06

- production_trigger: An ADR marks most scorecard axes "assumed" despite 8
  months of production load data and 340 tests, so downstream teams re-run
  discovery work that already exists and distrust the scorecard.
- deceptive_cues: Marking axes "assumed" feels epistemically humble and
  safe; using existing evidence requires cross-referencing the blueprint.
- required_concepts: load-testing, observability-design.
- causal_chain: Ignoring documented evidence degrades confidence labels,
  which weakens prioritization of mitigations and validation gates across
  every downstream decision.
- why_local_review_passes: Conservative confidence labels never look wrong
  in isolation; the error is only visible against the fixture's evidence
  inventory.
- acceptable_root_cause: prior_art/measured confidence on axes where the
  12K events/sec load history, test suite, and postmortems apply, with at
  most a couple of core axes left assumed.
- unacceptable_shallow_answers: Blanket "assumed" labels, or blanket
  "measured" without tying each label to a specific evidence source.
- minimum_evidence_chain: Cite system-blueprint.md load data, test counts,
  and postmortem inventory per confidence label.
- domain_expert_note: Confidence calibration failures in both directions are
  judgment failures; humility that discards evidence is still
  miscalibration.

### SEED-ARCH-07

- production_trigger: An architect picks a lower-fit-band candidate because
  it scores higher on adaptability, and the org inherits an architecture
  that satisfies the tiebreaker but not the drivers.
- deceptive_cues: "Adaptability First" is a named constitution principle and
  sounds like a trump card; the fixture engineers a cross-band comparison to
  bait exactly that misreading.
- required_concepts: modularity, api-evolution.
- causal_chain: Applying a same-band tiebreaker across bands inverts the
  selection hierarchy — the tiebreaker overrides the primary ranking it was
  meant to break ties within.
- why_local_review_passes: The ADR cites a real constitution principle by
  name; principle-citing prose reads as compliance unless the reviewer
  checks the rule's scope condition.
- acceptable_root_cause: Explicit statement that adaptability breaks ties
  only within the same fit band, with the higher-band candidate winning when
  bands differ.
- unacceptable_shallow_answers: Selecting the right winner without citing
  the scope rule (that is PARTIAL), or any cross-band adaptability override.
- minimum_evidence_chain: Cite the constitution's Adaptability First scope
  clause and both candidates' fit bands from pattern-candidates.md.
- domain_expert_note: Most governance-rule failures are scope failures —
  the rule is real but applied outside its domain.

### SEED-ARCH-08

- production_trigger: An ADR ships with a winner that has "no real
  weaknesses," and six months later the unacknowledged sacrifice (scaling
  ceiling) surfaces as an unbudgeted replatforming demand.
- deceptive_cues: Scorecards invite advocacy; once a winner is chosen it is
  natural to round its weaknesses up and present a clean story.
- required_concepts: modularity, capacity-planning.
- causal_chain: A tradeoff section without a genuine sacrifice removes the
  early-warning register — nobody monitors the dimension the winner is
  actually worse at, so its failure arrives unplanned.
- why_local_review_passes: Confident, weakness-free ADRs read as strong
  work; the missing content is an absence, not an error on the page.
- acceptable_root_cause: A named, concrete sacrifice the winner makes
  versus the runner-up (e.g., trading replay capability for operational
  simplicity), consistent with the scorecard numbers.
- unacceptable_shallow_answers: "We trade complexity for simplicity" or any
  tension not anchored to a scorecard dimension where the winner scores
  lower.
- minimum_evidence_chain: Cite the winner's weakest scorecard axes and the
  runner-up's corresponding strengths from the Pattern Evaluation table.
- domain_expert_note: A credible ADR tells you what you gave up; an
  advocacy document tells you only what you won.

### SEED-ARCH-09

- production_trigger: A ledger extraction ships with a target architecture
  but no migration path; cutover is improvised, reconciliation is manual,
  and the first divergence is discovered by a customer invoice dispute.
- deceptive_cues: The pattern-selection work feels like the deliverable;
  migration mechanics feel like implementation detail for later.
- required_concepts: migration-strategy, replication.
- causal_chain: Without shadow mode, reconciliation criteria, rollback
  mechanism, split-brain prevention, and cutover criteria decided at
  ADR-time, each becomes an ad-hoc runtime decision made under incident
  pressure.
- why_local_review_passes: A thorough target-architecture ADR looks
  complete; the absent migration plan is invisible unless the reviewer
  checks for it as a required section.
- acceptable_root_cause: All five elements addressed with specifics: shadow/
  dual-write plan, reconciliation with divergence criteria, rollback
  mechanism, single-writer guarantee, and measurable cutover criteria.
- unacceptable_shallow_answers: "Migrate incrementally" or "use
  strangler-fig" without the five concrete mechanisms.
- minimum_evidence_chain: Cite system-blueprint.md current-state coupling
  and team-and-operations.md operational constraints in the migration plan.
- domain_expert_note: For brownfield financial systems the migration path
  IS the architecture decision; the target is the easy half.

### SEED-ARCH-11

- production_trigger: The CFO's "exactly-once, not at-least-once with dedup"
  mandate and the CTO's "zero loss under partitions" mandate are both
  encoded literally into acceptance criteria, and delivery stalls because no
  system can satisfy the conjunction.
- deceptive_cues: Both mandates come from named executives and sound like
  hard requirements; the contradiction only appears when the architect knows
  the distributed-systems impossibility underneath.
- required_concepts: message-queues, ordering-guarantees,
  distributed-consensus.
- causal_chain: Treating impossible literal constraints as satisfiable
  produces an ADR that promises what physics forbids; the gap surfaces later
  as a trust collapse rather than a design conversation.
- why_local_review_passes: An ADR claiming "our design achieves exactly-once
  delivery" matches the stakeholder's words exactly — literal compliance
  reads as success.
- acceptable_root_cause: Reframe to effectively-exactly-once via idempotent
  processing (satisfying the CFO's business intent), explicitly flag the
  literal contradiction, and name who must align the stakeholders.
- unacceptable_shallow_answers: Claiming literal satisfaction of both;
  rejecting all candidates as impossible; reframing silently without
  flagging the conflict.
- minimum_evidence_chain: Cite both executive constraints in
  constraints-and-nfrs.md and the idempotency mechanism that delivers the
  business-equivalent guarantee.
- domain_expert_note: Staff+ architects translate impossible words into
  possible intent — and say out loud that they did so.

### SEED-ARCH-12

- production_trigger: A healthcare customer lands in Q4 and the platform
  needs HIPAA-grade isolation in four months, but the just-approved
  architecture was designed as if HIPAA did not exist and needs rework at
  the foundation layer.
- deceptive_cues: HIPAA is a roadmap item, not a current requirement, so
  both ignoring it entirely and blocking on it entirely feel defensible.
- required_concepts: multi-tenancy, trust-boundaries.
- causal_chain: Ignoring the near-term roadmap bakes in seams that are
  expensive to retrofit; over-blocking on it delays the current business
  need — the correct posture is conditions with a timeline gate.
- why_local_review_passes: "HIPAA is out of scope for this feature" is
  technically true today and reads as good scoping discipline.
- acceptable_root_cause: Approve the current architecture WITH explicit
  HIPAA-readiness conditions: data classification boundaries, environment
  isolation seams by a named week, BAA validation checkpoints.
- unacceptable_shallow_answers: HIPAA relegated to a re-evaluation triggers
  bullet with no influence on current boundaries, or a block pending full
  HIPAA design.
- minimum_evidence_chain: Cite the constraints-and-nfrs.md Q4 2026
  healthcare roadmap line and the specific boundary decisions it conditions.
- domain_expert_note: Approve-with-conditions is the professional middle
  path between scope discipline and roadmap blindness.

### SEED-ARCH-14

- production_trigger: The shared Kafka cluster takes its fourth outage of
  the year and billing events are lost or delayed for hours because the new
  architecture assumed reliable delivery.
- deceptive_cues: Kafka is the org's standard event backbone and the
  candidate architectures all integrate with it by default; the outage
  history sits in an operations document, not the pattern candidates.
- required_concepts: message-queues, backpressure.
- causal_chain: Scoring reliability against Kafka's brand rather than the
  fixture's documented 3-outages-in-6-months history overstates the
  architecture's real availability; no durable buffer gets mandated and
  outages become data-loss events.
- why_local_review_passes: Depending on the platform's standard event bus is
  normal practice; the ADR looks conventional, not risky.
- acceptable_root_cause: Reliability score lowered for Kafka-dependent
  paths OR a durable buffer (SQS, local persistent queue) mandated OR the
  metering team's proven workaround adopted; no-Kafka designs legitimately
  skip the penalty.
- unacceptable_shallow_answers: "Kafka is battle-tested"; mentioning the
  outages without a scoring or mitigation consequence.
- minimum_evidence_chain: Cite team-and-operations.md outage history and
  no-SLA status, and the chosen buffering/mitigation mechanism.
- domain_expert_note: Reliability scores belong to YOUR instance of the
  dependency, not to the technology's reputation.

### SEED-ARCH-15

- production_trigger: A team hard-blocks all event sourcing on team-skill
  grounds and then rebuilds mutable-row audit logging that fails its SOC 2
  audit — while the domain-correct bounded alternative (append-only audit
  ledger) was never evaluated.
- deceptive_cues: Event sourcing arrives framed as a monolithic candidate
  (full ES+CQRS platform), inviting all-or-nothing acceptance or rejection.
- required_concepts: event-sourcing, data-modeling, modularity.
- causal_chain: All-or-nothing pattern framing hides the hybrid option;
  rejecting the platform variant silently discards the bounded subset that
  the audit-bypass history actually justifies.
- why_local_review_passes: "ES rejected due to team experience" is a
  reasonable-sounding verdict; the unexplored middle ground is invisible in
  a binary evaluation.
- acceptable_root_cause: Bounded ES acknowledged as viable — append-only
  audit ledger for the financial core with standard CRUD elsewhere —
  distinct from the full ES+CQRS candidate.
- unacceptable_shallow_answers: "Maybe ES for audit someday" without
  architectural bounds; hard-blocking all ES; approving the full platform.
- minimum_evidence_chain: Cite the trigger-bypass incidents in the fixture
  and the pattern-candidates.md framing being deliberately widened.
- domain_expert_note: Patterns are composable at bounded-context
  granularity; evaluating them only at platform granularity is a category
  error.

### SEED-ARCH-16

- production_trigger: During the dual-write phase the team is
  simultaneously operating shadow comparison tooling, divergence dashboards,
  and two write paths — and the on-call rotation breaks under load nobody
  scored.
- deceptive_cues: The target service uses the team's known stack, so
  steady-state operability genuinely is 4-5; the transition period is where
  the burden hides.
- required_concepts: migration-strategy, observability-design.
- causal_chain: Scoring operability at the steady-state value ignores the
  migration window, understating the staffing and tooling the transition
  requires; the gap materializes as on-call overload mid-migration.
- why_local_review_passes: "Team knows Python/Django, operability 5" is
  locally true; only lifecycle thinking exposes the transition-phase cost.
- acceptable_root_cause: Operability scored 3 for the migration phase with
  the dual-write monitoring, reconciliation tooling, and new-consumer
  debugging burden named as the reason.
- unacceptable_shallow_answers: Steady-state-only scoring with a "migration
  will be busy" caveat.
- minimum_evidence_chain: Cite team-and-operations.md on-call structure and
  the migration mechanics in the proposed design.
- domain_expert_note: Score the architecture across its lifecycle phases;
  the transition period is part of the architecture, not an implementation
  detail.

### SEED-ARCH-17

- production_trigger: The new ledger service goes live and misses its
  latency SLO at production volume because 12K events/sec was only ever
  measured on the OLD schema and access patterns.
- deceptive_cues: Real measured load data exists in the fixture — it is
  genuinely strong evidence, just for a different system than the one being
  scored.
- required_concepts: load-testing, capacity-planning, query-optimization.
- causal_chain: Transferring measured confidence across a schema and
  topology change overstates performance certainty; the load-test validation
  gate that would catch it never gets mandated.
- why_local_review_passes: Citing real production measurements looks like
  exemplary evidence use; the invalid transfer step is subtle.
- acceptable_root_cause: Performance scored 3 with analogical/assumed
  confidence and a load test on the new schema required as a validation
  gate before cutover.
- unacceptable_shallow_answers: Confident 4-5 citing existing measurements;
  or refusing to score at all.
- minimum_evidence_chain: Cite the system-blueprint.md load history AND
  identify what changed (schema, indexes, service boundary) that
  invalidates direct transfer.
- domain_expert_note: Evidence has a scope; measured-on-system-A is
  analogical-for-system-B, and the confidence label must downgrade
  accordingly.

### SEED-ARCH-18

- production_trigger: Timeline pressure shortens shadow mode to two weeks;
  a rounding divergence that only appears in month-end billing cycles ships
  to production and misbills customers.
- deceptive_cues: The migration is behind schedule in the fixture and
  shadow mode is the obvious thing to compress; "we'll monitor closely in
  prod" sounds like a mature compensating control.
- required_concepts: migration-strategy, invariant-preservation.
- causal_chain: The fixture's explicit constraint (zero divergence across 2
  full billing cycles) encodes the fact that billing bugs are
  cycle-periodic; abbreviating shadow mode removes the only window where
  cycle-boundary divergence is observable without customer impact.
- why_local_review_passes: A shortened-but-present shadow phase still reads
  as prudent engineering; the constraint violation hides behind apparent
  compliance.
- acceptable_root_cause: Full shadow mode with 2-billing-cycle zero-
  divergence proof required as a non-negotiable cutover gate.
- unacceptable_shallow_answers: "Shadow for a sprint then cut over with
  monitoring"; treating the 2-cycle constraint as a guideline.
- minimum_evidence_chain: Cite the constraints-and-nfrs.md 2-cycle shadow
  constraint verbatim and tie the cutover criteria to it.
- domain_expert_note: Billing correctness is periodic, not continuous —
  validation windows must cover the period, not just elapsed time.

### SEED-ARCH-19

- production_trigger: A botched cutover is "rolled back" by restoring the
  previous ledger state, destroying posted journal entries — and the SOC 2
  audit later fails because the financial history has a hole.
- deceptive_cues: Rollback-via-revert is the universal deployment reflex;
  every playbook the agent has seen rolls back state.
- required_concepts: event-sourcing, invariant-preservation, data-modeling.
- causal_chain: Applying code-rollback semantics to an append-only
  financial domain destroys the audit invariant; the correct mechanism
  (compensating journal entries) preserves history while reversing effect.
- why_local_review_passes: "Rollback plan: restore previous state" is a
  standard, professional-sounding migration section; the domain violation is
  invisible without ledger-accounting knowledge.
- acceptable_root_cause: Rollback strategy built on compensating entries
  that preserve the audit trail, with destructive state rollback explicitly
  called out as forbidden.
- unacceptable_shallow_answers: "Rollback is complex for financial data"
  without the compensating-entries mechanism; a standard revert plan.
- minimum_evidence_chain: Cite the fixture's "destructive state rollback
  violates audit trail integrity" constraint and the compensating-entry
  mechanism in the migration plan.
- domain_expert_note: In ledger domains you never un-write history; you
  write more history that nets to zero.

### SEED-ARCH-20

- production_trigger: Three years of raw usage events accumulate in the hot
  Postgres instance; storage costs balloon and vacuum/index maintenance
  degrades the operational tables that share the cluster.
- deceptive_cues: "Raw usage events must be retained for 3 years" reads as
  a hot-storage requirement if you stop before the parenthetical allowing
  cold storage after 90 days.
- required_concepts: capacity-planning, data-modeling.
- causal_chain: Missing the stated tiering boundary turns a retention
  requirement into an unbounded hot-storage design, which collapses at scale
  and forces an emergency archival project.
- why_local_review_passes: Keeping everything queryable in Postgres looks
  conservative and dispute-friendly; the cost curve is a slow failure, not a
  visible defect.
- acceptable_root_cause: Tiered storage — 90 days hot operational, cold
  archival (S3/Glacier-class) thereafter, with a documented retrieval path
  for billing disputes.
- unacceptable_shallow_answers: "Retain 3 years" with no tiering; tiering
  with no dispute-retrieval path.
- minimum_evidence_chain: Cite the constraints-and-nfrs.md retention clause
  including the 90-day cold-storage allowance.
- domain_expert_note: Retention requirements are compliance constraints;
  storage tiering is the architecture answer — conflating them wastes an
  order of magnitude in cost.

### SEED-ARCH-21

- production_trigger: An architect mandates a Go rewrite of the billing
  pipeline "because Python's GIL can't handle 12K events/sec," burning two
  quarters and violating the team-capability constraint — for an I/O-bound
  workload async Python handles fine.
- deceptive_cues: 12K events/sec sounds CPU-scale; the GIL is a famous
  bottleneck; recommending a "serious" language reads as performance rigor.
- required_concepts: io-patterns, async-execution, cpu-architecture.
- causal_chain: Misclassifying an I/O-bound workload as CPU-bound triggers
  an unnecessary platform change whose real cost (team capability violation,
  rewrite risk) far exceeds the imaginary GIL cost.
- why_local_review_passes: Performance conservatism rarely gets challenged;
  "we chose Go for throughput" sounds like diligence, not error.
- acceptable_root_cause: Workload identified as I/O-bound (DB writes),
  Python retained per team constraint, GIL explicitly noted as irrelevant to
  async I/O concurrency.
- unacceptable_shallow_answers: "Python might be slow here" left
  unresolved; any language change recommendation.
- minimum_evidence_chain: Cite the workload's I/O-bound nature from the
  processing description and team-and-operations.md's Python capability
  constraint.
- domain_expert_note: This is a false-positive restraint probe — the
  correct action is to NOT flag Python; throughput anxiety without workload
  analysis is noise.

### SEED-ARCH-22

- production_trigger: A strangler-fig migration routes traffic through an
  HTTP proxy while both systems' databases drift apart underneath, because
  routing was migrated but data consistency never was.
- deceptive_cues: HTTP-proxy strangler-fig is THE canonical migration
  pattern; applying it as documented looks like best practice.
- required_concepts: migration-strategy, message-queues, replication.
- causal_chain: For a financial ledger the consistency boundary, not the
  request path, is the dangerous seam; a routing-first migration leaves
  dual-write drift unmanaged exactly where correctness matters most.
- why_local_review_passes: The ADR matches the textbook strangler-fig
  diagram; pattern-conformance reads as correctness.
- acceptable_root_cause: Data-consistency-led migration mechanism (CDC,
  outbox, event publishing from the Django DB) as the primary strangler
  seam, with HTTP routing as secondary.
- unacceptable_shallow_answers: Proxy-only strangler plan; mentioning CDC
  as an optional alternative without elevating it for financial consistency.
- minimum_evidence_chain: Cite the ledger's consistency requirements and
  the specific data-driven mechanism chosen over routing-first.
- domain_expert_note: Choose the strangler seam where the risk lives — for
  money that is the data layer, not the request layer.

### SEED-ARCH-23

- production_trigger: Temporal is struck from the candidate list "because
  our Kafka cluster is unreliable," discarding the strongest orchestration
  candidate over a dependency it does not have.
- deceptive_cues: The fixture prominently documents Kafka instability, and
  event-driven tools cluster together in architects' minds; penalizing
  everything event-shaped feels consistent.
- required_concepts: message-queues, database-internals.
- causal_chain: An unverified dependency assumption (Temporal ≈ Kafka
  consumer) propagates the Kafka risk discount to a candidate with
  independent Postgres-backed persistence, distorting the selection.
- why_local_review_passes: Applying a documented risk consistently across
  candidates looks like rigor; the error is in the dependency graph, not the
  risk itself.
- acceptable_root_cause: Temporal's independent persistence correctly
  identified; no Kafka penalty applied to it.
- unacceptable_shallow_answers: "All event-driven components share the
  Kafka risk"; approving Temporal while still carrying an unexplained Kafka
  caveat against it.
- minimum_evidence_chain: Cite the fixture's statement of Temporal's
  Postgres-backed persistence.
- domain_expert_note: False-positive restraint probe — verify the actual
  dependency edge before propagating a risk along it.

### SEED-ARCH-24

- production_trigger: At production load the new service exhausts its
  connection budget (default pool of 20 per ECS task, no external pooler)
  and the ledger write path collapses under connection churn.
- deceptive_cues: Connection pooling is plumbing that ADRs habitually leave
  to implementation; 12K events/sec is stated as an achievement, not a
  threat.
- required_concepts: database-internals, capacity-planning, io-patterns.
- causal_chain: Direct per-event writes at stated throughput times pool
  limits times task count crosses Postgres's connection ceiling — a
  threshold collapse invisible until the arithmetic is done.
- why_local_review_passes: No single component is misdesigned; the failure
  emerges from multiplying three documented numbers nobody multiplies.
- acceptable_root_cause: Connection saturation identified with pooling
  (PgBouncer/RDS Proxy) or batch-write strategy mandated as an architectural
  condition.
- unacceptable_shallow_answers: "High load, ensure performance testing"
  without the connection-arithmetic mechanism.
- minimum_evidence_chain: Cite system-blueprint.md's psycopg2 pool default,
  no-pooler statement, and the 12K events/sec figure together.
- domain_expert_note: Threshold collapses live in the product of documented
  constants; staff+ review means doing the multiplication.

### SEED-ARCH-25

- production_trigger: An ADR presents a clean single winner for a problem
  whose constraints genuinely conflict, and each stakeholder later
  discovers their non-negotiable was silently traded away.
- deceptive_cues: The ADR format itself rewards a decisive winner; admitting
  unresolved gaps feels like weakness or incomplete work.
- required_concepts: capacity-planning, modularity, distributed-state.
- causal_chain: Throughput favors streaming, audit favors ES, team skill
  favors simple, migration safety favors incremental, and the exec mandates
  contradict — forcing a clean winner erases real residual risk from the
  decision record.
- why_local_review_passes: Decisive, gap-free ADRs read as senior work;
  the wickedness of the constraint set is distributed across five documents.
- acceptable_root_cause: Explicit unresolved-gap acknowledgment in the
  winner, OR a bounded hybrid, OR documented accepted risk against named
  constraints.
- unacceptable_shallow_answers: A winner that "handles everything"; vague
  risk sections not tied to the specific losing constraints.
- minimum_evidence_chain: Cite at least two concretely conflicting fixture
  constraints and show where the winner concedes one of them.
- domain_expert_note: Distinguished-level judgment is knowing when the
  honest answer is a documented compromise, not a victory.

### SEED-ARCH-26

- production_trigger: Event sourcing is hard-blocked "because the team lacks
  experience," and the platform later rebuilds audit history functionality
  at triple cost because no evolution path was ever recorded.
- deceptive_cues: SEED-ARCH-04 style team-capacity blocking is correct
  elsewhere in this fixture, tempting a consistent-looking blanket
  application of the same rule to ES.
- required_concepts: event-sourcing, migration-strategy.
- causal_chain: Over-generalizing a valid blocking rule from platform
  candidates to a bounded pattern subset forecloses the domain-correct audit
  design without evaluating conditions that would make it safe.
- why_local_review_passes: The block cites a real fixture fact (team gap)
  and mirrors correct blocking elsewhere; over-blocking looks identical to
  discipline at a glance.
- acceptable_root_cause: Bounded ES conditionally allowed for the audit
  layer with team ramp conditions, or documented as a Phase 3 evolution path
  with migration conditions.
- unacceptable_shallow_answers: Hard block with no evolution path;
  unconditional approval of full ES to avoid over-blocking.
- minimum_evidence_chain: Cite both the team gap AND the audit-bypass
  incidents, showing the tension was weighed rather than one side ignored.
- domain_expert_note: Restraint probe — the failure mode being tested is
  over-blocking; blocking rules need scope discipline just like tiebreakers.

### SEED-ARCH-27

- production_trigger: The CTO's literal "zero loss under partitions" is
  treated as a gate, every candidate fails it, and the migration stalls in
  analysis paralysis while the legacy system keeps losing events.
- deceptive_cues: Taking executive constraints literally feels like respect;
  declaring them all unsatisfiable feels like rigor.
- required_concepts: message-queues, replication, distributed-consensus.
- causal_chain: An impossible literal constraint applied as a pass/fail
  gate rejects every real design; the org gets zero improvement in exchange
  for theoretical purity.
- why_local_review_passes: "No candidate meets the zero-loss requirement"
  is technically true and reads as honest analysis rather than
  over-blocking.
- acceptable_root_cause: Reframe to practical durability (SQS buffering,
  reconciliation, defined RPO) AND approve a candidate with those explicit
  conditions.
- unacceptable_shallow_answers: Rejecting all candidates; claiming a
  candidate achieves literal zero loss; flagging impossibility without an
  approval path.
- minimum_evidence_chain: Cite the CTO constraint, state the partition
  impossibility, and show the conditioned approval with a defined RPO.
- domain_expert_note: The architect's job under impossible constraints is
  to ship the closest possible guarantee with the gap made visible — not to
  ship nothing.

### SEED-ARCH-28

- production_trigger: Dual-write runs for six weeks with no automated
  reconciliation; a silent divergence compounds daily, and by discovery the
  two ledgers disagree beyond manual repair.
- deceptive_cues: The ADR already mandates shadow mode and dual-write —
  the plan LOOKS safety-complete; reconciliation feels like an operational
  detail someone will handle.
- required_concepts: replication, invariant-preservation,
  migration-strategy.
- causal_chain: Dual-write doubles write paths and therefore divergence
  opportunities; without automated comparison and divergence thresholds the
  safety mechanism becomes the corruption vector.
- why_local_review_passes: Shadow mode language pattern-matches to safety;
  reviewers rarely ask HOW divergence would be detected day-to-day.
- acceptable_root_cause: Automated reconciliation with divergence
  thresholds mandated as a hard condition of dual-write, and cutover blocked
  without zero-divergence proof.
- unacceptable_shallow_answers: Reconciliation as advisory/nice-to-have;
  "we will monitor both systems."
- minimum_evidence_chain: Cite the dual-write mechanism and the specific
  automated reconciliation gate attached to it.
- domain_expert_note: Regression control — this under-blocking trap had its
  scoring criteria tightened after the canary run; unverified dual-write is
  a time bomb, not a safety net.

### SEED-ARCH-29

- production_trigger: During phase 2 of the migration both the Django app
  and the new service issue customer credits for the same dispute; the
  double-credit is discovered in month-end close as unexplained revenue
  leakage.
- deceptive_cues: The migration plan sequences deployments carefully, and
  deployment ordering feels like it settles who writes; the fixture warns
  both systems may issue credits unless architecture prevents it.
- required_concepts: distributed-state, state-machines, migration-strategy.
- causal_chain: Without a single explicit write authority per phase and an
  ownership transfer mechanism, overlapping write windows during transitions
  produce split-brain mutations of financial state.
- why_local_review_passes: A phased plan with deployment ordering reads as
  controlled; the gap is that timing-based ownership is not enforced
  ownership.
- acceptable_root_cause: Single write authority defined at every migration
  phase with an explicit transfer mechanism (feature flag or equivalent
  enforced switch, not deployment timing).
- unacceptable_shallow_answers: "Phase 1 Django writes, phase 2 service
  writes" with no enforcement mechanism at the boundary.
- minimum_evidence_chain: Cite the fixture's dual-credit warning and the
  enforced ownership mechanism per phase.
- domain_expert_note: Regression control (canary-tightened) — write
  ownership must be a mechanism, never a schedule.

### SEED-ARCH-30

- production_trigger: All 2,400 customers cut over the same weekend; a
  proration bug in one billing model corrupts invoices across the entire
  base including the top 50 accounts that carry 72% of revenue.
- deceptive_cues: A single cutover is simpler to plan, and the shadow-mode
  gate already passed — global rollout feels earned.
- required_concepts: migration-strategy, capacity-planning.
- causal_chain: Ignoring documented customer segmentation concentrates
  blast radius; heterogeneous billing models mean shadow validation on
  aggregate traffic can still miss cohort-specific paths.
- why_local_review_passes: "Shadow mode proved parity, so we cut over"
  is a plausible narrative; the missing insight is that parity proof is
  cohort-dependent.
- acceptable_root_cause: Cohort/canary rollout citing the segmentation data,
  with per-cohort reconciliation gates before expansion and revenue-critical
  accounts sequenced deliberately.
- unacceptable_shallow_answers: Generic "phased rollout" without cohort
  logic; big-bang cutover with a rollback promise.
- minimum_evidence_chain: Cite the feature-spec.md segmentation (top 50 =
  72% revenue, mixed billing models) in the rollout design.
- domain_expert_note: Rollout design is risk allocation across the customer
  base; segmentation data is the input, not trivia.

### SEED-ARCH-31

- production_trigger: After migration, audit logs attribute every billing
  mutation to "system" because the strangler routing layer dropped actor
  identity — discovered during the SOC 2 audit, when it is unfixable
  retroactively.
- deceptive_cues: Every migration-introduced hop (proxy, event bus, service
  boundary) handles requests correctly; identity propagation fails silently
  while functionality works.
- required_concepts: trust-boundaries, authn-protocols,
  observability-design.
- causal_chain: Each new boundary defaults to service-to-service identity;
  without an explicit propagation requirement the actor context is lost at
  the first hop and every downstream audit record inherits the loss.
- why_local_review_passes: Functional tests pass — requests route, events
  flow; audit attribution is only visible if someone inspects WHO the logs
  say acted.
- acceptable_root_cause: Identity propagation (JWT/correlation-ID
  forwarding) mandated through all migration-introduced boundaries as an
  architectural requirement tied to SOC 2 traceability.
- unacceptable_shallow_answers: Generic "maintain audit logging" without
  connecting traceability to the NEW boundaries the migration introduces.
- minimum_evidence_chain: Cite the SOC 2 actor-traceability constraint and
  enumerate the migration-introduced boundaries that must forward identity.
- domain_expert_note: Migrations silently break cross-cutting invariants;
  the ones that fail loudest in audits fail quietest in tests.

### SEED-ARCH-32

- production_trigger: The HIPAA readiness plan ships as application-level
  encryption and access controls; the BAA review then fails because the
  AWS services themselves were never configured as HIPAA-eligible with
  infra-level audit logging.
- deceptive_cues: Code-level controls are the architect's home turf and
  look substantial; infrastructure eligibility feels like an ops checklist
  for later.
- required_concepts: trust-boundaries, secrets-management.
- causal_chain: HIPAA compliance is a property of the infrastructure
  configuration (BAA, eligible services, RDS-level audit logging) composed
  with application controls; designing only the application half leaves the
  compliance claim unfoundable.
- why_local_review_passes: An ADR section full of encryption and RBAC
  detail reads as compliance-serious; the infra dependency is a different
  layer most reviews do not cross into.
- acceptable_root_cause: HIPAA flagged as requiring infrastructure-level
  validation — BAA, HIPAA-eligible ECS/RDS configuration, infra audit
  logging — not just code-level controls.
- unacceptable_shallow_answers: "Encrypt PHI at rest and in transit" as the
  whole answer; generic "infrastructure security" hand-waving.
- minimum_evidence_chain: Cite the HIPAA roadmap constraint and name the
  infra-level validations distinct from application controls.
- domain_expert_note: Compliance frameworks bind the platform, not the
  codebase; architects who stop at the code boundary certify half a system.

### SEED-ARCH-33

- production_trigger: The audit layer ships on PostgreSQL triggers per the
  Simplicity Gate; a year later a bulk COPY backfill silently bypasses the
  triggers again and the compliance team discovers an unlogged mutation
  window — the same failure mode already documented twice.
- deceptive_cues: The constitution's Simplicity Gate genuinely favors
  triggers, and constitution compliance is usually the correct reflex; the
  bypass evidence sits in an incident-history paragraph, not the
  constraints.
- required_concepts: database-internals, invariant-preservation.
- causal_chain: Applying the Simplicity Gate without weighing the
  documented trigger-bypass incidents re-selects a mechanism with a proven
  failure mode for the exact requirement it must serve; the justified-
  exception path exists for precisely this case and goes unused.
- why_local_review_passes: Constitution-compliant choices look
  unimpeachable; challenging the gate requires connecting incident history
  to governance exception machinery.
- acceptable_root_cause: Trigger limitations evaluated against the bypass
  evidence, with a more robust mechanism (append-only ledger, application-
  enforced audit) considered as a documented constitution EXCEPTION.
- unacceptable_shallow_answers: Blind Simplicity Gate application; noting
  trigger limits without engaging the exception process.
- minimum_evidence_chain: Cite the COPY/superuser bypass statement, the two
  emergency-patch incidents, and the constitution's exception mechanism.
- domain_expert_note: Governance maturity is knowing when the rules
  themselves provide the escape hatch — and documenting why you used it.

### SEED-ARCH-34

- production_trigger: The extraction program runs for two quarters before an
  executive asks what it is actually buying; nobody can answer
  quantitatively because the current state was never formally scored, and
  funding wobbles.
- deceptive_cues: The five candidates all assume extraction, framing the
  decision as "which target," so evaluating the status quo feels out of
  scope.
- required_concepts: migration-strategy, capacity-planning.
- causal_chain: Without a scored current-state baseline the ADR cannot
  quantify the gap the migration closes; the decision rests on narrative
  dissatisfaction rather than measured deficiency, weakening both the
  selection logic and the program's defensibility.
- why_local_review_passes: Evaluating five candidates thoroughly looks
  complete; the missing sixth row (the baseline) is a structural absence.
- acceptable_root_cause: Current monolith state formally evaluated as a
  Rejected baseline with specific failing scores, establishing the
  improvement delta the migration must deliver.
- unacceptable_shallow_answers: Narrative complaints about the monolith
  without formal scoring; skipping the baseline because extraction is
  mandated.
- minimum_evidence_chain: Cite current-state deficiencies from
  system-blueprint.md as scored axes alongside the candidate scorecards.
- domain_expert_note: A migration ADR without a baseline is a destination
  without an origin — you cannot measure progress you never anchored.
