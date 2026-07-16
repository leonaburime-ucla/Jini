# System Blueprint: <project-name>

- Status: DRAFT | APPROVED
- Date: <ISO-8601 UTC>
- Author: System Design Agent
- Scope: Greenfield | Existing codebase extension
- Next Action: Human reviews and approves blueprint boundaries before Spec decomposition

---

> Why this artifact exists: writing detailed specs before macro system shape is clear frequently creates wrong boundaries and wrong spec granularity. This blueprint aligns scope, ownership, and decomposition before spec writing.

## 1) System Goal

- Problem statement:
- Intended users:
- Business outcome:
- Non-goals:

## 2) Scope and MVP Boundary

- In-scope for MVP:
- Deferred to later phases:
- Explicit exclusions:

## 3) Functional Discovery Model

Use this section to model what the system must do before deriving domains,
APIs, or data models. Mark each category `Applicable`, `N/A`, or `Unknown`.
For `Unknown`, classify it as `BLOCKING`, `SAFE DEFAULT`, or `DEFERRED`.

### 3.1 Category Coverage

| Category | Status (Applicable/N/A/Unknown) | Summary / Rationale | Unknown Class |
|---|---|---|---|
| Actors / user types | | | |
| User goals and capabilities | | | |
| Core workflows / user journeys | | | |
| Resources and operations | | | |
| Permissions and ownership | | | |
| Resource lifecycle / state | | | |
| Business rules, validations, limits, invariants | | | |
| Error, exception, and recovery flows | | | |
| Communication / collaboration | | | |
| Search, reporting, dashboards, analytics | | | |
| Integrations and external dependencies | | | |
| Admin, support, moderation, operations | | | |
| Audit, history, compliance evidence | | | |
| Settings, preferences, configuration | | | |
| Account and data lifecycle | | | |

### 3.2 Actors, Goals, and Capabilities

| Actor / User Type | Goal | Capabilities Needed | Notes |
|---|---|---|---|
| | | | |

### 3.3 Core Workflows

Propose the likely main flows, then ask the human to correct or confirm them.

| Workflow ID | Trigger / Actor | Flow Summary | Main Resources | Important Alternate / Failure Paths |
|---|---|---|---|---|
| | | | | |

### 3.4 Resources and Operations

Derive resources from workflows and business rules. Do not start by guessing
tables or endpoints.

| Resource | Who Creates / Owns It | Operations (create/view/update/delete/submit/approve/cancel/archive/search/import/export/etc.) | Lifecycle / Statuses | Notes |
|---|---|---|---|---|
| | | | | |

### 3.5 Rules, Exceptions, and Assumptions

| Item | Type (rule/validation/limit/invariant/exception/assumption) | Applies To | Behavior / Default | Unknown Class |
|---|---|---|---|---|
| | | | | |

> Clarification guard: ask at most 5 blocking questions per blueprint pass.
> For non-blocking ambiguity, record a safe default assumption and continue.
> Unknowns involving a new dependency, domain ownership boundary, external
> integration, durable data schema, migration boundary, auth/trust boundary, or
> source-of-truth decision remain `BLOCKING`; do not classify them as
> `SAFE DEFAULT` to bypass the question cap.
> If more blocking questions remain after the cap, keep them in this section and
> leave Functional model status `BLOCKED`.

### 3.6 Non-Functional Requirements Discovery

Run the NFR discovery light pass. Do not load NFR references during the light
pass. Trigger targeted deepening only when risk signals are present or the
human/Coordinator asks for depth.

#### 3.6.1 Light Pass

| Category | Status (Applicable/N/A/Unknown) | Summary / Assumption | Unknown Class | Downstream Owner |
|---|---|---|---|---|
| Scale / Capacity | | | | |
| Performance / Latency | | | | |
| Availability / Uptime | | | | |
| Reliability / Fault Tolerance | | | | |
| Consistency / Freshness | | | | |
| Durability / Disaster Recovery | | | | |
| Security | | | | |
| Privacy | | | | |
| Data Integrity | | | | |
| Compliance / Auditability | | | | |
| Observability | | | | |
| Operability / Deployability | | | | |
| Maintainability / Evolvability | | | | |
| Cost / Resource Efficiency | | | | |
| Interoperability / External Integrations | | | | |
| Portability / Environment Constraints | | | | |
| Usability / Accessibility | | | | |
| Testability / Verifiability | | | | |

