# Product Intent - Pactline Team Collaboration SaaS

Source: combined operating brief from Product, GTM, Design, Customer Success, and the CEO's staff meeting notes. This is not a final PRD. It is the source material for a system blueprint pass before individual feature specs are written.

## Company Context

Pactline is a Series B startup selling work coordination software to teams that collaborate across companies: agencies with clients, consulting firms with project sponsors, fintech operations teams with external reviewers, and product teams working with vendors. We have traction from a lightweight beta that combined project rooms, comments, and decision notes. The beta is not production architecture; it is a Firebase app with a small Rails admin back office and a few Zapier-style automations.

The business outcome for the next two quarters is to turn the beta into a paid enterprise product that can support 50 to 300 workspaces at launch, with a path to 1,000+ workspaces in the following year. The sales team is pushing for a launch SKU at $20 to $35 per active user per month, plus enterprise add-ons for SSO, SCIM, audit exports, and data residency. Leadership wants the product to feel like a "shared operating room" for projects, not another chat app.

The CEO keeps describing the product as "Slack, Notion, and Asana for client-facing work, but with decisions that do not disappear." Product has been trying to narrow that into a launch shape:

- A workspace has people, teams, client guests, projects, rooms, and shared artifacts.
- A project room is where the work happens. It has a feed, a lightweight doc surface, tasks, decisions, and pinned context.
- Members can mention people, assign follow-ups, request approval, and link work to external systems.
- Guests should be first-class enough to collaborate without seeing internal-only material.
- Admins need enough control for IT and Legal to approve customer pilots.

## Customer Signals

Customer Success summarized the strongest beta feedback:

- "I can see the final decision, but not why it happened."
- "Client guests keep asking for status in email because they cannot tell what changed."
- "We need a place to ask for approval where the answer becomes part of the record."
- "Our consultants need to keep working while travelling, then catch up cleanly when online."
- "Security reviewed the beta and said external users need a more predictable access model."
- "Search is only useful if it finds decisions, comments, docs, and tasks together."
- "The Slack integration cannot just dump links. It needs enough context that people know whether to open Pactline."

The strongest sales objection is not missing chat. It is trust: customers are comfortable trying the beta for a client project, then stop when they ask who can see what, what happens when a contractor leaves, whether a client can export their side of the record, and whether the product can prove who approved a decision.

## Launch Experience

The first paid launch should support a full lifecycle for a client-facing project:

1. An admin creates a workspace, sets allowed domains, enables SSO or invites directly, and creates a project room.
2. Internal members add client guests and contractors to the room.
3. The room starts with a short kickoff note, imported context, or a template.
4. Participants discuss work in threads, write short living notes, create tasks, and mark decisions.
5. A decision can be proposed, discussed, approved, reopened if needed, and later referenced from a task or doc.
6. A task can be assigned to an internal member or guest, connected to a decision, and optionally mirrored to Jira.
7. People get notifications in Pactline, email, Slack, or Microsoft Teams depending on workspace settings.
8. Admins and project leads can review activity, export a record for the project, and remove access when someone leaves.

Design wants the first screen inside a room to be a combined activity timeline with filters, not separate tabs for every object. The timeline should show comments, doc edits, decisions, task changes, approvals, and integration activity. Product is open to separate creation flows behind the scenes if the experience stays coherent.

The mobile requirement is mostly about catch-up and travel. Field teams and consultants should be able to open recent rooms, read recent notes and decisions, draft comments, and avoid losing typed text when connectivity drops. Product does not expect a full offline collaborative editor in the first launch, but people will be angry if an airport Wi-Fi drop deletes a written update.

## Enterprise Readiness

GTM has four named lighthouse accounts:

- A US consulting firm with 1,200 employees and 300 external client users. They need SSO, SCIM, audit export, and strong guest controls.
- A UK fintech operations group with 700 users. They asked for EU data handling for customer content and a security questionnaire by the end of Q3. During the beta, their London team reported that posting decisions felt noticeably slower than what US beta testers experienced.
- A design agency with 180 employees and 900 rotating client guests. They need client rooms to be easy to set up, and they want branded exports.
- A healthcare vendor management team with 400 users. They need legal hold language and are sensitive about support staff seeing project content.

Sales has promised that the launch product will not require a customer to replace Jira, Google Drive, Slack, or Microsoft Teams. It should connect to those tools where helpful. The long-term story is to become the system of record for project decisions and client-visible status, not the system of record for source code, invoices, HR, or file storage.

Security and Legal want the product framed as "collaboration records" rather than "general-purpose document storage." File uploads should be limited at launch. Linking to Drive, Box, SharePoint, or a customer's existing files is acceptable. Native attachments are useful for screenshots, PDFs, and signed statements, but nobody wants to build a full digital asset manager this year.

## Stakeholder Notes

Product:

- The core launch should make cross-company work feel organized without forcing every customer into a rigid workflow.
- Decisions and approvals matter. A comment thread with a green checkmark is not enough.
- Project rooms need templates, but template authoring can be basic.
- We should support workspace-level and project-level settings. Avoid room-level custom policy unless there is no other way.
- Activity history must be understandable by a project lead, not only by an auditor.

Design:

- The product should feel live. Presence, typing indicators, fresh notifications, and optimistic UI are important.
- The timeline should not jump around or reorder in surprising ways.
- Guests should know whether they are writing to a client-visible area or an internal area.
- Search should feel universal from day one, even if advanced filters come later.
- The phrase "approval" is overloaded. We need room in the model for "approved by client", "approved by internal lead", and "acknowledged by all required people."

Customer Success:

- Support needs to reconstruct "what happened" for a project without asking engineering to query production.
- Project leads ask for a clean export when a client engagement ends.
- Admins will call us when a user is removed but still appears in old mentions, assignee fields, or exported records.
- Some customers want client guests to see only final decisions and assigned tasks, not the internal discussion that produced them.

Sales:

- The launch demo needs Slack and Jira integrations. For Slack, people expect unfurls, notifications, and pushing a thread into Pactline. For Jira, they expect linked task status and comments, not complete issue management.
- SSO is not optional for the first enterprise pilots.
- A Microsoft Teams integration can come after launch if Slack support is strong.
- The buyer does not want a lecture about distributed systems. They want the product to feel fast and secure.

CEO:

- "We should be the memory layer for high-stakes teamwork."
- "If AI can summarize a room or tell me what changed since Friday, that is compelling, but I do not want the launch delayed by a science project."
- "The data model should understand people, rooms, work, decisions, and commitments as a graph."
- "I keep hearing event-driven architecture is how products like this scale. I want us to avoid rebuilding everything in a year."

Engineering leadership:

- We need a production architecture that the current team can operate.
- The beta has useful product lessons, but the data model is not a migration source of truth.
- A single coherent workspace and permission model matters more than shipping five disconnected surfaces.
- We should expect real-time collaboration, background jobs, integrations, search, audit, exports, and admin tooling, but the launch should stay narrow enough to finish.

## Cross-Company Collaboration Model

The product serves teams that work with external parties. Pactline should make cross-company collaboration feel natural, but the exact boundary between "shared workspace" and "federated workspaces with linked rooms" has not been resolved. Some stakeholders want one workspace with mixed internal/external members. Others want each company to own its workspace and share specific rooms into a joint view.

The GTM team says the consulting firm account needs client guests inside the firm's workspace. The fintech account might prefer each engagement to exist in its own shared space. Design says either model could work if permissions are clear. Engineering has not committed to one approach because it changes the data model, the access model, and the export story.

## Initial Scope Boundaries

Launch must cover project rooms, activity timelines, notes/docs, threaded comments, tasks, decisions, approvals, guest access, admin controls, notifications, core integrations, search, audit history, and project export.

Launch should not include billing, a public marketplace, full enterprise workflow automation, long-form document publishing, whiteboards, video meetings, CRM replacement, file-drive replacement, advanced BI dashboards, or a general chatbot that answers arbitrary customer questions.

The team is still discussing how much "AI catch-up" belongs in launch. The most concrete request is a room summary and "what changed" digest for project leads. Legal has not approved sending customer content to a third-party model provider. Product would rather ship a manual digest than miss the enterprise launch window.

