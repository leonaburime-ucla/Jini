# Seed Ledger — Code Review Benchmark Suite

## Included Evals

- `cr-eval-1-order-processor` (order/payment saga — 6 seeds)
- `cr-eval-2-notification-service` (notification failover/privacy — 6 seeds)
- `cr-eval-3-inventory-tracker` (distributed inventory allocation — 7 seeds)
- `cr-eval-4-authz-graph` (staff+ depth batch — 9 seeds)
- `cr-eval-5-retry-idempotency-queue` (staff+ depth batch — 9 seeds)
- `cr-eval-6-cache-migration-rollout` (staff+ depth batch — 9 seeds)
- `cr-eval-7-stream-watermark-checkpoint` (staff+ depth batch — 9 seeds)
- `cr-eval-8-webhook-signature-rotation` (staff+ depth batch — 9 seeds)
- `cr-eval-9-search-index-replica-projection` (staff+ depth batch — 9 seeds)
- `cr-eval-10-billing-usage-reconciliation` (Tier 2 hard-mode — 8 seeds)
- `cr-eval-11-regional-failover-control-plane` (Tier 3 hard-mode — 8 seeds)

## Total Seeds

91 seeds across 11 eval fixtures testing Code Review agent in isolation with
seeded code, fake Programmer handoffs, and suite-level controls.

Current status: **pilot / depth-roadmap**. This suite has fixture-backed
staff+ hardening and the 72+ seed target, but benchmark readiness still depends
on validator depth checks and completed benchmark-full run history.

## Current Backfill Rule

The suite-level TSV files in this directory are canonical but detailed seed
narratives still live in the per-eval `seed-ledger.md` files until a full
catalog backfill is completed.

## Suite-Level Negative Controls

- `SEED-CR-NC-01`: returning the prior receipt for a duplicate idempotency key
  in `cr-eval-1-order-processor/seed-state/src/order_processor.py` should not
  be misflagged as skipped payment work.
- `SEED-CR-NC-02`: an explicitly injected manual clock in
  `cr-eval-3-inventory-tracker/seed-state/src/inventory_tracker.py` should not
  be misflagged as hidden time state.
- `SEED-CR-NC-03`: explicit same-tenant break-glass access with expiry,
  reason, and audit metadata should not be misflagged as cross-tenant
  escalation.
- `SEED-CR-NC-04`: bounded traversal helper with max-depth and visited tracking
  should not be misflagged as the unbounded delegated-role graph traversal bug.
- `SEED-CR-NC-05`: bounded queue backpressure helper should not be misflagged
  as dropping messages.
- `SEED-CR-NC-06`: idempotent duplicate receipt return should not be misflagged
  as skipped delivery or lost work.
- `SEED-CR-NC-07`: schema-versioned cache keys should not be misflagged as
  redundant storage.
- `SEED-CR-NC-08`: explicit dual-write compatibility shim should not be
  misflagged as duplicate work.
- `SEED-CR-NC-09`: partition-local max watermark tracking should not be
  misflagged as the global max-watermark defect.
- `SEED-CR-NC-10`: beyond-window late-event routing with metadata should not be
  misflagged as data loss.
- `SEED-CR-NC-11`: constant-time HMAC comparison should not be misflagged as
  unnecessary cryptographic complexity.
- `SEED-CR-NC-12`: bounded dual-key grace verification should not be misflagged
  as indefinite legacy-secret acceptance.
- `SEED-CR-NC-13`: strict newer-version projection gating should not be
  misflagged as dropping legitimate same-version replays.
- `SEED-CR-NC-14`: tenant shard validation should not be misflagged as
  redundant with query-time filtering.
- `SEED-CR-NC-15`: credit reserve double-read under an explicit tenant lock
  should not be misflagged as a TOCTOU race.
- `SEED-CR-NC-16`: Decimal quantization in hourly billing aggregation should
  not be misflagged as unnecessary precision complexity.
- `SEED-CR-NC-17`: current-epoch fencing token validation should not be
  misflagged as too strict.
- `SEED-CR-NC-18`: bounded stale read-cache behavior without write authority
  should not be misflagged as unsafe activation.

## Unresolved Seeds

Previously unresolved seeds (SEED-CR-13 through SEED-CR-16 from
cr-eval-3-inventory-tracker) should be re-evaluated through
`prepare_eval_run.py` targeting that eval, not through a separate rerun suite.

## Staff+ Ledger Entries

### SEED-CR-01

- production_trigger: A payment worker crashes after gateway capture but before
  the local idempotency receipt is persisted, then retries the same order.
- deceptive_cues: The method accepts an idempotency key, the handoff says
  capture is idempotent, and happy-path tests only inspect one capture.
- required_concepts: state-machines, event-sourcing, ordering-guarantees.
- causal_chain: External payment capture occurs before durable local receipt
  recording, so retry has no local evidence that the irreversible side effect
  already happened.
- why_local_review_passes: The code visibly stores the key and returns a
  confirmed order, so line-by-line review can mistake post-side-effect storage
  for idempotency.
- acceptable_root_cause: The idempotency fence must be durable before capture,
  or the gateway capture and local receipt must share a transactional outbox
  boundary.
- unacceptable_shallow_answers: "Use an idempotency key" is shallow because
  the key already exists but is recorded too late.
- minimum_evidence_chain: Cite `OrderSaga.place_order`, the capture call,
  `idempotency_records`, and the handoff claim that payment capture is safe.
- domain_expert_note: Payment idempotency is about side-effect ordering, not
  only passing a key through an API.

### SEED-CR-03

- production_trigger: A slow payment provider returns success after the
  inventory reservation TTL has expired and the unit has been released to
  another checkout.
- deceptive_cues: Reservations are created before capture and both timeout and
  TTL fields look intentional.
- required_concepts: time-handling, state-machines, invariant-preservation.
- causal_chain: The reservation TTL is shorter than the capture timeout and
  callback path, but order confirmation never revalidates reservation liveness.
- why_local_review_passes: Happy-path placement runs within one call and never
  advances time past reservation expiry.
- acceptable_root_cause: Capture completion must be bounded by reservation TTL
  or revalidate/extend reservation before confirming the order.
- unacceptable_shallow_answers: "Check inventory first" misses that inventory
  is checked but not protected across asynchronous payment time.
- minimum_evidence_chain: Cite `InventoryGateway.reservation_ttl_seconds`,
  `OrderSaga.capture_timeout_seconds`, `place_order`, and AC-2.
- domain_expert_note: Saga correctness often fails at mismatched timeout
  horizons between services.

### SEED-CR-04

- production_trigger: A refunded order keeps a promotion credit marked applied,
  causing customer balance or campaign accounting drift after cancellation.
- deceptive_cues: Cancellation refunds payment and releases inventory, and the
  handoff says compensation covers every saga participant.
- required_concepts: event-sourcing, invariant-preservation,
  ordering-guarantees.
- causal_chain: `cancel_order` compensates payment and inventory but never
  reverses the promotion ledger side effect created during placement.
- why_local_review_passes: The two most visible external side effects are
  compensated, making the missing third ledger easy to overlook.
- acceptable_root_cause: Every side effect created by the saga needs a
  matching compensation step and failure state.
- unacceptable_shallow_answers: "Add a refund" is insufficient because the
  refund already exists and the missing participant is the promo ledger.
- minimum_evidence_chain: Cite `promo.apply_credit`, `cancel_order`, and the
  handoff compensation claim.
- domain_expert_note: Compensation review should enumerate participants, not
  inspect only the dominant payment path.

### SEED-CR-05

- production_trigger: A delayed `payment_captured` callback arrives after a
  refund and moves the order back to confirmed.
- deceptive_cues: The status handler is small, tests cover the two known
  gateway events, and the handoff says gateway events update state.
- required_concepts: state-machines, event-sourcing, ordering-guarantees.
- causal_chain: `apply_gateway_event` mutates state directly without checking
  terminal-state transition rules or event ordering.
- why_local_review_passes: Individual events map to plausible states, so local
  inspection misses replay after terminal transitions.
- acceptable_root_cause: Gateway events must be fenced by legal transition
  rules, terminal-state guards, and event ordering/idempotency evidence.
- unacceptable_shallow_answers: "Handle payment_refunded" misses that refunded
  is handled but can be overwritten.
- minimum_evidence_chain: Cite `apply_gateway_event`, the refunded state from
  `cancel_order`, and AC-4.
- domain_expert_note: Status machines must be reviewed as graphs, not as
  independent event-to-state assignments.

### SEED-CR-06

- production_trigger: Incident responders cannot connect a failed order to its
  payment intent, reservation, idempotency key, or compensation attempt.
- deceptive_cues: `SagaAudit.record` exists and every main path emits an event.
- required_concepts: observability-design, state-machines, trust-boundaries.
- causal_chain: Audit events record only event, order ID, and state, omitting
  the fields needed to reconstruct cross-service saga behavior.
- why_local_review_passes: Presence of audit calls satisfies a shallow logging
  checklist.
- acceptable_root_cause: Saga telemetry must include participant IDs, tenant,
  idempotency, reservation, and compensation identifiers.
- unacceptable_shallow_answers: "Add logging" without naming reconstruction
  fields is too vague.
- minimum_evidence_chain: Cite `SagaAudit.record`, `place_order`,
  `cancel_order`, and AC-6.
- domain_expert_note: For distributed sagas, observability is part of the
  correctness contract.

### SEED-CR-07

- production_trigger: Two tenants send the same notification ID to the same
  user handle and one tenant's send suppresses the other's delivery.
- deceptive_cues: The service has a named dedupe store and duplicate tests pass
  for a single tenant/channel.
- required_concepts: message-queues, multi-tenancy, caching-systems.
- causal_chain: `DedupeStore.key_for` omits tenant, channel, and provider
  attempt, collapsing distinct delivery domains into one key.
- why_local_review_passes: The key includes user and notification ID, which
  looks adequate in single-tenant fixtures.
- acceptable_root_cause: Dedupe keys must include every domain boundary that
  changes delivery semantics.
- unacceptable_shallow_answers: "Use a UUID" misses the missing scope
  dimensions.
- minimum_evidence_chain: Cite `DedupeStore.key_for`, `dispatch`, and the
  duplicate-send test's single-tenant scope.
- domain_expert_note: Dedupe is a distributed-state contract; omitted key
  dimensions are correctness bugs.

### SEED-CR-08

- production_trigger: Email provider times out after accepting a message, then
  SMS fallback delivers another copy to the same user.
- deceptive_cues: Failover is explicit, provider errors are handled, and tests
  prove hard-failure fallback.
- required_concepts: message-queues, error-propagation, backpressure.
- causal_chain: Timeout is treated like non-delivery even though
  `ProviderAdapter.send` may have created a late provider message, and fallback
  uses no shared idempotency fence.
- why_local_review_passes: Hard failures and timeouts both return
  `accepted=False`, so local control flow looks consistent.
- acceptable_root_cause: Retry/failover must distinguish unknown outcome from
  known failure and use provider-scoped idempotency or reconciliation.
- unacceptable_shallow_answers: "Retry fewer times" does not address the
  unknown-outcome duplicate window.
- minimum_evidence_chain: Cite `ProviderAdapter.send`, `NotificationDispatcher.dispatch`,
  and AC-2.
