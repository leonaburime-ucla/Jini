# Seed Ledger — cr-eval-11-regional-failover-control-plane

**Eval ID**: benchmark-suite / cr-eval-11-regional-failover-control-plane
**Purpose**: Tier 3 hard-mode Code Review fixture for weak-spec review of a
multi-region failover control plane.
**Difficulty**: Hard staff+ fixture. The brief gives SLA and operational
signals without naming consensus, fencing, or serialization invariants.

## Seeds

### SEED-CR-68

Membership reconfiguration installs a survivor view after achieving quorum
within the new (smaller) view only. Two concurrent coordinators can each
commit under their respective views because the protocol does not require
joint old/new quorum intersection. The old view remains valid for voters that
didn't participate in the reconfiguration.

Evidence: `src/failover_control_plane.py` (`MembershipJournal.install_survivor_view`
checks quorum in `target_view` only; contrast with `ready_for_destructive_epoch`
which correctly requires joint quorum).
Expected severity: Critical

### SEED-CR-69

Policy rollout commits a snapshot when durable-phase quorum is reached and
immediately publishes a `policy_committed` event. `TrafficDirector.on_event`
activates the committed policy for live traffic. However, durable means
"persisted by a quorum of replicas" — not "enforced on the serving path."
Traffic is routed under a policy that replicas have stored but may not yet be
evaluating. The `promote_to_serving` path exists and correctly requires
`SERVING`-phase quorum, but committed events bypass it.

Evidence: `src/failover_control_plane.py` (`PolicyRollout.commit_if_durable`
publishes event; `TrafficDirector.on_event` activates immediately; the
`promote_to_serving` method is the correct gate but is not in the commit path).
Expected severity: Critical

### SEED-CR-70

The `OperationJournal` deduplicates commands by
`(operation_id, cohort, public_effect)`. Both `failover_start` and
`recovery_admit` intents produce `public_effect="region_move"`. If a
recovery-admit command arrives with the same `operation_id` as a prior
failover (which is possible when the recovery retry reuses the envelope from
the triggering incident), the journal returns the earlier failover result and
skips recovery-specific side effects such as weight-based traffic admission.

Evidence: `src/failover_control_plane.py` (`OperationJournal.idempotency_key`
includes `public_effect`; `CommandIntent` uses the same `public_effect` for
semantically different operations).
Expected severity: Critical

### SEED-CR-71

Recovery admission checks whether the recovered region's replay log dominates
the required watermarks. The required watermarks are derived from
`ownership.current_streams_for(cohort)` — the streams the cohort CURRENTLY
owns. During failover, streams are reassigned to the target region. The
streams that belonged to the source at the time of the failure fence are no
longer in the current set. Recovery can be admitted before the recovered
region replays all writes that were in-flight at the failure boundary.

Evidence: `src/failover_control_plane.py` (`RecoveryGate.can_admit` uses
`current_streams_for` instead of historical streams at the drain epoch;
`OwnershipRegistry.streams_at_epoch` exists but is not called;
`FailoverRunbook._do_recovery_admit` invokes `recovery_gate.can_admit` so
the gate IS exercised — the bug is inside the gate's stream selection).
Expected severity: Critical

### SEED-CR-72

The capacity planner reads a region capacity snapshot, checks whether
per-family allocation and shared spillover fit, then reserves per-family
units. Two concurrent failover plans for different cohorts can both pass the
shared spillover check against the same snapshot because per-family
reservations are linearizable but the shared regional pool is not fenced. The
`reserve_with_shared_hold` method demonstrates the correct pattern (hold
shared pool first) but `reserve` — the method used by the failover runbook —
does not acquire the shared pool hold.

Evidence: `src/failover_control_plane.py` (`CapacityPlanner.reserve` vs
`CapacityPlanner.reserve_with_shared_hold`; the correct serialization point
exists but the primary path doesn't use it).
Expected severity: Required

### SEED-CR-73

The failure detector issues an abandonment certificate when a quorum of
witnesses report `control_plane_rtt_ms is None` (unreachable) for a source
region. The witnesses check control-plane reachability from their vantage
point, and `edge_healthy` for the target. However, control-plane
unreachability does not imply data-plane unavailability. During an asymmetric
partition, the source region can still serve customer traffic (its data plane
is up) while being unreachable from the control plane's witness quorum. The
certificate authorizes failover of a region that is still serving.

Evidence: `src/failover_control_plane.py` (`FailureDetector.abandonment_certificate`
uses `control_plane_rtt_ms is None` as the failure signal; no data-plane
health verification is performed).
Expected severity: Required

## Negative Controls

### SEED-CR-NC-17

`MembershipJournal.ready_for_destructive_epoch` requires quorum in BOTH the
old view and the new view before allowing destructive schema or policy epoch
changes. This may look over-strict or like it blocks failover progress. It
should NOT be flagged as a defect — joint consensus is the correct approach
for destructive reconfiguration. The real bug is in `install_survivor_view`
which uses only the new view.

Evidence: `src/failover_control_plane.py` (`MembershipJournal.ready_for_destructive_epoch`).

### SEED-CR-NC-18

`CapacityPlanner.reserve_with_shared_hold` acquires a shared pool hold before
per-family reservations. This may look like unnecessary double-reservation or
over-pessimistic locking. It should NOT be flagged as a defect — it is the
correct serialization point that prevents write-skew. The real bug is in
`reserve` which skips this hold.

Evidence: `src/failover_control_plane.py` (`CapacityPlanner.reserve_with_shared_hold`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
