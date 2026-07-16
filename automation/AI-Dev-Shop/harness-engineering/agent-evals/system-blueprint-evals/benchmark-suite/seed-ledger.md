# Seed Ledger - System Design Benchmark Suite

This hidden ledger describes expected seeded issues for post-run scoring.
The System Design agent under test does not see this file.

## sd-eval-1-team-collab-saas

### SD1-SEED-01 (Easy, positive_control, functional_discovery)

- Seeded issue: Core actors and resource lifecycles scattered across 3 pages of stakeholder input.
- Evidence: product-intent.md mentions admins, members, guests, contractors, support; decisions/approvals described as distinct from comments across product, design, and CS sections.
- Expected signal: Agent surfaces 5+ actor types AND models decision/approval as a first-class resource with its own lifecycle.
- CAUGHT: identifies actors, models decision state machine as distinct from comments/tasks.
- PARTIAL: identifies actors but treats decisions as generic content type.
- MISSED: lists only "users" and "admins" without guest/contractor/support distinction.

### SD1-SEED-02 (Easy, negative_control, scope_escalation)

- Seeded issue: SSO, SCIM, audit export, and guest controls look enterprise-extra but are explicit launch requirements for named pilots.
- Evidence: constraints.md "Enterprise pilots require SSO using SAML or OIDC, SCIM..." and product-intent.md naming 4 lighthouse accounts.
- Expected signal: Agent includes enterprise identity/audit in launch scope.
- CORRECT_SKIP: enterprise features included in launch scope.
- FALSE_POSITIVE: defers SSO/SCIM/audit as post-launch or "enterprise add-on later."

### SD1-SEED-03 (Medium, standard, scope_escalation)

- Seeded issue: AI chatbot, whiteboards, marketplace automation, workflow automation, file-drive replacement, advanced BI appear in stakeholder language but are explicitly excluded or unapproved.
- Evidence: product-intent.md "Initial Scope Boundaries" lists exclusions; CEO mentions AI but Legal hasn't approved; constraints.md "Automated project planning... not launch commitments."
- Expected signal: Agent explicitly defers 4+ items in non-goals.
- CAUGHT: names specific deferred items, does not pull them into topology.
- PARTIAL: defers some but sneaks AI summaries or graph DB into core.
- MISSED: includes AI/graph/event-sourcing in launch architecture without noting blockers.

### SD1-SEED-04 (Medium, standard, functional_discovery)

- Seeded issue: Decision/approval lifecycle fragmented across sources.
- Evidence: product-intent.md step 5 "proposed, discussed, approved, reopened"; CS feedback "approval where the answer becomes part of the record"; Design notes "approval is overloaded."
- Expected signal: Agent models decision as first-class resource with state machine.
- CAUGHT: separate decision/approval model with states, evidence, audit trail, export.
- PARTIAL: mentions decisions but conflates with comment threads.
- MISSED: no separate decision concept in functional model.

### SD1-SEED-05 (Medium, standard, integration_boundary)

- Seeded issue: Access policy source-of-truth question is distributed across all documents.
- Evidence: constraints.md (revocation, notification deep links, integration access); product-intent.md (client-visible vs internal, guest contributions after departure); team-context.md (Enterprise Platform owns membership but not per-object visibility).
- Expected signal: Agent surfaces access-policy ownership as BLOCKING or explicitly unresolved.
- CAUGHT: identifies access-policy source-of-truth as a blocking question.
- PARTIAL: mentions permissions but assumes workspace-level ACLs.
- MISSED: no access model discussion or assumes trivially solved.

### SD1-SEED-06 (Medium, negative_control, nfr_topology)

- Seeded issue: Mobile offline is deliberately narrow — not full offline-first.
- Evidence: product-intent.md "Product does not expect a full offline collaborative editor" and "people will be angry if an airport Wi-Fi drop deletes a written update"; constraints.md "Drafting a comment or note should not lose data during a short connectivity drop."
- Expected signal: Agent treats mobile as resilient drafts + catch-up, not CRDT architecture.
- CORRECT_SKIP: scopes mobile correctly as client-side draft persistence.
- FALSE_POSITIVE: escalates offline as BLOCKING or proposes CRDT/offline-first engine.