- domain_expert_note: In delivery systems, timeout usually means unknown
  outcome, not guaranteed failure.

### SEED-CR-09

- production_trigger: The service passes local tests but fails under tenant
  collisions, late provider success, fallback suppression, stale templates, or
  missing audit dimensions.
- deceptive_cues: Tests cover each named component once and the handoff lists
  coverage across send, fallback, suppression, dedupe, template, and audit.
- required_concepts: property-testing, contract-testing, test-isolation.
- causal_chain: The test suite proves happy paths and component existence but
  omits cross-boundary interactions where the planted defects live.
- why_local_review_passes: The tests are domain-specific and not obviously
  empty, so coverage looks credible without adversarial cases.
- acceptable_root_cause: Code Review must identify missing interaction tests
  for dedupe scope, unknown-outcome failover, privacy fallback, template cache
  boundaries, and audit evidence.
- unacceptable_shallow_answers: "Add more tests" without naming the omitted
  cross-boundary cases is too shallow.
- minimum_evidence_chain: Cite `tests/test_notification_service.py`,
  project AC-6, and the fake handoff coverage claim.
- domain_expert_note: Notification systems fail at provider/privacy/cache
  boundaries more often than at simple send success.

### SEED-CR-10

- production_trigger: A user unsubscribes from SMS for marketing, email fails,
  and fallback SMS still sends the campaign.
- deceptive_cues: Privacy suppression is checked before delivery and tests
  prove primary-channel suppression.
- required_concepts: trust-boundaries, multi-tenancy, message-queues.
- causal_chain: `dispatch` evaluates policy against the original notification
  channel before iterating fallback channels, so the actual SMS channel is never
  checked.
- why_local_review_passes: There is a visible `policy.is_suppressed` call and
  the suppression test passes.
- acceptable_root_cause: Suppression policy must be evaluated for each concrete
  channel/provider attempt before send.
- unacceptable_shallow_answers: "Add unsubscribe support" misses that support
  exists but is applied at the wrong boundary.
- minimum_evidence_chain: Cite `PrivacyPolicy.is_suppressed`,
  `NotificationDispatcher.dispatch`, the SMS fallback loop, and AC-3.
- domain_expert_note: Privacy review must follow the actual delivery channel,
  not the requested channel.

### SEED-CR-11

- production_trigger: A cached English non-sensitive template is reused for a
  later sensitive or localized notification with the same template ID.
- deceptive_cues: Rendered bodies include locale and version in simple tests,
  and the renderer has a visible cache.
- required_concepts: serialization, schema-evolution, api-evolution.
- causal_chain: `TemplateRenderer.cache` is keyed only by template ID, so tenant,
  locale, version, and privacy classification are ignored after first render.
- why_local_review_passes: First render output is correct, hiding subsequent
  cache-boundary violations.
- acceptable_root_cause: Template caches must include every field that changes
  rendered content or disclosure policy.
- unacceptable_shallow_answers: "Clear the cache" misses the missing key
  dimensions.
- minimum_evidence_chain: Cite `TemplateRenderer.render`, AC-4, and the single
  render test.
- domain_expert_note: Cache-key review is type-contract review across runtime
  content dimensions.

### SEED-CR-12

- production_trigger: Operations cannot determine which provider or fallback
  reason caused a duplicate or suppressed notification during an incident.
- deceptive_cues: Every final result records an audit event and tests assert
  that audit exists.
- required_concepts: observability-design, message-queues, multi-tenancy.
- causal_chain: `NotificationAudit.record` omits tenant, channel, provider,
  template version, dedupe key, fallback reason, and suppression reason.
- why_local_review_passes: Audit calls are present on sent, suppressed, failed,
  and duplicate outcomes.
- acceptable_root_cause: Delivery audit events must carry the dimensions needed
  to reconstruct provider and policy decisions.
- unacceptable_shallow_answers: "Log the notification" without required
  dimensions is insufficient.
- minimum_evidence_chain: Cite `NotificationAudit.record`, AC-5, and the audit
  test that checks only a minimal event.
- domain_expert_note: Observability depth is measured by incident questions
  answered, not event count.

### SEED-CR-13

- production_trigger: Two allocation workers reserve from the same stale
  published snapshot and both decrement the underlying warehouse stock.
- deceptive_cues: The tracker publishes a read model and reservation checks
  availability before decrementing.
- required_concepts: concurrency-primitives, thread-safety,
  invariant-preservation.
- causal_chain: `reserve` validates against `InventoryReadModel.available`
  rather than an atomic store-side compare/update, so stale snapshots can
  authorize overlapping reservations.
- why_local_review_passes: Single-thread tests publish once and reserve once,
  matching the visible happy path.
- acceptable_root_cause: Reservation must be guarded by an atomic allocation
  boundary or a versioned compare-and-swap against current stock.
- unacceptable_shallow_answers: "Check available stock" misses that the stale
  read model already performs a check.
- minimum_evidence_chain: Cite `publish_snapshot`, `InventoryReadModel.available`,
  `reserve`, and AC-1.
- domain_expert_note: Read models are for queries unless paired with a
  consistency mechanism for allocation.

### SEED-CR-14

- production_trigger: An oversell creates negative stock, reconciliation resets
  it to zero, and monitoring never sees the invariant violation.
- deceptive_cues: Reconciliation makes records non-negative and writes an audit
  event, satisfying a superficial invariant check.
- required_concepts: invariant-preservation, observability-design,
  error-propagation.
- causal_chain: `reconcile_non_negative` mutates negative availability to zero
  without emitting the original deficit or failing the reconciliation.
- why_local_review_passes: The postcondition `available >= 0` is true after the
  method runs.
- acceptable_root_cause: Reconciliation must surface and preserve evidence of
  negative-stock incidents before any normalization.
- unacceptable_shallow_answers: "Clamp to zero" is the defect, not the fix.
- minimum_evidence_chain: Cite `reconcile_non_negative`, AC-2, and the test
  that asserts only the clamped value.
- domain_expert_note: Reconciliation that hides invariant breaks destroys the
  evidence needed to fix allocation bugs.

### SEED-CR-15

- production_trigger: Destination warehouse lookup or write fails after the
  source warehouse has already been debited.
- deceptive_cues: Happy-path transfer preserves total stock and records an
  audit event.
- required_concepts: event-sourcing, state-machines, ordering-guarantees.
- causal_chain: `transfer` subtracts from source before destination credit and
  has no transaction, outbox, or compensation on failure.
- why_local_review_passes: The source and destination updates are adjacent and
  simple in the success case.
- acceptable_root_cause: Transfer must be atomic or compensating, with failure
  paths that restore source stock and report incomplete transfer state.
- unacceptable_shallow_answers: "Check source stock" misses the partial-failure
  window after that check.
- minimum_evidence_chain: Cite `InventoryTracker.transfer`, destination
  `store.get`, and AC-3.
- domain_expert_note: Multi-record inventory moves are sagas even when written
  as two local assignments.

### SEED-CR-16

- production_trigger: The tracker passes local tests but fails under concurrent
  reservation, stale snapshot, transfer partial failure, idempotency collision,
  or override audit identity.
- deceptive_cues: The tests cover all named public methods at least once and
  include an injected-clock case.
- required_concepts: property-testing, chaos-engineering, contract-testing.
- causal_chain: Tests prove happy-path behavior but omit adversarial
  interactions matching the acceptance criteria.
- why_local_review_passes: Method coverage looks broad and each test has
  domain-specific assertions.
- acceptable_root_cause: Code Review must request tests for concurrency,
  stale-read allocation, transfer compensation, idempotency-key dimensions, and
  audit identity.
- unacceptable_shallow_answers: "Increase coverage" without naming these
  missing interactions is too shallow.
- minimum_evidence_chain: Cite `tests/test_inventory_tracker.py`, AC-7, and
  the fake handoff coverage claim.
- domain_expert_note: Distributed inventory tests need adversarial state
  transitions, not only method happy paths.

### SEED-CR-17

- production_trigger: A worker or test uses default tracker construction and
  inherits tenant or clock state advanced by another instance.
- deceptive_cues: The tracker allows explicit dependency injection and tests
  use injected clocks.
- required_concepts: time-handling, test-isolation, multi-tenancy.
- causal_chain: `InventoryTracker.__init__` falls back to module-level
  `DEFAULT_CLOCK` and `CURRENT_TENANT`, creating shared mutable runtime context.
- why_local_review_passes: The explicit injection path is correct and visible,
  drawing attention away from default construction.
- acceptable_root_cause: Tenant and clock context must be required per instance
  or immutable/request-scoped.
- unacceptable_shallow_answers: "Inject a clock" is incomplete because the code
  already supports injection while unsafe defaults remain.
- minimum_evidence_chain: Cite `DEFAULT_CLOCK`, `CURRENT_TENANT`,
  `InventoryTracker.__init__`, and AC-6.
- domain_expert_note: Safe dependency injection requires safe defaults or no
  defaults for context-bearing dependencies.

### SEED-CR-18

- production_trigger: An admin approves an override and the audit trail loses
  the original user who requested the adjustment.
- deceptive_cues: The adjustment object carries `requested_by`, override actor
  is explicit, and an audit entry is written.
- required_concepts: observability-design, trust-boundaries, multi-tenancy.
- causal_chain: `apply_adjustment` writes `override_actor_id` into `actor_id`,
  replacing requester identity instead of recording both requester and approver.
- why_local_review_passes: The audit entry contains an actor, so shallow review
  treats identity logging as present.
- acceptable_root_cause: Override audit must preserve original requester and
  approving admin in distinct fields.
- unacceptable_shallow_answers: "Record an actor" misses the lost identity.
- minimum_evidence_chain: Cite `StockAdjustment.requested_by`,
  `apply_adjustment`, audit `actor_id`, and AC-5.
- domain_expert_note: Security audit fields need role semantics, not just a
  single user ID.

### SEED-CR-19

- production_trigger: A partner reuses an adjustment ID for different warehouse
  corrections or reason codes, and one legitimate adjustment is skipped.
- deceptive_cues: Idempotency exists and tests do not exercise cross-warehouse
  or cross-reason collisions.
- required_concepts: event-sourcing, distributed-state, invariant-preservation.
- causal_chain: `adjustment_key` omits warehouse and reason code, collapsing
  separate business events into one dedupe entry.
- why_local_review_passes: The key includes tenant, adjustment ID, and SKU,
  which looks plausible for simple partner messages.
- acceptable_root_cause: Idempotency keys must include all fields that define a
  unique adjustment effect.
- unacceptable_shallow_answers: "Use idempotency" misses that the idempotency
  key is underspecified.
- minimum_evidence_chain: Cite `adjustment_key`, `apply_adjustment`, AC-4, and
  missing collision tests.
- domain_expert_note: Idempotency key design is part of the domain model, not a
  generic dedupe helper.

### SEED-CR-NC-01

- production_trigger: A duplicate payment retry returns the already recorded
  receipt instead of invoking the gateway again.
- deceptive_cues: A shallow reviewer may confuse duplicate-result return with
  skipped business work.
- required_concepts: state-machines, ordering-guarantees,
  invariant-preservation.
