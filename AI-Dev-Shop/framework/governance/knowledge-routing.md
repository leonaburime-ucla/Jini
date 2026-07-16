# Knowledge Routing Guide

- Version: 1.0.0
- Authority: This file is the single source of truth for where memory updates go.
- Last Updated: 2026-02-23

Any time a user says "remember this", "note this", "add this to memory", or gives a standing instruction, STOP. Read this file before writing anywhere. This file determines the destination. Writing memory to the wrong location is a routing violation — treat it with the same severity as a spec hash mismatch.

For host-project runs, the authorized memory store is the sibling project workspace at `<ADS_MEMORY_ROOT>` (default: `ADS-memory/` next to the toolkit). The toolkit's own `project-knowledge-template/` tree is framework reference material and is not the default write target for host-project memory.

---

## Routing Table

| Content Type | Destination File | Entry Format |
|---|---|---|
| Stable conventions that every agent must follow going forward | `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` | `- YYYY-MM-DD: [CONVENTION] <fact>` |
| Project-specific gotchas, integration quirks, non-obvious platform behavior | `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` | `- YYYY-MM-DD: [GOTCHA] <fact>` |
| Standing constraints (security, compliance, performance, platform limits) | `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` | `- YYYY-MM-DD: [CONSTRAINT] <fact>` |
| Architectural patterns or tech decisions ratified for this project | `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` | `- YYYY-MM-DD: [PATTERN] <fact>` |
| Failures, recurring error clusters, postmortems, what broke and why | `<ADS_MEMORY_ROOT>/knowledge/learnings.md` | `- YYYY-MM-DD: [FAILURE] <what/why/resolution>` |
| Agent output quality lessons — what a specific agent does wrong repeatedly | `<ADS_MEMORY_ROOT>/knowledge/learnings.md` | `- YYYY-MM-DD: [AGENT-LESSON] <agent> — <what and why>` |
| Spec gaps that caused downstream failures | `<ADS_MEMORY_ROOT>/knowledge/learnings.md` | `- YYYY-MM-DD: [SPEC-GAP] <gap description and resolution>` |
| Open questions awaiting a human decision | `<ADS_MEMORY_ROOT>/knowledge/project_notes.md` | `- YYYY-MM-DD: [OPEN] <question — owner — target date>` |
| Deferred decisions: known issue, not urgent, no owner yet | `<ADS_MEMORY_ROOT>/knowledge/project_notes.md` | `- YYYY-MM-DD: [DEFERRED] <what is deferred and why>` |
| Parking lot items: things to revisit after current work | `<ADS_MEMORY_ROOT>/knowledge/project_notes.md` | `- YYYY-MM-DD: [PARKING] <item>` |
| Significant pipeline decisions (architecture, technology, spec direction) | `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` | `[DECISION]` entry per schema in `memory-schema.md` |
| Structured failure log for Observer pattern tracking | `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` | `[FAILURE]` entry per schema in `memory-schema.md` |
| Constitution compliance events (exceptions, violations) | `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` | `[CONSTITUTION]` entry per schema in `memory-schema.md` |
| Agent quality scores from LLM-as-judge passes | `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` | `[QUALITY]` entry per schema in `memory-schema.md` |

---

## FORBIDDEN Destinations

The following files MUST NEVER receive project memory, user instructions, learned conventions, or standing rules. Writing to them to "remember something" corrupts the framework itself.

| File / Location | Why It Is Forbidden |
|---|---|
| `AGENTS.md` | Framework operating instructions. Changes require an explicit framework upgrade decision, not a memory write. |
| `CLAUDE.md` | Claude Code entry point. Contains only bootstrap instructions. Never a memory target. |
| Any `agents/*/skills.md` | Agent-specific SOPs. Conventions belong in project-knowledge-template files, not inside agent definitions. Updating a skills.md to remember a project fact couples project state to a framework file. |
| Any `skills/*/SKILL.md` | Shared skill definitions. These are framework primitives, not project-specific stores. |
| Any file under `framework/templates/` | Templates generate artifacts. They must remain project-agnostic. |
| Any file under `framework/workflows/` | Pipeline workflow definitions. Same reason as templates. |
| Any provider-defined planning artifact (for example `specs/*/feature.spec.md`, `openspec/**`, or BMAD planning files) | Planning artifacts are immutable ground truth for a specific version. They are not memory stores. |
| Any ADR file | ADRs are point-in-time architecture decisions. They are not updated to store new facts. |
| Any test file | Tests encode spec behavior. They are not memory stores. |
| Any source code file | Source code implements specs. Memory does not belong in source. |

**If you are unsure whether a file is forbidden:** ask yourself "does this file belong to the framework or to the host project?" Framework files are forbidden. For host-project runs, `<ADS_MEMORY_ROOT>/knowledge/` is the only authorized memory store.

---

## Decision Tree

Use this tree every time content needs to be written to memory.

```
Is the content a standing instruction from the user ("always do X", "never do Y", "remember that Z")?
├── YES → Is it a convention, gotcha, constraint, or architectural pattern?
│         ├── YES → project_memory.md
│         └── NO  → Is it a question or deferred decision?
│                   ├── YES → project_notes.md
│                   └── NO  → It warrants structure → use memory-schema.md to select entry type → memory-store.md
└── NO  → Did something fail, break, or produce a postmortem-style lesson?
          ├── YES → learnings.md (human-readable summary)
          │         AND memory-store.md [FAILURE] entry (structured, searchable)
          └── NO  → Is it a significant pipeline decision (architecture, tech, spec direction)?
                    ├── YES → memory-store.md [DECISION] entry
                    └── NO  → Is it an open question or parked item needing future resolution?
                              ├── YES → project_notes.md
                              └── NO  → Clarify with user what type of content this is before writing anywhere
```

---

## Routing Examples

### Correct Routing

**User says:** "Remember that this project uses Postgres 15 and JSONB columns for audit logs."

Routing: `project_memory.md`
Entry: `- 2026-02-23: [CONSTRAINT] Postgres 15 with JSONB columns for audit logs. Do not use separate audit tables.`
Reason: Stable project-specific constraint every agent needs to know.

---

**User says:** "The TDD Agent keeps writing unit tests instead of integration tests. Remember this."

Routing: `learnings.md`
Entry: `- 2026-02-23: [AGENT-LESSON] TDD Agent — repeatedly writes unit tests for AC items that require integration-level tests. Root cause: vague AC phrasing. Fix: ensure each AC includes the boundary being tested (e.g., "at the HTTP handler layer").`
Reason: Agent quality lesson from a recurring failure pattern, not a standing convention.

---

**User says:** "We haven't decided whether to use Kafka or SQS yet. Parking this."

Routing: `project_notes.md`
Entry: `- 2026-02-23: [DEFERRED] Message queue technology (Kafka vs SQS) — no decision yet. Owner: unassigned. Revisit when FEAT-004 messaging spec begins.`
Reason: Deferred decision with no current owner.

---

**User says:** "We decided to use Stripe over Braintree for checkout."

Routing: `memory-store.md` with `[DECISION]` entry type.
Entry: Full structured DECISION entry per `memory-schema.md` with rationale field.
Reason: Significant technology decision that benefits from structured, searchable format.

---

**User says:** "TypeDoc comments are required on all new functions."

Routing: `project_memory.md`
Entry: `- 2026-02-23: [CONVENTION] TypeDoc/JSDoc required on all newly created functions, including nested and local functions.`
Reason: Standing code convention every agent must apply.

---

### Incorrect Routing (Violations)

**WRONG:** Adding a "remember always use TypeDoc" rule to `agents/programmer/skills.md`.
**WHY WRONG:** skills.md is a framework SOP file, not a project memory store. The fix belongs in `<ADS_MEMORY_ROOT>/knowledge/project_memory.md`. The Programmer Agent reads that file at dispatch time.