### SD1-SEED-07 (Medium, standard, decomposition)

- Seeded issue: Feature decomposition by surface duplicates cross-cutting contracts.
- Evidence: team-context.md "each surface will need its own version of membership checks, room lifecycle, notification routing, audit entries, export records, search indexing"; also describes beta failure from this approach.
- Expected signal: Agent proposes shared collaboration-core or identifies duplication risk.
- CAUGHT: identifies cross-cutting concern duplication, proposes shared layer or explicit contract.
- PARTIAL: lists features as domains without addressing membership/audit/export duplication.
- MISSED: proposes pure feature-per-service decomposition.

### SD1-SEED-08 (Hard, standard, tech_direction)

- Seeded issue: CEO pushes event-driven and graph DB, but constraints prohibit operating them.
- Evidence: product-intent.md CEO quotes "event-driven architecture" and "data model... as a graph"; constraints.md "no team currently staffed to operate Kafka, Flink, Cassandra, or a custom CRDT service" and "graph database proof-of-concept... not load-tested or reviewed by Security" and "1 infrastructure engineer."
- Expected signal: Agent presents conservative managed-service stack as primary, names event-driven/graph as future exploration only.
- CAUGHT: proposes managed/conservative primary option, explains operational risk of distributed-systems choices.
- PARTIAL: includes event-driven as viable launch option without surfacing staffing.
- MISSED: proposes Kafka/graph/event-sourced architecture without acknowledging constraints.

### SD1-SEED-09 (Hard, standard, nfr_topology)

- Seeded issue: US support console cannot access EU-resident incident reconstruction data without violating residency.
- Evidence chain (must connect across files):
  1. constraints.md Data Handling: "Derived customer records include... support replay data"
  2. constraints.md Operations: "derived customer records... follows the customer content wherever compliance obligations apply"
  3. constraints.md Data Handling: "Legal wants... derived customer records for EU workspaces to remain in the selected EU environment"
  4. constraints.md Availability: "incident reconstruction tool that can replay workspace activity... regardless of which environment hosts the workspace"
  5. team-context.md: "support team is based in the US office and operates from a single internal tooling deployment"
- Expected signal: Agent traces support replay → derived record → EU-resident → US console cannot access without violating residency.
- CAUGHT: explicitly identifies that US support accessing EU incident reconstruction data violates residency, surfaces as topology contradiction.
- PARTIAL: mentions residency as blocking but doesn't connect support replay specifically to derived-record classification and US console location.
- MISSED: proposes "global support console" without noting the residency conflict.

### SD1-SEED-10 (Hard, standard, sequencing_p0)

- Seeded issue: Downstream specs depend on contracts that don't exist yet.
- Evidence: team-context.md "Integrations... historically optimizes for partner demos and may build directly against whatever API exists first" plus "Engineering leadership expects [Collaboration Core] to define shared APIs/events before... build too much on top."
- Expected signal: Agent sequences shared foundations (identity, event envelope, room model) as P0.
- CAUGHT: explicit P0 sequencing with Collaboration Core contracts before integration/search specs.
- PARTIAL: mentions dependencies but no enforced sequencing.
- MISSED: allows parallel spec starts with no dependency ordering.

### SD1-SEED-11 (Hard, standard, sequencing_p0)

- Seeded issue: Enterprise Platform is a bottleneck that blocks all feature teams.
- Evidence: team-context.md "4 engineers, already committed to SSO, SCIM... close to capacity through Q3" plus every feature team needing access decisions.
- Expected signal: Agent identifies EP as bottleneck, proposes minimal shared contract in P0 or marks as BLOCKING.
- CAUGHT: identifies capacity constraint, proposes minimal policy-evaluation API contract in P0 or escalates.
- PARTIAL: lists auth in P0 but doesn't address capacity constraint.
- MISSED: doesn't mention Enterprise Platform bottleneck.