- causal_chain: `IdempotentReceiptStore.complete_once` is a correct
  idempotency helper because duplicates reuse the original completed receipt.
- why_local_review_passes: The helper intentionally avoids a second factory
  call after the first receipt is recorded.
- acceptable_root_cause: Correct review should recognize this as valid
  duplicate suppression, not a defect.
- unacceptable_shallow_answers: "Always call the payment factory" would create
  the duplicate side effect the helper prevents.
- minimum_evidence_chain: Cite `IdempotentReceiptStore.complete_once` and
  `test_idempotent_receipt_store_returns_prior`.
- domain_expert_note: Idempotent replay often returns prior success, which is
  distinct from dropping work before success.

### SEED-CR-NC-02

- production_trigger: A test injects a manual clock and expects deterministic
  reservation expiry and audit timestamps.
- deceptive_cues: The fixture also has unsafe default time state elsewhere, so
  reviewers may overgeneralize and flag the injected path.
- required_concepts: time-handling, test-isolation, dependency-management.
- causal_chain: Passing `ManualClock` into `InventoryTracker` creates
  instance-local deterministic time for that tracker.
- why_local_review_passes: The injected dependency is explicit in construction
  and used by reservation/audit paths.
- acceptable_root_cause: Correct review should distinguish the safe injected
  clock path from module-level default clock leakage.
- unacceptable_shallow_answers: "Manual clocks are hidden dependencies" ignores
  that this one is supplied explicitly.
- minimum_evidence_chain: Cite `ManualClock`, `InventoryTracker.__init__`, and
  `test_injected_clock_controls_reservation_expiry`.
- domain_expert_note: Dependency injection is the mitigation for hidden time
  state when scoped per instance.

### SEED-CR-20

- production_trigger: A customer success manager receives access to a tenant
  record through a delegated support role after another tenant grants the same
  role ID.
- deceptive_cues: Direct assignments look tenant-scoped, tests cover normal
  same-tenant delegation, and the handoff says delegation edges are
  tenant-filtered.
- required_concepts: authz-models, multi-tenancy, trust-boundaries.
- causal_chain: Role delegation traversal follows matching role IDs without
  verifying the delegated assignment tenant; a cross-tenant support role can
  satisfy the permission check for an unrelated resource.
- why_local_review_passes: Each role assignment stores a tenant ID and every
  direct permission lookup filters by tenant, so local inspection of the
  assignment model looks correct.
- acceptable_root_cause: Delegated role traversal must carry tenant context
  through every edge and reject role grants whose tenant differs from the
  resource tenant.
- unacceptable_shallow_answers: "Add an auth check" or "rename support role"
  misses that the direct auth check already exists and the defect is in graph
  traversal context.
- minimum_evidence_chain: Cite the delegated traversal in
  `AuthorizationGraph.can_access`, the cross-tenant fixture in
  `tests/test_authz_graph.py`, and the handoff claim that delegated access is
  tenant-filtered.
- domain_expert_note: Multi-tenant authorization bugs often appear after role
  graph composition, not in direct role checks.

### SEED-CR-21

- production_trigger: A tenant admin revokes support access during an incident,
  but another decision reuses a cached authorization result generated under a
  different tenant or policy version.
- deceptive_cues: The cache looks bounded and keyed by user, resource, and
  permission, and the tests prove repeated checks are fast.
- required_concepts: caching-systems, authz-models, time-handling.
- causal_chain: The cache key omits tenant ID and policy version, and
  revocation clears only assignment state, not cached decisions.
- why_local_review_passes: The cache works for single-tenant happy paths and
  reduces repeated graph traversal cost.
- acceptable_root_cause: Authorization cache keys must include tenant and
  policy epoch, and revocation must invalidate affected decisions.
- unacceptable_shallow_answers: "Disable caching" is weaker than identifying
  the missing invalidation and key dimensions.
- minimum_evidence_chain: Cite `_decision_cache_key`, `revoke_assignment`, and
  the missing revocation/cache tests.
- domain_expert_note: Authz caches require stricter invalidation than ordinary
  read caches because stale positives are privilege grants.

### SEED-CR-22

- production_trigger: An older policy-service payload omits `tenant_scope`
  during a rolling deployment, and the gateway interprets the missing field as
  wildcard scope.
- deceptive_cues: The `PolicyEnvelope` type is present, the handoff claims
  backward compatibility, and tests use fully populated policy payloads.
- required_concepts: serialization, contract-testing, trust-boundaries.
- causal_chain: `PolicyEnvelope.from_payload` defaults missing tenant scope to
  `*`, converting a compatibility gap into global access.
- why_local_review_passes: The internal dataclass is typed and all local tests
  use valid enum-like payloads.
- acceptable_root_cause: External policy payloads need runtime validation and a
  deny-by-default missing-scope rule.
- unacceptable_shallow_answers: "Add a type annotation" misses that static
  typing does not validate JSON payloads.
- minimum_evidence_chain: Cite `PolicyEnvelope.from_payload`, the handoff
  compatibility claim, and absence of a missing-scope contract test.
- domain_expert_note: Type-system escapes often occur at JSON or protobuf
  boundaries where local type declarations stop applying.

### SEED-CR-23

- production_trigger: A large enterprise tenant imports nested delegated roles
  from an identity provider, increasing role graph fanout by two orders of
  magnitude.
- deceptive_cues: The traversal has a visited set, works on small fixtures, and
  the handoff describes cycle protection.
- required_concepts: authz-models, capacity-planning, resource-exhaustion-leak.
- causal_chain: The access check recursively explores delegated roles across
  all assignments without tenant prefiltering, edge budget, or depth budget.
- why_local_review_passes: The current tests have shallow graphs and no cycles,
  so traversal appears deterministic and fast.
- acceptable_root_cause: The traversal must constrain tenant, depth, and edge
  count before evaluating permission paths.
- unacceptable_shallow_answers: "Add a visited set" is insufficient because the
  code already has one; the missing constraints are budget and tenant filter.
- minimum_evidence_chain: Cite `_walk_delegations`, assignment fanout in the
  project brief, and absence of load/depth tests.
- domain_expert_note: Authorization graph algorithms that are correct at small
  depth can become denial-of-service risks at enterprise delegation scale.

### SEED-CR-24

- production_trigger: A privilege escalation occurs through delegated support
  access, but incident responders cannot reconstruct which role edge or policy
  version granted the decision.
- deceptive_cues: The module logs every authorization decision and the handoff
  calls audit coverage complete.
- required_concepts: observability-design, authz-models, trust-boundaries.
- causal_chain: Audit entries record allowed/denied but not traversal path,
  policy version, tenant boundary, or break-glass reason.
- why_local_review_passes: There is a visible audit log call on every decision,
  so simple checklist review marks observability present.
- acceptable_root_cause: Security-sensitive authz audit logs must include the
  evidence path and policy version needed to explain grants after the fact.
- unacceptable_shallow_answers: "Add more logging" without required fields does
  not address forensic reconstruction.
- minimum_evidence_chain: Cite `AuditLog.record`, `can_access`, and the handoff
  claim that audit evidence is complete.
- domain_expert_note: For authorization systems, auditability is part of the
  security boundary; missing path evidence can hide active escalation.

### SEED-CR-25

- production_trigger: The module passes all direct and shallow delegation tests,
  then fails under cross-tenant delegation, revoke/cache, missing policy-scope,
  and deep graph fixtures in production.
- deceptive_cues: Test coverage percentage is high and the handoff lists every
  acceptance criterion as done.
- required_concepts: property-testing, contract-testing, authz-models.
- causal_chain: Tests assert happy-path direct access and same-tenant
  delegation but omit adversarial graph, serialization, revocation, and
  observability cases that define the real risk.
- why_local_review_passes: The tests look domain-specific and are not obviously
  empty or trivial.
- acceptable_root_cause: Code Review must identify that the test suite proves
  local behavior but not the high-risk authorization invariants.
- unacceptable_shallow_answers: "Add more tests" without naming cross-tenant,
  revoke/cache, wildcard payload, and graph-depth cases is too shallow.
- minimum_evidence_chain: Cite `tests/test_authz_graph.py`, project acceptance
  criteria, and the fake handoff's coverage claim.
- domain_expert_note: Authorization review requires adversarial test design,
  not only positive-path role checks.

### SEED-CR-26

- production_trigger: An incident lead receives valid break-glass access, the
  decision is cached, and the emergency assignment expires while the cached
  positive decision remains reusable.
- deceptive_cues: Break-glass assignments have expiry fields and the direct
  permission helper checks expiry before granting access.
- required_concepts: caching-systems, time-handling, trust-boundaries.
- causal_chain: `can_access` returns cached authorization decisions before
  `_has_direct_permission` can re-check `expires_at`, and the cache key has no
  time bucket or emergency-access epoch.
- why_local_review_passes: The expiry logic is locally correct inside direct
  permission evaluation and the tests prove same-tenant break-glass access.
- acceptable_root_cause: Positive decisions for expiring emergency access must
  be bounded by expiry time or invalidated when the emergency grant expires.
- unacceptable_shallow_answers: "Break-glass has an expiry" misses that the
  cached decision bypasses the expiry check after the first allow.
- minimum_evidence_chain: Cite `grant_break_glass`, `_decision_cache_key`,
  `can_access` cache return, and missing post-expiry cache tests.
- domain_expert_note: Time-bound security grants cannot be cached as ordinary
  resource reads; expiry is part of the authorization boundary.

### SEED-CR-NC-03

- production_trigger: Emergency support access is granted to a same-tenant user
  with an expiry, reason, and audit trail during an outage.
- deceptive_cues: The code uses a broad-sounding `break_glass` label that may
  trigger overzealous privilege-escalation findings.
- required_concepts: authz-models, multi-tenancy, trust-boundaries.
- causal_chain: The break-glass assignment is tenant-scoped, time-bound, and
  audited; it is not the cross-tenant delegation bug.
- why_local_review_passes: A careful reviewer can verify scope, expiry, and
  reason fields before deciding whether to flag it.
- acceptable_root_cause: Correct skip. If raised, it should be framed only as a
  policy choice, not as a seeded defect.
- unacceptable_shallow_answers: Flagging all break-glass access as escalation
  without checking expiry and tenant scope is a false positive.
- minimum_evidence_chain: Cite `grant_break_glass`, its expiry check, and the
  test proving same-tenant scoping.
- domain_expert_note: Strong reviewers distinguish dangerous bypasses from
  controlled emergency-access workflows.

### SEED-CR-NC-04

- production_trigger: The graph traversal helper is reviewed alongside the
  unbounded traversal defect, making it tempting to flag every recursive walk.
- deceptive_cues: The helper uses recursion and role graph traversal.
- required_concepts: authz-models, capacity-planning, test-isolation.
- causal_chain: `bounded_role_walk` has tenant filtering, a visited set, and
  explicit depth and edge budgets; it is the safe pattern, not a defect.
- why_local_review_passes: Its constraints are local and visible if the reviewer
  checks both loop guards and tests.
- acceptable_root_cause: Correct skip. Reviewers may recommend reuse of this
  helper but should not mark it as a bug.
- unacceptable_shallow_answers: "Recursive role traversal can loop forever" is
  false here because limits are present.