#### 3.6.2 Risk Signals

- Risk signals detected:
- Deep pass triggered: YES | NO
- Blocking NFR questions asked (max 5):
- Blocking NFR questions not yet asked because of cap:

#### 3.6.3 Deep Pass Records (Only For Triggered Categories)

| Category | Requirement / Target | Assumption | Measurement / Evidence | Risk If Missed | Priority | Unknown Class | Downstream Owner |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 4) Existing-Codebase Evidence (required when Scope is Existing codebase extension)

- CodeBase Analyzer reports consumed:
- Migration reports consumed:
- Testability reports consumed:
- If no CodeBase Analyzer evidence was consumed, no_analysis_reason:
- Sampling caveats that affect this blueprint:
- Critical/High findings that affect feature boundaries:
- Migration/testability constraints to preserve in Spec and Software Architect handoff:

---

## 5) Macro Components / Domains

| Domain / Component | Responsibility | Owner Suggestion | Notes |
|---|---|---|---|
| | | | |

## 6) Domain Boundaries and Ownership

- Bounded contexts:
- Data ownership by domain:
- Boundary rules (what cannot be shared directly):
- [OWNERSHIP UNCLEAR] markers (if any):

## 7) Integration Map

| From | To | Contract Type (API/Event/Batch) | Criticality | Notes |
|---|---|---|---|---|
| | | | | |

## 8) Data and Runtime Topology (High-Level)

- Data shape direction (relational/document/stream + why; derived from workflows/resources/rules above):
- Runtime topology (frontend/backend/workers/jobs):
- External systems (identity, notifications, storage, CRM, analytics, internal systems, third-party providers, etc.):

## 9) Technology Direction

- Suggested stack direction (optional):
- Why this direction is plausible:
- Unknowns requiring later ADR validation:
- Dominant quality attributes derived from the NFR table for later ADR scoring (max 3, no scores):

## 10) Risks and Unknowns

| Risk | Type (scope/ownership/integration/scale) | Severity | Mitigation / Next Step |
|---|---|---|---|
| | | | |

## 11) Core/Foundation Spec (P0, required)

Define the required shared foundation that must be built and merged before parallel domain slices begin.

- Required core scope:
  - repository/project shell setup
  - global routing/layout shell
  - shared runtime primitives (config/env/logging)
  - shared clients/adapters (for example DB/auth client initialization)
  - CI/test harness bootstrap needed by downstream slices
- Why this must block parallel slices:

> Hard boundary: `P0` must stay thin. It may include shared shell/runtime primitives and shared clients only. It must not include feature-specific business logic or feature-owned schema/tables.

## 12) Critical User Journeys (Cross-Domain)

List end-to-end user journeys that cross domain boundaries and must be validated after slices converge.

| Journey ID | Flow (example: Signup -> Browse -> Checkout) | Domains Touched | Criticality | QA/E2E Priority |
|---|---|---|---|---|
| | | | | |

## 13) Spec Decomposition Plan

Define which specs should be written next and at what granularity.

| Spec Package | Domain | Priority (P0/P1/P2/P3) | Why separate | Depends on |
|---|---|---|---|---|
| | | | | |

> Rule: include one explicit `Core/Foundation` package at `P0`. Domain slices (P1+) depend on it.
> Rule: if `Depends on` is non-empty, the package must be sequenced after its dependency and cannot be in the same parallel wave.
> Rule: if a package requires a foreign key or contract dependency on another domain-owned resource, list that owner in `Depends on` and place this package in a later phase.

## 14) Handoff to Spec Agent

- Functional model status: COMPLETE | COMPLETE WITH SAFE DEFAULTS | BLOCKED
- NFR model status: COMPLETE | COMPLETE WITH SAFE DEFAULTS | BLOCKED
- Safe default assumptions Spec should preserve:
- Approved boundaries to preserve:
- Existing-codebase evidence Spec must cite:
- Existing-codebase evidence Software Architect must consume:
- Open decisions that Spec should mark with `[NEEDS CLARIFICATION]` if unresolved:
- Recommended sequencing for spec creation:

## 15) Approval

- Human reviewer:
- Decision: APPROVED | REVISE
- Notes:
