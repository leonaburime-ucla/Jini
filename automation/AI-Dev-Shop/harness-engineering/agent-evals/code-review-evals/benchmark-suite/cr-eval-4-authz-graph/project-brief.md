# Authorization Graph — Project Brief

## Overview

Review graph authorization changes that optimize permission traversal and add
inherited group relations for our multi-tenant SaaS (~200 tenants). Support
staff get time-limited emergency access during incidents. An external policy
service pushes policy envelopes. We're adding caching to reduce p99 latency on
permission checks.

## Operational Context

- Multi-tenant SaaS platform, ~200 active tenants on shared infrastructure
- Support staff need time-limited emergency access during customer incidents
- External policy service pushes policy envelopes during rolling deploys
- Delegation graphs imported from enterprise identity providers vary in depth
- Permission checks are on the hot path: target p99 < 5ms after caching
- Incident response team reconstructs access decisions from audit trail
- Revocations must take effect promptly (compliance SLA: < 60s)

## Requirements

1. Direct role assignments grant permissions within the assigned tenant.
2. Delegated support roles inherit permissions through group relations in the
   role graph.
3. Support staff receive time-limited emergency access during incidents, scoped
   to the affected tenant with audit metadata.
4. External policy envelopes control which permissions are available per tenant.
5. Decision caching reduces repeated graph traversals on the hot path.
6. Revocations and policy updates take effect within the compliance window.
7. Delegation traversal remains performant even with deep enterprise graphs.

## Spec Hash

`spec-authz-graph-v2-f83a17`