- minimum_evidence_chain: Cite `bounded_role_walk` and the max-depth test.
- domain_expert_note: Negative controls should trigger the same heuristic as a
  real defect while preserving the safety invariant.

### SEED-CR-27

- production_trigger: A partner API outage causes thousands of partitioned
  deliveries to fail at once and retry on the same schedule.
- deceptive_cues: `RetryPolicy` exposes max delay and jitter fields, and the
  tests prove a retry is scheduled.
- required_concepts: message-queues, backpressure, capacity-planning.
- causal_chain: `RetryPolicy.delay_for` computes exponential delay without cap
  or jitter, and `_schedule_retry` queues all failed messages with synchronized
  retry times.
- why_local_review_passes: Single-message retry tests only verify that the
  first retry is delayed, not that large synchronized failures are decorrelated.
- acceptable_root_cause: Retry scheduling must enforce cap and jitter at the
  point retries are enqueued.
- unacceptable_shallow_answers: "It retries with exponential backoff" misses
  that the configured safety parameters are unused.
- minimum_evidence_chain: Cite `RetryPolicy.delay_for`,
  `QueueConsumer._schedule_retry`, and the fake handoff retry claim.
- domain_expert_note: Retry systems can turn a downstream outage into a wider
  incident when retries are synchronized.

### SEED-CR-28

- production_trigger: A partner replays an old delivery after a delayed queue
  recovery, beyond the local dedupe TTL but inside the partner replay contract.
- deceptive_cues: There is an idempotency store and duplicate tests pass inside
  a short local window.
- required_concepts: message-queues, time-handling, invariant-preservation.
- causal_chain: `IdempotencyStore` expires receipts after a local window that
  is shorter than the required replay window, so a delayed replay can execute a
  second side effect.
- why_local_review_passes: The tests replay a duplicate immediately and never
  compare the retention window with the project brief.
- acceptable_root_cause: Idempotency retention must cover the upstream replay
  contract or use durable side-effect receipts.
- unacceptable_shallow_answers: "There is an idempotency key" ignores the
  window mismatch that makes the guarantee expire too early.
- minimum_evidence_chain: Cite `IdempotencyStore.window_seconds`, AC-3 in the
  project brief, and the duplicate test timing.
- domain_expert_note: Idempotency is a temporal contract, not just a key lookup.

### SEED-CR-29

- production_trigger: A malformed message enters a tenant partition and is
  redelivered indefinitely while later valid tenant work waits behind it.
- deceptive_cues: The code has a `DeadLetterSink`, and transient max-attempt
  failures do publish to it.
- required_concepts: message-queues, error-propagation, backpressure.
- causal_chain: `PermanentMessageError` is caught and reinserted at the retry
  queue head instead of being quarantined, so poison messages remain on the
  hot path.
- why_local_review_passes: Tests only exercise transient max-attempt DLQ and do
  not raise permanent decode or validation failures.
- acceptable_root_cause: Permanent failures need DLQ isolation separate from
  retryable partner failures.
- unacceptable_shallow_answers: "DLQ exists" is insufficient because the poison
  branch never uses it.
- minimum_evidence_chain: Cite the `PermanentMessageError` branch in
  `process_batch`, the max-attempt test, and AC-4.
- domain_expert_note: Poison-message handling is about preserving partition
  progress, not only recording failed work.

### SEED-CR-30

- production_trigger: A partition rebalance occurs while an old consumer is
  still completing a side effect for an in-flight message.
- deceptive_cues: The consumer has partition assignment and checkpoint state,
  and single-consumer processing tests pass.
- required_concepts: ordering-guarantees, event-sourcing, state-machines.
- causal_chain: Side effects complete before `_ack`, and `_ack` is not fenced
  by the current `owner_epoch`; a stale owner can checkpoint after rebalance
  while the new owner also processes the message.
- why_local_review_passes: Tests never overlap old and new partition owners or
  simulate replay after rebalance.
- acceptable_root_cause: Checkpoint and side-effect commits must be fenced by
  partition owner epoch or protected by a durable idempotent sink.
- unacceptable_shallow_answers: "Checkpoints are per partition" misses that
  ownership is the missing invariant.
- minimum_evidence_chain: Cite `claim_partitions`, `process_batch`, `_ack`, and
  the absence of rebalance replay tests.
- domain_expert_note: Rebalance safety depends on ownership fencing, not just
  offset bookkeeping.

### SEED-CR-31

- production_trigger: A degraded partner keeps failing deliveries while the
  worker has already paused fresh queue fetches under backpressure.
- deceptive_cues: `BackpressureMonitor` is present and `should_fetch` correctly
  pauses fresh work.
- required_concepts: backpressure, capacity-planning, load-testing.
- causal_chain: `_schedule_retry` appends retries regardless of monitor state,
  so retry depth can grow without bound even when fetching is paused.
- why_local_review_passes: Tests check the monitor in isolation and do not run
  retry scheduling while the retry queue is already over threshold.
- acceptable_root_cause: Backpressure must govern retry enqueueing or spill
  retries to a durable bounded queue.
- unacceptable_shallow_answers: "Backpressure exists" misses that it is wired
  only to fetch, not retries.
- minimum_evidence_chain: Cite `should_fetch`, `BackpressureMonitor`, and
  `_schedule_retry`.
- domain_expert_note: Backpressure that protects only ingress often fails under
  internally generated retry traffic.

### SEED-CR-32

- production_trigger: Incident responders need to explain whether a duplicate
  delivery was a replay, retry, rebalance duplicate, or new command.
- deceptive_cues: The worker appends events for success, retry, duplicate, and
  DLQ outcomes.
- required_concepts: observability-design, message-queues, multi-tenancy.
- causal_chain: Event payloads include only event type and message ID, omitting
  tenant, idempotency key, attempt, partition, owner epoch, and replay class.
- why_local_review_passes: A checklist review sees events on each branch and
  may mark observability as present.
- acceptable_root_cause: Delivery telemetry must include the dimensions needed
  to reconstruct retry and dedupe decisions.
- unacceptable_shallow_answers: "Add logging" without naming the missing
  fields is too shallow.
- minimum_evidence_chain: Cite `QueueConsumer.events`, `process_batch`, and the
  fake handoff observability claim.
- domain_expert_note: Queue observability must explain causality across
  attempts and owners, not merely count outcomes.

### SEED-CR-33

- production_trigger: The worker passes local tests but fails during delayed
  replay, poison-message, rebalance, and partner-outage scenarios.
- deceptive_cues: Tests cover success, duplicate replay, retry scheduling, DLQ,
  backpressure monitor, and partition assignment.
- required_concepts: property-testing, chaos-engineering, contract-testing.
- causal_chain: The tests exercise local branches but omit the high-risk
  interactions that define the queue contract.
- why_local_review_passes: The test names map to acceptance criteria, creating
  a false sense that the critical cases are covered.
- acceptable_root_cause: Code Review must name the missing delayed replay,
  cap/jitter, poison, rebalance, and retry-backpressure tests.
- unacceptable_shallow_answers: "Add more tests" without the specific failure
  modes is too generic.
- minimum_evidence_chain: Cite `tests/test_retry_queue.py`, AC-2 through AC-7,
  and the handoff coverage claim.
- domain_expert_note: Queue review quality depends on adversarial delivery
  timelines, not only branch coverage.

### SEED-CR-NC-05

- production_trigger: The bounded monitor is reviewed near the retry
  backpressure bug, inviting reviewers to flag every backpressure-related
  branch.
- deceptive_cues: `should_pause_fetch` can stop fetching work, which may look
  like message dropping in a shallow review.
- required_concepts: message-queues, backpressure, capacity-planning.
- causal_chain: The monitor only returns a pause signal; it does not discard or
  acknowledge messages.
- why_local_review_passes: Its behavior is directly bounded by inflight and
  retry-depth thresholds and tested independently.
- acceptable_root_cause: Correct skip. Reviewers may recommend wiring it into
  retries but should not mark the helper itself as defective.
- unacceptable_shallow_answers: "Pausing fetches drops messages" is false for
  this helper.
- minimum_evidence_chain: Cite `BackpressureMonitor.should_pause_fetch` and
  `test_backpressure_monitor_signals_pause`.
- domain_expert_note: Negative controls separate safe flow-control primitives
  from unsafe call-site integration.

### SEED-CR-NC-06

- production_trigger: Duplicate partner delivery is replayed with the same
  idempotency key after the original side effect completed.
- deceptive_cues: The helper returns without invoking the factory on duplicate
  keys, which may look like skipped work.
- required_concepts: message-queues, invariant-preservation, time-handling.
- causal_chain: Returning the prior receipt is the intended idempotent outcome;
  executing the factory again would be the duplicate side effect.
- why_local_review_passes: The test verifies one factory call and identical
  duplicate receipts.
- acceptable_root_cause: Correct skip. The behavior is a valid idempotency
  contract.
- unacceptable_shallow_answers: Flagging duplicate receipt return as lost work
  reverses the idempotency invariant.
- minimum_evidence_chain: Cite `IdempotentReceiptCache.complete_once` and
  `test_idempotent_receipt_cache_returns_prior`.
- domain_expert_note: Idempotent APIs often return cached success for duplicate
  commands by design.

### SEED-CR-34

- production_trigger: A slow legacy read captures an old profile, a fresher
  write invalidates cache, then the slow read repopulates the old snapshot.
- deceptive_cues: Cache keys include tenant and schema version, and writes
  delete both v1 and v2 entries before putting fresh data.
- required_concepts: caching-systems, ordering-guarantees, distributed-state.
- causal_chain: `repopulate_legacy_cache` accepts `snapshot_generation` but
  ignores it, so stale snapshots can overwrite newer cache state.
- why_local_review_passes: Tests perform serial reads and writes with no slow
  snapshot interleaving.
- acceptable_root_cause: Repopulation must compare snapshot generation with
  current cache/write generation or use compare-and-set semantics.
- unacceptable_shallow_answers: "Use versioned keys" misses that the stale
  snapshot writes the current versioned key.
- minimum_evidence_chain: Cite `write_profile`, `repopulate_legacy_cache`, and
  AC-6.
- domain_expert_note: Versioned cache keys do not by themselves prevent stale
  fill-after-invalidate races.

### SEED-CR-35

- production_trigger: During partial rollout, v2 writes are enabled while some
  nodes and rollback paths still read legacy cache.
- deceptive_cues: The dual-write branch exists and tests cover the explicit
  `dual_write=True` case.
- required_concepts: schema-evolution, migration-strategy, api-evolution.
- causal_chain: When `write_v2=True` and `dual_write=False`, `write_profile`
  writes only v2, leaving legacy readers without the update during the rollback
  window.
- why_local_review_passes: Tests choose the safe flag combination and do not
  exercise intermediate rollout states.
- acceptable_root_cause: The migration must reject v2-only writes until old
  readers are gone or always write both shapes during rollback.
- unacceptable_shallow_answers: "There is a dual-write mode" misses that
  unsupported flag combinations are accepted.
- minimum_evidence_chain: Cite `MigrationFlags`, `write_profile`, and the fake
  handoff claim that rollback is safe.
- domain_expert_note: Migration safety depends on the rollout state machine,
  not only on having a dual-write branch.

### SEED-CR-36

