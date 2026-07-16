# Team & Operations

## Team

| Role | Count | Notes |
|------|-------|-------|
| Senior backend engineer | 2 | 7+ years Python/Django, production Postgres |
| Mid-level backend engineer | 2 | 3-4 years, Django + some Go |
| Platform engineer | 1 | Owns CI/CD, AWS infra, Terraform |
| Engineering manager | 1 | Technical, reviews PRs, 30% IC |

Total: 6 people, ~5 FTE available for this project.

## Expertise

Strong: Python, Django, PostgreSQL, Celery, Redis, REST APIs, AWS (RDS,
ECS, S3, SQS), Docker, Terraform, pytest.

Moderate: Go (one engineer built the metering service), basic Kafka
consumer patterns (read from metering topic), event-driven messaging.

Weak or absent: Event sourcing in production, CQRS frameworks, distributed
sagas, Kubernetes, complex streaming, Temporal/Cadence workflow engines.

The team has run Django + Celery + PostgreSQL in production for 5 years.
They've never built an event-sourced system or operated a dedicated event
store (EventStoreDB, Axon, etc.).

## Operations

- On-call: 4 engineers in rotation. During on-call weeks, capacity drops
  to ~60%.
- The team manages 8 production services total (monolith + metering + tax +
  5 internal tools).
- Current P1 incident rate: 1.2/month across all services (0.4/month for
  billing specifically).
- Deploy frequency: monolith deploys 3x/week via CI/CD to ECS. The
  metering service deploys independently.
- Monitoring: Datadog APM + logs. PagerDuty for alerting.

## Budget

- Infrastructure: current billing infrastructure costs ~$4,200/month (RDS
  share + ECS + Celery workers). Budget for the new service: up to
  $6,000/month additional.
- No managed event-sourcing platforms (Confluent Cloud enterprise tier,
  Axon Server) are pre-approved. A managed service proposal requires VP
  approval and takes 4-6 weeks for procurement.
- Training: $3,000 per person annual allowance available.

## Timeline

- Phase 1 (shadow mode): 10 weeks. Ledger service running alongside
  monolith, writing to its own store, events flowing but monolith still
  authoritative.
- Phase 2 (cutover): 6 weeks. Ledger service becomes authoritative for
  billing writes. Monolith billing module becomes read-only.
- Phase 3 (cleanup): 4 weeks. Remove billing write code from monolith.
  Full event replay validation.

## Risk Appetite

- Leadership approved a "strangler fig" approach: no big-bang rewrite.
- The migration must not increase P1 incident rate beyond 1.5/month total.
- Shadow mode must prove zero divergence for at least 2 full billing
  cycles before cutover is approved.