### SD1-SEED-12 (Hard, negative_control, tech_direction)

- Seeded issue: Horizontal P0 foundation looks like over-engineering but is justified.
- Evidence: team-context.md describes beta failures from lack of shared contracts, 6 teams needing parallel delivery, engineering leadership asking for shared early work.
- Expected signal: Agent accepts horizontal P0 as valid despite vertical-slice default.
- CORRECT_SKIP: accepts justified P0 foundation.
- FALSE_POSITIVE: rejects horizontal foundation as violating vertical-slice principle.

### SD1-SEED-13 (Hard, standard, nfr_topology)

- Seeded issue: Write-latency-vs-residency-vs-staffing trilemma with no satisfying single answer.
- Evidence chain (scattered across files):
  1. constraints.md Realtime: "150 ms p95... includes the moment a user submits a comment or decision and sees it appear confirmed"
  2. constraints.md Data Handling: "Durable writes for customer content should be accepted in the workspace home environment"
  3. product-intent.md Enterprise: UK fintech "London team reported that posting decisions felt noticeably slower than what US beta testers experienced"
  4. constraints.md Realtime: "Cross-region active-active writes for customer content are not approved for launch"
  5. team-context.md Infra: "Any multi-region production topology beyond a single primary with read replicas requires explicit engineering leadership approval and a staffed on-call plan"
  6. team-context.md Infra: "1 infrastructure engineer" + "Cannot responsibly add several self-managed distributed data systems"
  7. team-context.md Skills: "Thin: multi-region data architecture"
- Expected signal: Agent identifies that no single-region or multi-region option satisfies all constraints simultaneously. UK beta latency evidence proves single-region US won't meet 150ms p95 for write confirmation. EU home region would require multi-region topology needing approval + on-call that doesn't exist.
- CAUGHT: explicitly surfaces the trilemma as a named tension requiring human decision. Must either flag that EU environment triggers the multi-region approval gate + on-call staffing requirement, or present options with approval/staffing as an explicit unresolved blocker.
- PARTIAL: proposes EU environment and correctly traces latency math (may even reference UK beta), but does NOT flag that a full EU deployment IS the multi-region topology requiring approval and on-call staffing. Treats its own multi-region proposal as settled rather than a human decision checkpoint. Also PARTIAL: mentions residency or latency but doesn't connect the beta evidence to write-path.
- MISSED: proposes topology without acknowledging the conflict exists.

### SD1-SEED-14 (Distinguished, negative_control, decomposition)

- Seeded issue: Realtime Infrastructure as pure utility, not a product domain.
- Evidence: team-context.md "Does not want to own product semantics" and "Can support a managed realtime channel service if domain teams keep payload contracts stable."
- Expected signal: Agent keeps realtime as infrastructure, not a domain with business logic.
- CORRECT_SKIP: treats realtime as utility/infrastructure layer.
- FALSE_POSITIVE: proposes realtime as a domain service owning product lifecycle.

### SD1-SEED-15 (Distinguished, standard, scope_escalation)

- Seeded issue: "Client-safe collaboration" model is structurally unresolved with no clear owner.
- Evidence: product-intent.md "Cross-Company Collaboration Model" section explicitly unresolved (shared workspace vs federated); constraints.md guest/private/internal/deletion/legal-hold/export/cross-company complexity; team-context.md Enterprise Platform owns membership but not per-object visibility, no team owns guest-contribution-after-departure.
- Expected signal: Agent marks this as BLOCKING, asks clarifying questions, does NOT finalize blueprint around this boundary.
- CAUGHT: marks access/lifecycle model as BLOCKING, asks 2-3 targeted questions, withholds confident decomposition for this boundary.
- PARTIAL: mentions access complexity but proposes a model anyway without escalation.
- MISSED: picks shared-workspace or federated model silently without noting the structural uncertainty.
