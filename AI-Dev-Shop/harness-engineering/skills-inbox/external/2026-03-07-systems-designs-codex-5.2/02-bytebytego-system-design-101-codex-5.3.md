# Distilled Learnings: ByteByteGoHQ / system-design-101 (codex-5.2, deep pass)

Source repo: https://github.com/ByteByteGoHq/system-design-101

## 1) What This Source Adds Beyond Traditional Primers
- It is a very broad, topic-indexed map of production system design, organized around practical comparisons and case studies.
- It is especially strong for interface-level decisions:
  - API styles (`REST`, `GraphQL`, `gRPC`, `RPC`)
  - traffic controls (load balancer vs API gateway vs reverse proxy)
  - realtime transports (polling, SSE, WebSocket, webhooks)
- It includes many architecture retrospectives (Netflix, Uber, Twitter, Discord, YouTube) that reveal pattern evolution over time.

## 2) High-Value Learnings to Encode

### 2.1 Protocol and API style must follow interaction model
- Use request/response simplicity as default (`REST`) for broad client compatibility.
- Use projection-heavy, multi-client frontends for `GraphQL`.
- Use internal low-latency service contracts for `gRPC`/RPC.

Skill gate:
- Every architecture answer must explicitly justify API style by consumer shape, latency needs, and contract strictness.

### 2.2 Edge components are not interchangeable
- Load balancer distributes traffic.
- Reverse proxy handles edge termination/routing/caching concerns.
- API gateway enforces policy, auth, quotas, and request governance.

Skill gate:
- Require a dedicated “edge responsibility map” section in outputs.

### 2.3 Realtime delivery is a portfolio decision
- Short polling/long polling: simple compatibility, higher overhead.
- SSE: one-way server push for stream updates.
- WebSocket: full duplex realtime session channel.
- Webhooks: server-to-server event push.

Skill gate:
- Require explicit transport selection and fallback path per event channel.

## 3) Concrete Architecture Examples
- Notifications platform:
  - producer API -> queue -> channel workers -> provider adapters.
  - active clients via WebSocket, inactive clients via push/email.
- Public multi-tenant API:
  - gateway auth + quotas + idempotency keys + structured error model.
  - LB/reverse proxy behind gateway for routing and resilience.
- Media/content app:
  - CDN for static delivery, object storage for media origin.
  - async pipelines for transcoding/thumbnailing/index updates.

## 4) Anti-Patterns and Fixes
- Anti-pattern: “GraphQL everywhere.”
  - Fix: use per-surface contract strategy; keep internal service-to-service on simpler RPC when appropriate.
- Anti-pattern: conflating gateway and load balancer roles.
  - Fix: separate policy-plane and traffic-plane responsibilities.
- Anti-pattern: shipping realtime features with no degraded mode.
  - Fix: define transport fallback chain and stale-state UX behavior.
- Anti-pattern: API design without idempotency/rate controls.
  - Fix: enforce idempotency for mutating endpoints and explicit quota policy.

## 5) Decision Matrix (Skill-Ready)

| Decision | Default | Escalate To | Required Caveat |
|---|---|---|---|
| Public API style | REST | GraphQL when client projection complexity dominates | versioning/error model required |
| Internal service calls | gRPC/RPC | async event flow for slow side effects | timeout/retry semantics required |
| Realtime updates | SSE/WebSocket by directionality | webhooks for inter-service push | fallback channel required |
| Edge control | LB + reverse proxy | API gateway for policy-heavy APIs | auth/rate/idempotency must be declared |

## 6) Drop-In Skill Contract Additions
```md
## Interface and Edge Decisions
- API style and why
- Realtime/event transport and fallback
- LB/proxy/gateway role split
- Auth, quotas, idempotency policy
- Failure/degraded mode behavior
```

## 7) Merge Guidance for Final System-Design Skill
- Use this source to strengthen API/edge/realtime decision quality.
- Merge with the primer seed (`01`) for sizing, consistency, and failure-mode rigor.
- Keep this source as tactical pattern coverage, not as a single authoritative architecture doctrine.

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/ByteByteGoHq/system-design-101
- Primary source file: https://raw.githubusercontent.com/ByteByteGoHq/system-design-101/main/README.md
