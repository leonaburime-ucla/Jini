# Team Context - Pactline Delivery Organization

Source: Engineering planning notes for the first two quarters of productization. This describes teams, ownership, staffing, and near-term delivery pressure.

## Current Engineering Groups

### Workspace Experience

- 6 engineers: 3 frontend, 2 full-stack, 1 product designer embedded part time.
- Owns the room UI, timeline UX, notes surface, task UI, decision UI, and mobile web experience.
- Strongest team for shipping customer-visible workflows quickly.
- Does not own identity, authorization, audit, notification delivery, search infrastructure, or external integration apps.
- Product would like this team to work in vertical slices because demos need visible progress.

### Enterprise Platform

- 4 engineers, already committed to SSO, SCIM, workspace administration, roles, audit export, legal hold, and deletion workflows.
- Owns the long-term model for workspace membership and policy evaluation.
- Has limited capacity for feature teams that need custom per-object access behavior.
- Security reviews from lighthouse customers are routed through this team.
- On-call experience is good, but the team is close to capacity through Q3.

### Collaboration Core

- 4 backend engineers, newly formed from the beta team.
- Expected to own durable collaboration records, room activity, decision state, task state, comments, and exportable project history.
- Knows the beta failure modes well: duplicated comments after reconnect, missing actor names in exports, and rooms that became impossible to cleanly delete.
- Has limited frontend bandwidth.
- Engineering leadership expects this team to define shared APIs/events before Workspace Experience and Integrations build too much on top.

### Realtime Infrastructure

- 2 engineers under Developer Platform.
- Owns WebSocket gateway, connection management, fanout libraries, and basic presence primitives.
- Does not want to own product semantics such as task state, approval transitions, comment visibility, or decision reopening rules.
- Can support a managed realtime channel service if domain teams keep payload contracts stable.
- Has no capacity to build a custom collaborative editor engine this year.

### Integrations

- 3 engineers reporting through Partnerships.
- Owns Slack app, Jira app, OAuth connections, webhook ingestion, and integration settings.
- Has a launch demo commitment for Slack unfurls and Jira-linked tasks.
- Historically optimizes for partner demos and may build directly against whatever API exists first.
- Does not own workspace permission policy, room lifecycle, audit history, or export semantics.

### Search And Data

- 2 engineers.
- Owns search indexing, internal adoption analytics, and data pipelines for product operations.
- Does not operate 24/7 services independently.
- Prefers clear immutable events or change feeds over querying feature-owned tables ad hoc.
- Needs access-policy information attached to indexed records, but does not want to be the source of truth for access decisions.

### Infrastructure And Release

- 1 infrastructure engineer plus rotating support from backend leads.
- Owns CI/CD, production environments, secrets, basic observability, backups, and incident response process.
- Can support Postgres, Redis, object storage, managed search, managed queues, and cloud-native networking.
- Cannot responsibly add several self-managed distributed data systems before Q4.
- Any multi-region production topology beyond a single primary with read replicas requires explicit engineering leadership approval and a staffed on-call plan before deployment.
- Wants simple rollback paths and additive schema changes during launch.

## Delivery Expectations

Leadership wants visible progress every month:

- Month 1: workspace setup, room shell, basic membership, live timeline skeleton, initial audit event shape.
- Month 2: comments, notes, decisions, tasks, notifications, and basic search in internal alpha.
- Month 3: SSO/SCIM pilot readiness, Slack unfurls, Jira-linked tasks, export prototype, and access review for guests.
- Month 4: private beta with customer data, support tooling, resiliency hardening, and security questionnaire evidence.

Product managers originally proposed feature tracks by surface:

- Rooms and timeline
- Notes and comments
- Tasks and Jira
- Decisions and approvals
- Search and reporting
- Admin and security
- Integrations

Engineering leads are worried that each surface will need its own version of membership checks, room lifecycle, notification routing, audit entries, export records, search indexing, and integration events. The company has already seen this in the beta: fast demos produced inconsistent deletion, room membership drift, and support exports that disagreed with the UI.

## Operating Norms And Constraints

- The company prefers small teams with clear ownership.
- Teams can share libraries, but shared runtime ownership must have an on-call owner.
- Product wants to avoid a "platform team says no" dynamic.
- Security will block customer pilots if access review, audit, and deletion flows are not credible.
- The Partnerships team will keep pushing for integration demos even when core APIs are not stable.
- The CEO is comfortable with bold technology choices but expects Engineering to explain delivery and operating tradeoffs.
- Customer Support needs admin and incident tools before private beta, not after general availability.
- The support team is based in the US office and operates from a single internal tooling deployment. They are not staffed for regional console instances.

## Skills And Gaps

- Strong: React, TypeScript, Rails, API design, Postgres, Redis, background jobs, OAuth apps, standard web security, managed cloud operations.
- Moderate: event-driven application design, search indexing, SAML/SCIM, audit exports, data retention.
- Thin: multi-region data architecture, realtime conflict resolution, custom CRDTs, large-scale stream processing, graph database operations, running 24/7 data infrastructure.
- Missing owner: generalized AI system, custom collaborative editing engine, data warehouse platform, self-managed Kafka/Flink/Cassandra, cross-region consistency platform.

## Planning Pressure

The fastest demo path is to let each feature team ship its own data model and then reconcile later. The most conservative path is to make Enterprise Platform approve every object and policy before Workspace Experience starts. Both approaches have stalled previous initiatives.

Engineering leadership wants the blueprint to identify what must be shared early, what can be feature-owned, and what can wait. Product wants enough sequencing detail that it can staff specs without assigning every package to the same bottleneck team.