- production_trigger: A legacy payload without renamed risk fields is converted
  to v2 during rollout, then rolled back after v2-only metadata was added.
- deceptive_cues: The transformer returns typed dictionaries and forward-shape
  tests pass.
- required_concepts: serialization, schema-evolution, contract-testing.
- causal_chain: `v1_to_v2` silently defaults missing risk fields and
  `v2_to_v1` drops v2-only metadata, making the transform non-lossless and
  unsafe across rollback.
- why_local_review_passes: Tests verify only the happy forward transform and do
  not run round-trip or missing-field contract cases.
- acceptable_root_cause: Schema translation must preserve required safety
  fields or fail closed when compatibility data is absent.
- unacceptable_shallow_answers: "The transformer handles both versions" misses
  the missing-field and rollback loss.
- minimum_evidence_chain: Cite `SchemaTransformer.v1_to_v2`,
  `SchemaTransformer.v2_to_v1`, and `test_schema_transform_forward_shape`.
- domain_expert_note: Schema migrations fail at serialization boundaries where
  optional-looking fields carry safety meaning.

### SEED-CR-37

- production_trigger: Operators enable v2 writes before v2 reads for a tenant,
  then disable dual write during a staged rollback.
- deceptive_cues: Individual flags have clear names and the simple static flag
  tests pass.
- required_concepts: migration-strategy, multi-tenancy, invariant-preservation.
- causal_chain: `MigrationFlags` allows independent read, write, dual-write,
  shadow, and backfill states without validating unsupported combinations.
- why_local_review_passes: Each branch is locally understandable, but the
  invalid state is in the flag composition.
- acceptable_root_cause: Migration flags need an explicit rollout state machine
  or validation that rejects unsafe combinations.
- unacceptable_shallow_answers: "Feature flags are normal for rollouts" ignores
  the missing invariant across flags.
- minimum_evidence_chain: Cite `MigrationFlags`, `write_profile`,
  `read_profile`, and the lack of flag-matrix tests.
- domain_expert_note: Feature flag interactions are configuration state, and
  state needs invariants.

### SEED-CR-38

- production_trigger: A tenant is marked promoted after backfill starts, while
  recent writes have a cache generation higher than the backfill watermark.
- deceptive_cues: There is a `backfill_complete` flag and a watermark field.
- required_concepts: migration-strategy, time-handling, distributed-state.
- causal_chain: `promote_tenant` trusts the flag and ignores whether the
  watermark has caught `cache_generation`, allowing cutover before warm-up
  catches recent writes.
- why_local_review_passes: The promotion test only asserts that the flag
  promotes a tenant.
- acceptable_root_cause: Promotion must compare tenant backfill watermark and
  cache/write generation before enabling new-only reads.
- unacceptable_shallow_answers: "Backfill complete is checked" misses that the
  readiness value is not used.
- minimum_evidence_chain: Cite `mark_backfill_complete`, `promote_tenant`, and
  `test_promotion_uses_backfill_flag`.
- domain_expert_note: Cutover safety is a temporal property of watermarks, not
  a boolean.

### SEED-CR-39

- production_trigger: Shadow-read mismatch alerts fire during rollout, but
  operators cannot identify affected users, schemas, generations, or flags.
- deceptive_cues: `MigrationMetrics` has counters and records a
  `shadow_mismatch` event.
- required_concepts: observability-design, caching-systems, schema-evolution.
- causal_chain: `record_shadow_mismatch` discards the user, tenant, schema
  versions, cache generations, source cache, and flag set.
- why_local_review_passes: Tests assert the mismatch counter increments, which
  can satisfy shallow observability checks.
- acceptable_root_cause: Rollout drift telemetry must preserve dimensions that
  identify the inconsistent records and migration state.
- unacceptable_shallow_answers: "Metric exists" misses that the metric is not
  diagnosable.
- minimum_evidence_chain: Cite `MigrationMetrics.record_shadow_mismatch`,
  `read_profile`, and the fake handoff observability claim.
- domain_expert_note: Migration observability must support rollback decisions,
  not just alert counts.

### SEED-CR-40

- production_trigger: The migration passes local tests but fails in stale
  repopulation, rollback write, unsupported flag, schema edge, and partial
  backfill cases.
- deceptive_cues: Tests cover dual-write, read fallback, schema transform,
  shadow mismatch, versioned key, compatibility shim, and promotion.
- required_concepts: contract-testing, property-testing, test-isolation.
- causal_chain: The tests cover static happy states but omit the adversarial
  timelines and flag combinations that define migration safety.
- why_local_review_passes: Test names map closely to the feature list and can
  hide missing interaction coverage.
- acceptable_root_cause: Code Review must name stale repopulation, rollback
  dual-write, flag matrix, schema contract, and partial backfill tests.
- unacceptable_shallow_answers: "Add migration tests" without the failure modes
  is too generic.
- minimum_evidence_chain: Cite `tests/test_cache_migration.py`, AC-1 through
  AC-7, and the handoff coverage claim.
- domain_expert_note: Migration tests need state-transition coverage, not just
  each static mode.

### SEED-CR-NC-07

- production_trigger: Reviewers inspect versioned cache keys near a stale-cache
  repopulation defect.
- deceptive_cues: Versioned keys duplicate user IDs across v1 and v2 namespaces,
  which may look like redundant storage.
- required_concepts: caching-systems, ordering-guarantees, test-isolation.
- causal_chain: The helper includes tenant and schema version in the key; it is
  the correct isolation pattern, not the stale snapshot bug.
- why_local_review_passes: The test proves v1 and v2 keys are distinct for the
  same tenant and user.
- acceptable_root_cause: Correct skip. Reviewers should focus on generation
  checks, not flag versioned keys as a defect.
- unacceptable_shallow_answers: "Two keys for one user is redundant" ignores
  schema-isolation requirements during migration.
- minimum_evidence_chain: Cite `versioned_cache_key` and
  `test_versioned_cache_key_is_schema_scoped`.
- domain_expert_note: Versioned keys are a standard mitigation; stale writes
  require a separate generation guard.

### SEED-CR-NC-08

- production_trigger: A compatibility shim writes both old and new cache shapes
  while rollback is still allowed.
- deceptive_cues: The shim appears to duplicate writes and may look like wasted
  work.
- required_concepts: schema-evolution, migration-strategy, contract-testing.
- causal_chain: During rollback windows the pair of writes is required to keep
  both reader generations lossless.
- why_local_review_passes: The test confirms both caches receive the intended
  profiles from one v2 input.
- acceptable_root_cause: Correct skip. Dual writes are expected until the old
  reader population is retired.
- unacceptable_shallow_answers: "Remove duplicate write" would reintroduce the
  migration data-loss window.
- minimum_evidence_chain: Cite `DualWriteCompatibilityShim.write_pair` and
  `test_dual_write_compatibility_shim_is_lossless`.
- domain_expert_note: Dual writes are often the safety mechanism in rolling
  schema migrations, not an optimization target.

### SEED-CR-41

- production_trigger: One stream partition is far ahead while another lags
  behind with unprocessed event-time records.
- deceptive_cues: The processor tracks per-partition watermarks and lockstep
  tests pass.
- required_concepts: stream-processing, ordering-guarantees, distributed-state.
- causal_chain: `advance_watermark` uses the maximum partition watermark, so a
  leading partition closes windows before lagging partition data arrives.
- why_local_review_passes: The method name and synchronized tests make the
  watermark frontier look correct.
- acceptable_root_cause: Global event-time watermarks must use the minimum
  active partition watermark with explicit idle handling.
- unacceptable_shallow_answers: "Watermarks are tracked per partition" misses
  the aggregation invariant.
- minimum_evidence_chain: Cite `advance_watermark`, AC-1, and the lockstep
  partition tests.
- domain_expert_note: Stream watermarks are safety frontiers, not latest-seen
  timestamps.

### SEED-CR-42

- production_trigger: Late records arrive after the allowed aggregation window
  during a producer outage recovery.
- deceptive_cues: `LateEventSink` exists and within-window late events are
  covered.
- required_concepts: stream-processing, time-handling, backpressure.
- causal_chain: The beyond-window branch increments a counter and returns
  without publishing late-event metadata.
- why_local_review_passes: Reviewers can see late-event handling and miss the
  untested branch boundary.
- acceptable_root_cause: Beyond-window events must be removed from aggregation
  and routed to a late-event sink with metadata.
- unacceptable_shallow_answers: "Late events are handled" ignores the branch
  that silently discards them.
- minimum_evidence_chain: Cite `process_event`, AC-2, and the within-window
  late-event-only test.
- domain_expert_note: Late-event sinks preserve auditability for intentionally
  excluded data.

### SEED-CR-43

- production_trigger: A worker crashes after checkpoint commit but before
  search or analytics output is durably emitted.
- deceptive_cues: Both checkpoint and output calls are present in the flush
  path.
- required_concepts: stream-processing, event-sourcing, state-machines.
- causal_chain: `flush_closed_windows` commits checkpoint state before
  `output_sink.emit`, so restart skips a window whose output was never written.
- why_local_review_passes: Tests verify final success, not crash ordering.
- acceptable_root_cause: Side effects must be durable before the checkpoint
  that suppresses replay is committed.
- unacceptable_shallow_answers: "Checkpointing exists" misses the ordering
  violation.
- minimum_evidence_chain: Cite `flush_closed_windows`, AC-3, and the fake
  handoff checkpoint claim.
- domain_expert_note: Exactly-once-ish pipelines depend on commit ordering more
  than on the presence of a checkpoint store.

### SEED-CR-44

- production_trigger: A partition rebalance occurs while old owner window state
  remains in memory.
- deceptive_cues: `on_rebalance` restores checkpoints for newly assigned
  partitions.
- required_concepts: stream-processing, concurrency-primitives, state-machines.
- causal_chain: Revoked partition windows are not pruned and can later flush
  despite the worker no longer owning that partition.
- why_local_review_passes: Checkpoint restoration is visible while stale
  `active_windows` are less obvious.
- acceptable_root_cause: Rebalance must fence or clear in-memory state for
  revoked partitions before flushing.
- unacceptable_shallow_answers: "Rebalance restores checkpoints" misses stale
  owner state.
- minimum_evidence_chain: Cite `on_rebalance`, `active_windows`, and
  `flush_closed_windows`.
- domain_expert_note: Ownership changes require state cleanup as well as
  checkpoint restore.

### SEED-CR-45

- production_trigger: A low-traffic tenant partition becomes idle after many
  windows were opened.
- deceptive_cues: `_cleanup_expired_windows` exists and works when called.
- required_concepts: stream-processing, memory-management, capacity-planning.
- causal_chain: Cleanup runs only during `process_event`, so no-event periods
  can retain expired windows indefinitely.
- why_local_review_passes: Active-stream tests naturally invoke cleanup and
  make the logic look bounded.
- acceptable_root_cause: Cleanup needs a periodic, lifecycle, or rebalance hook
  independent of new event arrival.
- unacceptable_shallow_answers: "Cleanup logic exists" ignores the trigger
  condition.
- minimum_evidence_chain: Cite `_cleanup_expired_windows`, `process_event`, and
  AC-5.
- domain_expert_note: Stream state bounds must hold during silence, not only
  under continuous traffic.