**WRONG:** Editing `AGENTS.md` to add "Note: this project uses Postgres 15."
**WHY WRONG:** AGENTS.md is a framework file. Project-specific facts go in `<ADS_MEMORY_ROOT>/knowledge/project_memory.md`.

**WRONG:** Adding a standing convention to a spec file under `specs/`.
**WHY WRONG:** Specs are version-pinned artifacts for a specific feature. They are ground truth for what to build, not a place to store general conventions.

**WRONG:** Writing a failure postmortem to `project_notes.md`.
**WHY WRONG:** project_notes.md is for open questions and deferred decisions. Postmortems go in `learnings.md` (and optionally as a structured `[FAILURE]` entry in `memory-store.md`).

**WRONG:** Storing a standing constraint inside a template file under `framework/templates/`.
**WHY WRONG:** Templates are project-agnostic framework files. They generate artifacts; they do not store project-specific facts.

---

## The "Remember This" Rule

When the user gives any instruction of the form:
- "Remember that..."
- "Always do X"
- "Never do Y"
- "Going forward, make sure..."
- "Add this as a rule..."
- "Note for the future..."
- "Keep in mind that..."

The agent receiving this instruction MUST:

1. Stop before writing anything.
2. Read this file (`knowledge-routing.md`).
3. Apply the decision tree above to determine the correct destination file.
4. Write the content ONLY to the authorized destination.
5. Confirm to the user: "Noted. Written to `<destination file>` as `[<ENTRY TYPE>]`."

If the instruction is ambiguous between two destinations, write to both and inform the user which entry went where and why.

Under no circumstances should a "remember this" instruction result in a write to AGENTS.md, any skills.md, any SKILL.md, any template, any workflow, any spec, any ADR, or any source code file.

---

## File Responsibilities Summary

| File | Stable? | Written by | Read by | Purpose |
|---|---|---|---|---|
| `project_memory.md` under `<ADS_MEMORY_ROOT>/knowledge/` | Yes — entries are permanent unless explicitly superseded | Human, Coordinator, any agent with routing authorization | All agents at dispatch | Stable conventions, gotchas, constraints, patterns |
| `learnings.md` under `<ADS_MEMORY_ROOT>/knowledge/` | Yes — append-only | Human, Observer, Coordinator | All agents; especially Spec Agent and TDD Agent | Failures, postmortems, agent quality lessons |
| `project_notes.md` under `<ADS_MEMORY_ROOT>/knowledge/` | No — entries are resolved or expired | Human, Coordinator | Spec Agent, Coordinator | Open questions, deferred decisions, parking lot |
| `memory-store.md` under `<ADS_MEMORY_ROOT>/knowledge/` | Yes — append-only, structured | Observer (primary), Coordinator | Observer, Coordinator | Structured searchable log; future Mem0 migration target |
| `knowledge-routing.md` (this file) | Yes — framework update only | Human | All agents before writing any memory | Routing authority — determines destination for all memory writes |

---

## Relationship to memory-schema.md and memory-architecture.md

- `memory-schema.md` defines the structured entry format for `memory-store.md`. Use it when an entry warrants the full structured format (significant decisions, failure clusters, constitution events, quality scores).
- `memory-architecture.md` documents the Option A/B/C/D evaluation and the migration path from structured markdown to Mem0 when the file exceeds ~150 entries.
- This file (`knowledge-routing.md`) is upstream of both: it determines WHICH file under `<ADS_MEMORY_ROOT>/knowledge/` to write to. The schema and architecture files determine HOW to write to `memory-store.md` once routing has determined that is the destination.

Routing order of operations:
1. Read `knowledge-routing.md` → determine destination file.
2. If destination is `memory-store.md` → read `memory-schema.md` → select entry type and format.
3. If destination is `project_memory.md`, `learnings.md`, or `project_notes.md` → use the inline entry format from the routing table above.
