# Constraints - Pactline Launch Architecture

Source: notes from Security, Legal, Infrastructure, Product Ops, and customer-facing teams. These constraints are intentionally written as they were collected, not as a resolved architecture decision.

## Business Timing And Delivery Shape

- Paid enterprise pilots start in Q4.
- Internal alpha must support 5 active customer workspaces by the end of Q2.
- Private beta should support 25 customer workspaces, each with up to 200 internal members and 500 guests.
- General launch target is 50 to 300 workspaces, with the largest rooms handling 250 active participants and 20,000 historical activity items.
- The launch team is expected to deploy multiple times per week.
- The company has one infrastructure engineer, shared across this product and the existing beta.
- The architecture should leave a path to larger customers without requiring the first version to solve every hyperscale problem.
- Product Ops needs a company-wide adoption dashboard showing daily counts of rooms created, active users, decisions approved, search queries, integration events, and notification delivery across all customer workspaces.

## Account, Identity, And Access

- Enterprise pilots require SSO using SAML or OIDC, SCIM user provisioning, role-based admin controls, and domain allowlists.
- Direct email invite should still work for smaller customers and external client guests.
- A user can belong to multiple workspaces, including workspaces owned by different customer companies.
- Guests often use personal email addresses when invited by clients.
- Removing a user should prevent future access quickly, including access through shared links, integrations, mobile cache refreshes, and notification deep links.
- Historical records should remain readable in project exports even when a person leaves, subject to legal hold and deletion requests.
- The product needs internal-only areas and client-visible areas inside the same project room.
- "Client-safe collaboration" is the phrase Sales uses for this, but pilots have not agreed on a single policy model.

## Data Handling And Residency

- The default production footprint is US.
- The UK fintech pilot asked for EU handling for customer content before signing an annual contract.
- Customer content includes notes, comments, decisions, task titles/descriptions, attachments, imported thread text, search terms, and generated summaries.
- Derived customer records include embeddings, snippets, notification bodies, audit entries, export files, and support replay data.
- Workspace configuration, billing status, feature flags, coarse usage counters, and health metrics may be processed centrally.
- Legal wants customer content and derived customer records for EU workspaces to remain in the selected EU environment.
- Durable writes for customer content should be accepted in the workspace home environment. Cross-region replication of customer content for read availability is acceptable only if the primary write stays local.
- Cross-region active-active writes for customer content are not approved for launch.
- Product wants one global login, one public app URL, and cross-workspace switching without users thinking about regions.

## Realtime Collaboration And Performance

- The room timeline should feel live for comments, tasks, decisions, presence, and approval state changes.
- Drafting a comment or note should not lose data during a short connectivity drop.
- Presence and typing indicators should update fast enough to feel alive, but they do not need to be part of the permanent record.
- For users in North America and Europe, product wants visible updates under 150 ms p95 when participants are already connected. This includes the moment a user submits a comment or decision and sees it appear confirmed in the timeline.
- Search indexing can lag by a few minutes for normal content, but decision titles and task status should appear quickly enough that the UI does not look broken after a save.
- Exports can be asynchronous and may take minutes for large rooms.

## Integrations

- Slack integration is required for the launch demo: notification routing, unfurls for Pactline links, and the ability to turn a Slack discussion into a Pactline room thread.
- Jira integration is required for launch pilots: link a Pactline task to a Jira issue, show external status, and optionally reflect Pactline comments back to Jira.
- Google Drive, Box, and SharePoint can be link-only at launch.
- Microsoft Teams integration is desirable after Slack.
- Third-party systems should not become the source of truth for Pactline decisions or access control.
- The Slack app security review currently permits storing channel IDs, user IDs, timestamps, and link metadata. Storing full Slack message bodies needs a separate review.
- Imported context is valuable during onboarding because empty rooms look unsuccessful in demos.
- Integrations need clear retry behavior because customers will disconnect and reconnect apps during rollout.

## Search, Reporting, And Export

- Search should cover rooms, comments, notes, decisions, tasks, and linked integration metadata.
- Search must respect the same access rules as the room UI.
- Project export should include final decisions, approvals, activity history, task state, participants, and linked external references.
- Audit export should support admin and legal review. It does not need a polished BI interface at launch.
- Customer-facing analytics are not launch scope beyond simple room and task status summaries.
- Internal Product Ops wants daily adoption analytics across all customers and regions.
- Support wants to filter activity by user, room, integration, and time range during incident response.

## AI And Automation

- A room summary and "what changed since I last visited" digest are the only AI-like launch candidates.
- Legal has not approved sending customer content to a third-party model API.
- Security is open to a local or customer-region model path later, but no one has staffed it.
- If summaries ship, they must be explainable enough that a project lead can find the underlying source events.
- Automated project planning, agentic task creation, and a general workspace chatbot are not launch commitments.

## Availability And Recovery

- Customers expect the product to be available during business hours with no unplanned downtime exceeding 10 minutes per month.
- Backup and point-in-time recovery for customer content must be possible within 24 hours.
- The architecture should support blue/green or rolling deployments without visible disruption during deploy windows.
- Incident response should be able to identify affected workspaces within 15 minutes of a reported issue.
- Customer Success wants an incident reconstruction tool that can replay workspace activity during a severity-one investigation, regardless of which environment hosts the workspace.

## Operations, Cost, And Vendor Constraints

- The team is comfortable with TypeScript, React, Rails, Node, Postgres, Redis, and common managed cloud services.
- The beta uses Firebase and a Rails admin app, but the beta data model is not reliable enough to preserve as-is.
- Engineering leadership prefers managed services over self-operated clusters.
- New self-managed stateful infrastructure needs an explicit on-call owner before launch.
- There is no team currently staffed to operate Kafka, Flink, Cassandra, or a custom CRDT service.
- OpenSearch or a managed search service is acceptable if the access-control and residency story is clear.
- A graph database proof-of-concept exists from the CEO's hack week, but it has not been load-tested or reviewed by Security.
- The first-year cloud budget assumes the product is successful but not yet hyperscale.
- Enterprise customers will ask about SOC 2 evidence, audit logging, access review, backup/restore, incident response, and deletion.
- For SOC 2 purposes, "derived customer records" is defined as: embeddings, search index entries, notification bodies, snippets, audit log entries, export artifacts, and support replay data generated from customer content. This classification follows the customer content wherever compliance obligations apply.