### SEED-CR-46

- production_trigger: Operators need to diagnose which tenant partition is
  falling behind or accumulating window state.
- deceptive_cues: `StreamMetrics` records counters on normal processing paths.
- required_concepts: observability-design, stream-processing, capacity-planning.
- causal_chain: Metrics are aggregate counters without tenant, partition, lag,
  checkpoint-age, or state-size dimensions.
- why_local_review_passes: Checklist review sees metrics and does not inspect
  their diagnostic cardinality.
- acceptable_root_cause: Stream metrics must expose the dimensions required to
  localize lag and state growth.
- unacceptable_shallow_answers: "Add metrics" without naming missing
  dimensions is too shallow.
- minimum_evidence_chain: Cite `StreamMetrics`, AC-6, and the fake handoff
  observability claim.
- domain_expert_note: Streaming incidents are usually partition-local before
  they are service-wide.

### SEED-CR-47

- production_trigger: The worker passes local tests but fails under divergent
  partitions, crash recovery, rebalance, and idle cleanup.
- deceptive_cues: Tests have domain-specific names for watermarks, late events,
  flush, rebalance, cleanup, and metrics.
- required_concepts: property-testing, chaos-engineering, contract-testing.
- causal_chain: Tests cover happy-path branches but omit the interaction cases
  that define the stream contract.
- why_local_review_passes: Coverage appears broad because each feature has at
  least one test.
- acceptable_root_cause: Code Review must name missing divergent watermark,
  late sink, crash ordering, stale rebalance, idle cleanup, and metrics tests.
- unacceptable_shallow_answers: "Add more tests" without these cases is too
  generic.
- minimum_evidence_chain: Cite `tests/test_stream_watermarks.py`, AC-1 through
  AC-7, and the handoff coverage claim.
- domain_expert_note: Streaming correctness requires timeline and ownership
  tests, not just branch tests.

### SEED-CR-NC-09

- production_trigger: The partition-local watermark helper sits near the global
  watermark defect and also uses `max`.
- deceptive_cues: Seeing `max` in watermark code can trigger the same heuristic
  as the seeded defect.
- required_concepts: stream-processing, ordering-guarantees, time-handling.
- causal_chain: `PartitionWatermarkTracker` correctly takes max per partition
  and then min across active partitions.
- why_local_review_passes: The helper separates local frontier tracking from
  global watermark computation.
- acceptable_root_cause: Correct skip; the local max update is the safe
  component, not the global defect.
- unacceptable_shallow_answers: Flagging all watermark `max` calls ignores
  partition-local semantics.
- minimum_evidence_chain: Cite `PartitionWatermarkTracker.observe`,
  `minimum_active`, and its test.
- domain_expert_note: Watermark review requires distinguishing local and global
  frontier calculations.

### SEED-CR-NC-10

- production_trigger: Beyond-window events are removed from aggregation by a
  dedicated router.
- deceptive_cues: Removing events from the main path can look like data loss.
- required_concepts: stream-processing, error-propagation, observability-design.
- causal_chain: `LateEventRouter` publishes metadata to the late-event sink,
  preserving evidence while excluding invalid data from aggregation.
- why_local_review_passes: The test proves metadata is retained.
- acceptable_root_cause: Correct skip; routing beyond-window events out of the
  aggregate is the intended design.
- unacceptable_shallow_answers: "Late events are dropped" is false when the sink
  receives metadata.
- minimum_evidence_chain: Cite `LateEventRouter.route` and
  `test_late_event_router_keeps_metadata`.
- domain_expert_note: Correct stream systems often route invalid-late data
  rather than aggregate it.

### SEED-CR-48

- production_trigger: A malformed route omits trusted tenant metadata and an
  attacker controls the unsigned JSON body.
- deceptive_cues: Normal requests use route tenant metadata and pass tests.
- required_concepts: authn-protocols, cryptography, trust-boundaries.
- causal_chain: `_resolve_tenant` falls back to unsigned payload `tenant_id`
  before verification, letting body data steer key lookup.
- why_local_review_passes: The fallback appears like a compatibility feature.
- acceptable_root_cause: Tenant/provider key lookup must come from trusted
  routing metadata, not signed-body content before signature verification.
- unacceptable_shallow_answers: "The payload is signed" misses that the tenant
  used to select the key is chosen first.
- minimum_evidence_chain: Cite `_resolve_tenant`, AC-4, and tests using trusted
  route tenant IDs.
- domain_expert_note: Signature verification cannot trust fields that are used
  to choose the verification key.

### SEED-CR-49

- production_trigger: Two tenants or providers reuse a nonce value inside the
  webhook replay window.
- deceptive_cues: Replay protection works in same-tenant tests.
- required_concepts: cryptography, multi-tenancy, caching-systems.
- causal_chain: `NonceCache._cache_key` uses only nonce, omitting tenant and
  provider scope.
- why_local_review_passes: The cache has TTL and correctly rejects exact
  same-request replay.
- acceptable_root_cause: Replay caches must include the full trust boundary:
  tenant, provider, key version, nonce, and timestamp.
- unacceptable_shallow_answers: "Nonce cache exists" misses the missing scope.
- minimum_evidence_chain: Cite `_cache_key`, AC-2, and the single-tenant replay
  test.
- domain_expert_note: Replay protection is only as strong as its cache key
  namespace.

### SEED-CR-50

- production_trigger: A provider or attacker sends a future-dated signed event
  during clock skew.
- deceptive_cues: Absolute timestamp tolerance looks like normal skew handling.
- required_concepts: time-handling, authn-protocols, encoding-boundaries.
- causal_chain: `_timestamp_allowed` uses `abs(now - timestamp)`, accepting
  future timestamps inside tolerance and extending replay material.
- why_local_review_passes: Tests cover old timestamps but not future ones.
- acceptable_root_cause: Timestamp validation must constrain stale and future
  bounds according to replay semantics.
- unacceptable_shallow_answers: "There is a tolerance check" misses direction.
- minimum_evidence_chain: Cite `_timestamp_allowed`, AC-3, and timestamp tests.
- domain_expert_note: Replay windows are directional security contracts, not
  simple absolute clock differences.

### SEED-CR-51

- production_trigger: A retired webhook secret remains configured after the
  planned rotation grace period.
- deceptive_cues: A grace helper exists and tests show old-key acceptance
  during migration.
- required_concepts: secrets-management, cryptography, migration-strategy.
- causal_chain: `verify` tries legacy keys whenever present and does not check
  grace expiry.
- why_local_review_passes: Dual-key verification is a valid rotation pattern
  during grace.
- acceptable_root_cause: Legacy keys must be gated by retired time and grace
  window before HMAC acceptance.
- unacceptable_shallow_answers: "Dual-key rotation is supported" misses the
  missing expiry gate.
- minimum_evidence_chain: Cite `WebhookVerifier.verify`,
  `DualKeyGraceVerifier`, and the in-grace-only test.
- domain_expert_note: Rotation grace is a bounded state, not a permanent
  fallback.

### SEED-CR-52

- production_trigger: A provider signs raw request bytes, but middleware
  parses and reserializes JSON before verification.
- deceptive_cues: Canonical JSON signing is deterministic and tests use sorted
  payloads.
- required_concepts: serialization, encoding-boundaries, contract-testing.
- causal_chain: `_bytes_to_sign` canonicalizes JSON for all providers, breaking
  raw-body signature contracts.
- why_local_review_passes: Canonicalization is often a best practice and looks
  deliberate.
- acceptable_root_cause: The verifier must use provider-specific signed bytes
  exactly as the provider defines them.
- unacceptable_shallow_answers: "Canonicalization is deterministic" misses the
  external contract.
- minimum_evidence_chain: Cite `_bytes_to_sign`, AC-5, and sorted-body tests.
- domain_expert_note: HMAC verification is over bytes, not semantic JSON.

### SEED-CR-53

- production_trigger: Incident responders investigate failed or suspicious
  webhooks during a key rotation.
- deceptive_cues: `AuditLog.record` is called for success and failure paths.
- required_concepts: observability-design, trust-boundaries, authn-protocols.
- causal_chain: Audit entries omit tenant source, key version, nonce,
  timestamp, canonicalization method, and detailed failure reason.
- why_local_review_passes: A visible audit entry can satisfy shallow logging
  review.
- acceptable_root_cause: Security verification logs must preserve the fields
  needed to reconstruct trust-boundary decisions.
- unacceptable_shallow_answers: "Audit exists" misses forensic completeness.
- minimum_evidence_chain: Cite `AuditLog.record`, `verify`, and AC-6.
- domain_expert_note: Security audit logs are part of the control, not only
  diagnostics.

### SEED-CR-54

- production_trigger: The verifier passes local tests but fails cross-tenant,
  future timestamp, post-grace, raw-body, and audit cases.
- deceptive_cues: Tests include security-sounding cases for replay, timestamp,
  rotation, and audit.
- required_concepts: property-testing, contract-testing, test-isolation.
- causal_chain: The tests cover nominal branches but omit adversarial
  boundaries that define webhook security.
- why_local_review_passes: Test names map to the feature list.
- acceptable_root_cause: Code Review must name missing cross-tenant,
  future-time, post-grace, raw-byte, and audit tests.
- unacceptable_shallow_answers: "Add webhook tests" without specific security
  cases is too generic.
- minimum_evidence_chain: Cite `tests/test_webhook_rotation.py`, AC-1 through
  AC-7, and the handoff coverage claim.
- domain_expert_note: Webhook verifier tests need adversarial inputs, not just
  valid provider examples.

### SEED-CR-NC-11

- production_trigger: A reviewer inspects a constant-time compare helper near
  signature verification bugs.
- deceptive_cues: The helper has a length precheck that can look like a timing
  side channel.
- required_concepts: cryptography, authn-protocols, test-isolation.
- causal_chain: Fixed-length HMAC digests are compared with
  `hmac.compare_digest`; malformed lengths are rejected before comparison.
- why_local_review_passes: Equal-length valid digests take the constant-time
  path.
- acceptable_root_cause: Correct skip for this helper; focus on key selection,
  replay, and canonicalization defects.
- unacceptable_shallow_answers: Flagging the helper as insecure without digest
  length context is a false positive.
- minimum_evidence_chain: Cite `constant_time_compare` and its digest test.
- domain_expert_note: Crypto review should separate real protocol bugs from
  safe primitive wrappers.

### SEED-CR-NC-12

- production_trigger: The system accepts old and new keys during a provider
  rotation.
- deceptive_cues: Any legacy-key acceptance can look like the seeded indefinite
  fallback.
- required_concepts: secrets-management, migration-strategy, time-handling.
- causal_chain: `DualKeyGraceVerifier` checks retired time plus grace duration
  and rejects after expiry.
- why_local_review_passes: The boundary test proves post-expiry rejection.
- acceptable_root_cause: Correct skip; bounded grace is required for safe
  rotation.
- unacceptable_shallow_answers: "Do not accept old keys" ignores rotation
  continuity requirements.
- minimum_evidence_chain: Cite `DualKeyGraceVerifier.accepts_legacy` and
  `test_dual_key_grace_verifier_rejects_after_expiry`.
- domain_expert_note: Safe key rotation is a state machine with a finite grace
  interval.

