# Memory Architecture

## The Problem

Every pipeline session starts fresh. The Observer agent produces pattern reports, but those reports live only in the current context window. `project_memory.md` and `learnings.md` are manually maintained free-form files — there is no structured way to query "has this failure pattern appeared before?" or "what did we decide about authentication last quarter?"

The pipeline cannot get smarter over time without a durable, queryable memory substrate.

---

## Options Evaluated

### Option A — Structured Markdown Schema (no new infrastructure)

Upgrade `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` and `<ADS_MEMORY_ROOT>/knowledge/learnings.md` from free-form notes to schema-driven entries that the Observer writes to and reads from in a consistent format. See `<AI_DEV_SHOP_ROOT>/framework/memory/memory-schema.md`.

- **Requires:** Nothing new — just structured writing conventions
- **Query method:** Agent reads the file and scans by tag, category, or date
- **Limitations:** No semantic search; scales poorly beyond ~200 entries; no cross-session index
- **Best for:** Getting started immediately; small projects; single-operator setups

### Option B — Mem0

Open-source memory layer designed specifically for AI agents. Supports semantic search, user/agent/session memory scopes, and a simple add/search API. Can be self-hosted or used as a managed service.

- **Requires:** Mem0 library or API key; one integration point in Observer
- **Query method:** Semantic similarity search — "find memories similar to this failure"
- **Strengths:** Simple API (`mem0.add(text)`, `mem0.search(query)`); active maintenance; works without schema design
- **Limitations:** External dependency; semantic search can surface irrelevant results without good tagging
- **Best for:** Projects that accumulate significant history; teams where multiple people run the pipeline

### Option C — Zep / Graphiti

Knowledge graph-based memory with temporal reasoning and entity extraction. Stores relationships between entities (specs, agents, failures, decisions) as a graph.

- **Requires:** Zep server or Graphiti setup; more integration work than Mem0
- **Query method:** Graph traversal — "which ADRs relate to which spec decisions?"
- **Strengths:** Relationship memory is first-class; temporal awareness built in; good for auditing decision chains; aligns well with the constitution and ADR audit trail already in this pipeline
- **Limitations:** Higher setup complexity; overkill for most pipelines at early stage
- **Best for:** Compliance-heavy projects; large teams; when relationship tracing between artifacts matters

### Option D — Letta (formerly MemGPT)

In-context memory management with explicit memory blocks (persona, human, archival). Designed to handle memory within and across LLM context windows.

- **Requires:** Letta framework integration
- **Query method:** Archival memory search; in-context recall
- **Strengths:** Tight integration with agent loop; handles context overflow gracefully
- **Limitations:** Couples the pipeline to the Letta framework; less flexible than standalone memory stores
- **Best for:** Projects already using Letta as the agent runtime

---

## Recommendation

**Start with Option A. Migrate to Option B when the structured files exceed ~150 entries or when semantic search becomes necessary.**

Rationale:
- Option A requires zero new infrastructure and delivers immediate value — the Observer starts building structured memory on the next pipeline run
- Option A and Option B are compatible: the schema defined in Option A maps directly to Mem0 entries; migration is additive, not a rewrite
- Option C (Zep/Graphiti) is worth revisiting when relationship tracing across specs, ADRs, constitution violations, and failures becomes a pain point — the existing ADR audit trail in this pipeline makes Graphiti more compelling here than in the base repo
- Option D couples too tightly to a specific runtime

---

## Migration Path: A → B

When ready to move from structured markdown to Mem0:

1. Read all entries from `<ADS_MEMORY_ROOT>/knowledge/memory-store.md`
2. For each entry, call `mem0.add(entry_text, metadata={category, tags, date, feature})`
3. Update Observer workflow to use `mem0.search()` instead of file scan
4. Keep `memory-store.md` as a human-readable audit log — do not delete it

---

## Files

| File | Purpose |
|------|---------|
| `<AI_DEV_SHOP_ROOT>/framework/memory/memory-schema.md` | Entry format, categories, tagging conventions |
| `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` | The actual memory entries (Observer writes here) |
| `<ADS_MEMORY_ROOT>/knowledge/project_memory.md` | Legacy free-form notes — migrate to memory-store.md over time |
| `<ADS_MEMORY_ROOT>/knowledge/learnings.md` | Legacy failure log — migrate to memory-store.md over time |
