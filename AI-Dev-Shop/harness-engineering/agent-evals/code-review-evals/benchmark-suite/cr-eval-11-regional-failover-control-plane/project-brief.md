# Regional Failover Control Plane — Project Brief

## Overview

Review a regional failover control plane for a multi-region SaaS platform. The
system coordinates tenant cohort membership across regions, propagates policy
snapshots through a durable-then-serving rollout pipeline, moves traffic during
regional incidents, admits recovered regions back into rotation, and plans
capacity for failover absorption.

## Operational Context

- Regions: `us-east`, `eu-west`, and `ap-south`
- Availability target: 99.99% control-plane availability
- Failover trigger: abandonment certificates issued by witness quorum when a
  region is unreachable. Customer-facing traffic moves without support
  intervention.
- Coordinators: one active coordinator per tenant cohort. During brownouts,
  multiple coordinators may attempt recovery concurrently. Survivor sets can
  shrink the active membership when a region is permanently lost.
- Policy rollout: snapshots move through received → durable → serving phases.
  Traffic should only be governed by policy that replicas are actively enforcing.
- Recovery: after a regional incident, the recovered region must replay
  buffered writes before rejoining live traffic. Workers restart on deploy and
  can resume from watermarks.
- Capacity: simultaneous cohort failovers can happen during large incidents.
  Tenant shard families have affinity; capacity is not fungible across families.
- Incident review: postmortems must reconstruct the causal order of freeze,
  traffic shift, drain, and assignment writes even when clocks disagree.

## Requirements

1. Membership reconfiguration must not allow two views to both hold valid
   quorums over the same cohort simultaneously.
2. Policy enforcement on the traffic-serving path should reflect what replicas
   are actually evaluating, not just what they have persisted.
3. Command replay and idempotency must distinguish semantically different
   operations even when their external effect appears identical.
4. Recovery admission must verify that the recovered region has replayed all
   writes that were in-flight at the failure boundary, not just current state.
5. Capacity reservations during concurrent failovers must serialize access to
   shared regional resources, not just per-family allocations.
6. Failure detection should not promote a region that is still actively serving
   customers, even if it is unreachable from the control plane's perspective.

## Spec Hash

`spec-regional-failover-control-plane-hardmode-v2-b74e31`