### SEED-CR-55

- production_trigger: A same-version event is redelivered during backfill or
  message replay with stale field content.
- deceptive_cues: Older versions are rejected and increasing versions are
  tested.
- required_concepts: event-sourcing, replication, ordering-guarantees.
- causal_chain: `apply_event` rejects only lower versions, so equal-version
  events overwrite current projection state.
- why_local_review_passes: The comparison looks like normal version gating and
  tests never replay same-version events.
- acceptable_root_cause: Projection writes must apply strictly newer versions
  and skip same-version replays idempotently.
- unacceptable_shallow_answers: "Version checks exist" misses equality
  semantics.
- minimum_evidence_chain: Cite `apply_event`, `VersionGatedWriter`, and the
  increasing-version tests.
- domain_expert_note: Event-sourced projections must define equality semantics,
  not only older/newer ordering.

### SEED-CR-56

- production_trigger: A deleted document receives a late update or backfill
  event after its tombstone was written.
- deceptive_cues: Delete writes a tombstone and normal search filters hide it.
- required_concepts: event-sourcing, caching-systems, invariant-preservation.
- causal_chain: Tombstones have only version state, and higher-version upsert
  or backfill events can recreate them without a new aggregate generation.
- why_local_review_passes: Delete tests prove the immediate tombstone case.
- acceptable_root_cause: Tombstone semantics need generation or deletion
  barriers that late backfill/update events cannot cross.
- unacceptable_shallow_answers: "Deletes create tombstones" misses resurrection.
- minimum_evidence_chain: Cite `apply_event`, AC-2, and the delete-only test.
- domain_expert_note: Tombstones are lifecycle state, not just another document
  version.

### SEED-CR-57

- production_trigger: Alias cutover is requested while one shard or replica has
  not reached the target backfill version.
- deceptive_cues: `ReplicationLagMonitor.ready_for_cutover` exists next to the
  alias manager.
- required_concepts: replication, migration-strategy, distributed-state.
- causal_chain: `AliasManager.swap_alias` ignores the readiness check and
  switches the read alias immediately.
- why_local_review_passes: Tests pre-converge the shard before swapping.
- acceptable_root_cause: Alias cutover must fail closed until every expected
  shard reaches target version/generation.
- unacceptable_shallow_answers: "A readiness helper exists" misses that it is
  not wired into cutover.
- minimum_evidence_chain: Cite `swap_alias`, `ready_for_cutover`, and AC-3.
- domain_expert_note: Migration readiness checks must be load-bearing, not
  merely adjacent.

### SEED-CR-58

- production_trigger: A new search field is added after the original projection
  field allowlist was written.
- deceptive_cues: Backfill maps all known fields and tests verify those fields.
- required_concepts: schema-evolution, serialization, api-evolution.
- causal_chain: `BackfillMapper.PROJECTION_FIELDS` is static while live
  projection accepts dynamic fields, so backfilled documents miss new schema
  data.
- why_local_review_passes: The mapper is explicit and tests cover the original
  schema.
- acceptable_root_cause: Backfill mapping must use the current search contract
  or schema-versioned transforms.
- unacceptable_shallow_answers: "Backfill maps fields" misses schema drift.
- minimum_evidence_chain: Cite `BackfillMapper`, live `apply_event`, and AC-4.
- domain_expert_note: Backfill code often becomes stale because it is run
  rarely but carries current schema obligations.

### SEED-CR-59

- production_trigger: An upstream event lacks tenant context during projection
  or restore.
- deceptive_cues: Query-time filtering returns only same-tenant results in
  tests.
- required_concepts: multi-tenancy, trust-boundaries, data-modeling.
- causal_chain: `ShardRouter.route` and `apply_event` fall back to `default`
  tenant routing instead of rejecting missing tenant context.
- why_local_review_passes: Search queries still filter by tenant, hiding
  storage-level co-location.
- acceptable_root_cause: Missing tenant context must fail closed before storage
  routing.
- unacceptable_shallow_answers: "Queries filter tenants" misses backup,
  restore, compaction, and shard-level exposure.
- minimum_evidence_chain: Cite `ShardRouter.route`, `apply_event`, and AC-5.
- domain_expert_note: Multi-tenant isolation must hold below the query layer.

### SEED-CR-60

- production_trigger: Projection lag grows on one tenant shard during index
  rebuild.
- deceptive_cues: Metrics count applied, rejected, tombstone, and alias events.
- required_concepts: observability-design, replication, caching-systems.
- causal_chain: Metrics omit tenant, shard, version gap, alias generation, and
  backfill progress dimensions.
- why_local_review_passes: Aggregate counters exist and tests assert increments.
- acceptable_root_cause: Projection observability must localize lag by shard,
  tenant, version, and generation.
- unacceptable_shallow_answers: "Metrics exist" misses diagnostic dimensions.
- minimum_evidence_chain: Cite `ReplicationMetrics`, AC-6, and fake handoff
  observability claims.
- domain_expert_note: Replica projection failures are often narrow before they
  become global.

### SEED-CR-61

- production_trigger: The projection passes local tests but fails under
  same-version replay, tombstone resurrection, partial cutover, schema drift,
  and tenant fallback.
- deceptive_cues: Tests cover update ordering, deletes, alias swap, backfill,
  tenant filtering, and helper behavior.
- required_concepts: contract-testing, property-testing, test-isolation.
- causal_chain: Tests cover static feature paths but omit distributed timeline
  and migration interaction cases.
- why_local_review_passes: Test names look comprehensive and domain-specific.
- acceptable_root_cause: Code Review must name missing replay, tombstone,
  cutover, schema, tenant-route, and metrics cases.
- unacceptable_shallow_answers: "Add projection tests" without these cases is
  too generic.
- minimum_evidence_chain: Cite `tests/test_search_projection.py`, AC-1 through
  AC-7, and the handoff coverage claim.
- domain_expert_note: Projection correctness depends on event history
  interactions, not only CRUD cases.

### SEED-CR-NC-13

- production_trigger: Same-version event replay reaches the projection helper.
- deceptive_cues: Skipping same-version events can look like lost updates.
- required_concepts: event-sourcing, ordering-guarantees, invariant-preservation.
- causal_chain: `VersionGatedWriter` requires strictly newer versions, which
  is the correct idempotent replay behavior.
- why_local_review_passes: Tests prove older and same versions are skipped.
- acceptable_root_cause: Correct skip; this is the safe comparison pattern.
- unacceptable_shallow_answers: "Accept equal version updates" reintroduces
  replay overwrite.
- minimum_evidence_chain: Cite `VersionGatedWriter.should_apply` and its test.
- domain_expert_note: Idempotent projection replays should be no-ops.

### SEED-CR-NC-14

- production_trigger: A storage-layer tenant shard validator runs before
  projection writes.
- deceptive_cues: Query-time tenant filters already exist, making the validator
  appear redundant.
- required_concepts: multi-tenancy, trust-boundaries, replication.
- causal_chain: The validator protects backup, restore, compaction, and
  storage-level operations that query filters cannot protect.
- why_local_review_passes: The test demonstrates rejection of a default/wrong
  shard.
- acceptable_root_cause: Correct skip; storage-level tenant isolation is a
  required defense-in-depth control.
- unacceptable_shallow_answers: "Query filters are enough" ignores lower-layer
  exposure.
- minimum_evidence_chain: Cite `TenantShardValidator.allows` and
  `test_tenant_shard_validator_rejects_wrong_shard`.
- domain_expert_note: Multi-tenant search systems need isolation at routing and
  storage layers, not only query time.

### SEED-CR-62

- production_trigger: High-volume tenants generate hundreds of thousands of
  billable micro-events before monthly invoice finalization.
- deceptive_cues: The visible hourly aggregator uses `Decimal` and explicit
  money quantization, making the precision path look handled.
- required_concepts: numerical-computing, invariant-preservation, data-modeling.
- causal_chain: Usage metering converts decimal quantity and price to binary
  float before aggregation, so later decimal quantization preserves accumulated
  drift rather than preventing it.
- why_local_review_passes: Small tests with simple decimal values produce
  expected cents and the final aggregation code looks financially careful.
- acceptable_root_cause: Monetary usage amounts must stay in integer minor
  units or `Decimal` from ingestion through finalization.
- unacceptable_shallow_answers: "Round the invoice total" is shallow because
  the loss has already happened in raw usage metering.
- minimum_evidence_chain: Cite `UsageMeter.record`, `billable_amount`, and
  `HourlyAggregator._flush_bucket`.
- domain_expert_note: Billing precision bugs often hide in intermediate
  representations, not the final formatting step.

### SEED-CR-63

- production_trigger: A tenant changes plan mid-cycle while support previews
  and reconciliation continue processing earlier usage windows.
- deceptive_cues: `RatedUsage` carries a `plan_epoch`, and the plan cache has a
  `plan_for_epoch` method.
- required_concepts: time-handling, data-modeling, invariant-preservation.
- causal_chain: Reconciliation uses the current plan instead of the usage
  epoch, repricing historical usage under a later contract.
- why_local_review_passes: Current-plan lookup works in tests where only one
  plan exists.
- acceptable_root_cause: Reconciliation must price usage against the contract
  epoch attached to the usage event or bucket.
- unacceptable_shallow_answers: "Plan cache exists" misses the wrong temporal
  boundary.
- minimum_evidence_chain: Cite `RatedUsage.plan_epoch`,
  `PlanCache.plan_for_epoch`, and `ReconciliationEngine.reconcile`.
- domain_expert_note: Contract effective dates are part of the billing data
  model, not just cache metadata.

### SEED-CR-64

- production_trigger: A worker crashes after mutating a credit balance but
  before ledger and audit records become durable.
- deceptive_cues: `CreditEntry` and audit calls are present in the happy path.
- required_concepts: event-sourcing, state-machines, invariant-preservation.
- causal_chain: `apply_credit` debits the balance before recording the ledger
  event, creating a data-loss window for financial compensation.
- why_local_review_passes: Single-process tests observe both mutation and entry
  append in one uninterrupted call.
- acceptable_root_cause: Credit balance mutation and ledger event must share a
  transactional boundary or outbox.
- unacceptable_shallow_answers: "Add an audit record" is shallow because the
  audit already exists but is ordered after the mutation.
- minimum_evidence_chain: Cite `CreditLedger.apply_credit`, `_balances`, and
  `entries.append`.
- domain_expert_note: Financial ledgers require the event to be the durable
  source of truth, not an after-the-fact side effect.

### SEED-CR-65

- production_trigger: Three active collectors reconcile the same tenant/hour
  after a restart or lag spike.
- deceptive_cues: `ReconciliationCursor` has explicit claim and processed
  concepts.
- required_concepts: concurrency-primitives, distributed-state,
  invariant-preservation.
- causal_chain: The cursor claim is check-then-mark with no compare-and-swap or
  lease, so two workers can both write adjustments before either marks the
  window processed.
- why_local_review_passes: Sequential tests call reconcile once and then see
  the processed marker.
- acceptable_root_cause: Claiming a reconciliation window must be atomic with
  worker ownership or the adjustment write.
- unacceptable_shallow_answers: "Track processed windows" misses that tracking
  happens too late.
- minimum_evidence_chain: Cite `ReconciliationCursor.claim_window`,
  `mark_processed`, and `ReconciliationEngine.reconcile`.
- domain_expert_note: Batch reconciliation correctness depends on ownership
  fencing as much as on arithmetic.

### SEED-CR-66

- production_trigger: A tenant bursts near the hard limit before the hourly
  billing bucket has flushed.
- deceptive_cues: Rate-limit enforcement uses the same plan cache and
  aggregator as billing, which sounds consistent.
- required_concepts: time-handling, caching-systems, capacity-planning.
- causal_chain: Enforcement reads completed hourly aggregation only, so
  current burst usage is invisible until after the enforcement decision.
- why_local_review_passes: Tests check a tenant with no existing usage and a
  small incoming amount.
- acceptable_root_cause: Real-time enforcement needs a fresh counter or
  write-through usage signal, not only completed billing buckets.
- unacceptable_shallow_answers: "Use the same contract limits" misses that
  the stale usage source is the problem.
- minimum_evidence_chain: Cite `RateLimitEnforcer.check` and
  `HourlyAggregator.tenant_usage`.
- domain_expert_note: Billing aggregation and enforcement have different
  freshness requirements even when they share contract limits.

### SEED-CR-67

- production_trigger: Two tenants in the same region/product have different tax
  exemption status.
- deceptive_cues: `TaxProfileStore.profile_for` filters by tenant before
  populating the cache on a cold read.
- required_concepts: multi-tenancy, caching-systems, trust-boundaries.
- causal_chain: The hot cache key omits tenant, so the first tenant's tax
  profile is reused for another tenant.
- why_local_review_passes: Single-tenant tax tests pass and the cold-read
  filter looks correct.
- acceptable_root_cause: Tax cache keys must include tenant and every field
  that changes tax treatment.
- unacceptable_shallow_answers: "Add a tax profile store" is shallow because
  the store exists but caches at the wrong boundary.
- minimum_evidence_chain: Cite `TaxProfileStore._cache` and `profile_for`.
- domain_expert_note: Multi-tenant cache keys are trust boundaries when cached
  values affect billing or compliance.

### SEED-CR-NC-15

- production_trigger: Credit reservation checks happen while a tenant-level
  lock is held.
- deceptive_cues: Two balance reads appear in one method and resemble a
  check-then-act race.
- required_concepts: concurrency-primitives, invariant-preservation,
  trust-boundaries.
- causal_chain: Both reads occur under `TenantLockRegistry.lock_for`, so the
  double read is a guarded validation pattern.
- why_local_review_passes: The lock scope is visible but requires tracing the
  method body, not just searching for repeated reads.
- acceptable_root_cause: Correct skip; the real credit bug is the mutation and
  ledger event ordering in `apply_credit`.
- unacceptable_shallow_answers: "Double read is always a race" ignores the
  tenant lock.
- minimum_evidence_chain: Cite `reserve_under_lock` and
  `TenantLockRegistry.lock_for`.
- domain_expert_note: Concurrency review must distinguish an unguarded
  check-then-act from a deliberately locked validation.

### SEED-CR-NC-16

- production_trigger: Hourly billing aggregation needs final bucket-level money
  rounding.
- deceptive_cues: The Decimal path looks more complex than surrounding code and
  sits near the real precision defect.
- required_concepts: numerical-computing, invariant-preservation, data-modeling.
- causal_chain: Decimal accumulation and half-even quantization in
  `_flush_bucket` are correct for bucket finalization.
- why_local_review_passes: The test proves simple bucket totals and does not
  expose the upstream float conversion.
- acceptable_root_cause: Correct skip; precision should be preserved upstream,
  not removed from the aggregator.
- unacceptable_shallow_answers: "Simplify to float" would make the real bug
  worse.
- minimum_evidence_chain: Cite `HourlyAggregator._flush_bucket`.
- domain_expert_note: Financial code often has one intentionally complex
  precision boundary and one accidental lossy boundary.

### SEED-CR-68

- production_trigger: A partitioned stale coordinator reconnects while a newer
  coordinator has already taken ownership for the tenant cohort.
- deceptive_cues: `FencingTokenManager` exists and issues current-epoch tokens.
- required_concepts: distributed-consensus, replication, ordering-guarantees.
- causal_chain: Assignment writes accept a token parameter but do not validate
  it, so lease fencing is not enforced at the write boundary.
- why_local_review_passes: The runbook obtains a token and passes it along,
  which can look sufficient in local review.
- acceptable_root_cause: State-changing writes must validate the fencing token
  at the storage boundary.
- unacceptable_shallow_answers: "Add token issuing" is shallow because tokens
  are already issued.
- minimum_evidence_chain: Cite `FencingTokenManager.validate`,
  `AssignmentStore.write_assignment`, and `FailoverRunbook.move_cohort`.
- domain_expert_note: Fencing tokens only work when the resource being written
  rejects stale epochs.

### SEED-CR-69

- production_trigger: One region acknowledges a policy snapshot while another
  targeted region still serves the previous version.
- deceptive_cues: The readiness helper accepts `required_regions` and records
  per-region acknowledgements.
- required_concepts: distributed-state, replication, state-machines.
- causal_chain: Readiness uses the maximum regional acknowledgement, so one
  caught-up region can activate the snapshot for the cohort.
- why_local_review_passes: Tests with one caught-up region pass and the helper
  name implies rollout safety.
- acceptable_root_cause: Activation must require every targeted region, quorum
  policy, or explicit cohort safety rule; max acknowledgement is insufficient.
- unacceptable_shallow_answers: "Track acknowledgements" misses the wrong
  aggregation rule.
- minimum_evidence_chain: Cite `SnapshotAckTracker.ready_for_activation`.
- domain_expert_note: Distributed rollout readiness is usually governed by the
  slowest required participant, not the fastest.

### SEED-CR-70

- production_trigger: During regional failover, old-region queue workers keep
  accepting writes after traffic starts moving.
- deceptive_cues: The runbook requests a queue freeze in the same method that
  shifts traffic.
- required_concepts: time-handling, message-queues, invariant-preservation.
- causal_chain: Traffic shifts before freeze confirmation, creating a timing
  window where old and new regions can both process writes.
- why_local_review_passes: The method contains all expected steps in a
  plausible sequence.
- acceptable_root_cause: Write freeze must be confirmed before traffic movement
  or protected by idempotent/fenced writes.
- unacceptable_shallow_answers: "Request freeze" is shallow because the issue
  is waiting for confirmation.
- minimum_evidence_chain: Cite `FailoverRunbook.move_cohort`,
  `TrafficRouter.shift`, and `QueueFreezer`.
- domain_expert_note: Failover runbooks fail at ordering boundaries, not just
  missing steps.

### SEED-CR-71

- production_trigger: A newer control plane writes a policy with a condition
  old regional replicas do not understand, then incident response rolls back.
- deceptive_cues: The serializer intentionally preserves supported legacy
  conditions and tests cover those supported fields.
- required_concepts: serialization, api-evolution, trust-boundaries.
- causal_chain: Unsupported conditions are dropped, and the legacy evaluator
  treats absence as allow rather than fail closed.
- why_local_review_passes: Compatibility tests use only supported condition
  types.
- acceptable_root_cause: Rollback serialization must preserve, reject, or
  fail-closed on unsupported policy constraints.
- unacceptable_shallow_answers: "Filter unsupported fields" is the defect when
  unsupported fields affect access.
- minimum_evidence_chain: Cite `RollbackSerializer.to_legacy_payload` and
  `LegacyPolicyEvaluator.allows`.
- domain_expert_note: Policy rollback compatibility is a security boundary
  when new constraints can be silently removed.

### SEED-CR-72

- production_trigger: A large tenant is concentrated on one shard family during
  failover.
- deceptive_cues: `CapacityPlanner` applies a conservative headroom factor and
  aggregate spare capacity looks sufficient.
- required_concepts: load-balancing, capacity-planning, multi-tenancy.
- causal_chain: `can_absorb` sums spare capacity across regions but ignores
  hot-shard affinity, so a region can pass aggregate capacity while failing for
  the tenant's actual shard placement.
- why_local_review_passes: Single-region capacity tests check aggregate
  headroom only.
- acceptable_root_cause: Failover capacity checks must model tenant/shard
  concentration and per-shard headroom.
- unacceptable_shallow_answers: "Increase safety factor" does not address
  missing affinity modeling.
- minimum_evidence_chain: Cite `RegionCapacity.hot_shards` and
  `CapacityPlanner.can_absorb`.
- domain_expert_note: Multi-tenant capacity failures often happen at hot keys
  or shard affinity, not aggregate cluster totals.

### SEED-CR-73

- production_trigger: Regions emit incident events under clock skew during a
  failover.
- deceptive_cues: The incident timeline records region, event, timestamp, and
  details, then sorts deterministically.
- required_concepts: observability-design, time-handling, distributed-state.
- causal_chain: Sorting by regional wall-clock timestamp without coordinator
  epoch, monotonic sequence, or causal parent can invert freeze and traffic
  movement order.
- why_local_review_passes: Single-clock tests produce a sensible timeline.
- acceptable_root_cause: Cross-region incident records need causal ordering
  evidence such as coordinator epoch, monotonic event IDs, or parent links.
- unacceptable_shallow_answers: "Add logging" without causality fields is too
  shallow.
- minimum_evidence_chain: Cite `IncidentTimeline.add` and `describe`.
- domain_expert_note: Incident observability must answer causality questions,
  not only timestamp questions.

### SEED-CR-NC-17

- production_trigger: Stale coordinators try to act after a newer cohort epoch
  is issued.
- deceptive_cues: Strict current-epoch validation can look like it rejects
  tokens that were valid moments earlier.
- required_concepts: distributed-consensus, ordering-guarantees,
  invariant-preservation.
- causal_chain: Rejecting old epochs is the correct fencing behavior; the real
  issue is that assignment writes do not enforce the validator.
- why_local_review_passes: The token manager tests directly prove old-epoch
  rejection.
- acceptable_root_cause: Correct skip; keep strict validation and enforce it at
  write boundaries.
- unacceptable_shallow_answers: "Allow prior epoch during grace" reopens stale
  leader writes.
- minimum_evidence_chain: Cite `FencingTokenManager.validate` and
  `test_fencing_token_manager_rejects_old_epoch`.
- domain_expert_note: Lease fencing is intentionally unforgiving after epoch
  replacement.

### SEED-CR-NC-18

- production_trigger: Readers may serve a bounded stale snapshot during config
  propagation.
- deceptive_cues: The read cache returns an older snapshot during the grace
  period and sits near rollout activation code.
- required_concepts: caching-systems, time-handling, state-machines.
- causal_chain: The stale snapshot is read-only; `can_write_with` rejects it
  for writes against the active version.
- why_local_review_passes: The tests show stale reads and stale write
  rejection together.
- acceptable_root_cause: Correct skip; bounded stale reads are safe when they
  cannot authorize writes or activation.
- unacceptable_shallow_answers: "Never serve stale config" ignores the
  read-only grace contract.
- minimum_evidence_chain: Cite `ReadConfigCache.get_for_read`,
  `can_write_with`, and its test.
- domain_expert_note: Staleness is not always unsafe; the authority boundary
  determines whether it can change state.
