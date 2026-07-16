# Retrieval Eval Design (Revised)

## Metadata

- Design date: 2026-06-27
- Revised: 2026-06-27 (post-debate Round 2 consensus)
- Participants: Claude Opus 4.6 (primary), Codex GPT-5.5 xhigh (peer), Gemini 3.1 Pro High (peer)
- Consensus reports: `.local-artifacts/swarm-consensus/runs/20260627T232000Z-consensus-report.md` (R1), `20260627T234500Z-consensus-report-round2.md` (R2)
- Status: design revised, implementation pending
- Suite path: `harness-engineering/retrieval-evals/benchmark-suite/`

---

## Purpose

Determine whether graph-based code search tools improve end-task correctness compared to `rg` alone. The eval MUST be able to conclude "graph-first does not help" for a given query class — this is a valid and important outcome.

This is NOT an agent behavior eval. It is a retrieval infrastructure benchmark. The "agent" here is a controlled executor using one backend condition at a time.

---

## Three-Layer Benchmark

### Layer 1: Adapter Conformance

Does the backend correctly implement the `code_search` contract?

- Returns valid `CodeSearchResponse` with normalized envelope (see Backend Contract below)
- Reports capabilities accurately (structural, semantic, prose — see Query Target Tags)
- Handles unsupported query classes gracefully (returns `UNSUPPORTED` status, no crash)
- Freshness check returns accurate state
- Backend identity is hidden from executor (identical `code_search` tool name)

### Layer 2: Retrieval Diagnostic (Information Sufficiency)

Given the backend's results, is it *possible* to solve the downstream task?

- Feed backend results to an LLM evaluator asking: "Given ONLY these results, can you perfectly solve [task]?"
- Isolates the retrieval ceiling from agent reasoning quality
- If sufficiency fails but end-task passes (unlikely), the executor got lucky
- If sufficiency passes but end-task fails, the executor reasoned poorly about good results (not a retrieval problem)

### Layer 3: End-Task Correctness (Decision Metric)

Does the agent using these search results actually complete the downstream task correctly?

- A controlled executor (fixed model, temperature=0, fixed system prompt) uses `code_search` + `submit_solution`
- Each scenario runs once per backend condition
- The executor's solution is graded against ground truth

Layer 3 is the headline metric. Layers 1-2 exist for debugging and attribution.

---

## Backend Contract (Normalized Envelope)

All backends MUST return results through an identical interface. The executor sees only `code_search` — never the backend name, library, or tool-specific formatting.

```typescript
interface CodeSearchResponse {
  results: Array<{
    file: string;
    line_start: number;
    line_end: number;
    content: string;
    confidence?: number;
  }>;
  status: 'ok' | 'unsupported' | 'error';
  metadata: {
    result_count: number;
    truncated: boolean;
    query_class: string;
  };
}
```

Adapters normalize each backend's native output into this shape. Equal `maxResults` and `maxTokens` budget across all backends per query.

---

## Query Target Tags

Every query in the seed ledger is tagged:

| Tag | Meaning | Graph Expected Behavior |
|-----|---------|------------------------|
| `code-target` | Answer lives in source code (AST-parseable) | Should answer from index |
| `prose-target` | Answer lives in markdown, config JSON, or non-code files | Should return `UNSUPPORTED` or abstain |

Graph tool failures on `prose-target` queries are scored as **EXPECTED_ABSTAIN**, not FAIL. This prevents penalizing AST-based tools for a capability they structurally cannot have.

---

## Scenario Unit

```
scenario = fixture_repo × repo_state × query × backend_condition
```

Each scenario maps to one row in `run-results.tsv` with ground truth in the seed ledger.

---

## Backend Conditions

| Condition | Description |
|-----------|-------------|
| `rg-control` | ripgrep only — the baseline everything must beat |
| `cm-mcp-full` | codebase-memory-mcp with FULL index mode (CALLS+IMPORTS+similarity) |
| `cm-mcp-fresh` | codebase-memory-mcp re-indexed AFTER dirty edit (fresh-graph arm) |
| `oracle-context` | Ground-truth minimal evidence bundle (validation arm) |

The **oracle-context** arm is critical: it gives the executor exactly the evidence needed. If oracle fails, the task or executor is broken — not a retrieval problem. If oracle passes but a backend fails, retrieval is implicated.

The **cm-mcp-fresh** arm separates "graphs are bad" from "STALE graphs are bad" — the actionable deployment question.

Index mode is a controlled variable: `cm-mcp-full` and `cm-mcp-fast` are SEPARATE conditions (fast mode drops IMPORTS/CALLS edges, changing the entire capability surface). MVP runs only `cm-mcp-full`; fast mode is excluded to avoid confounding.

### Backend Identity Hiding

The executor sees only `code_search` as a tool. No backend name, library version, or tool-specific metadata is exposed. This prevents model priors from leaking (e.g., favoring results from a tool the model "knows").

---

## MVP Query Selection

7 queries, one per class. Labeled as **existence-proof** claims (n=1 per class cannot prove population-level conclusions).

| Query | Class | Target Tag | Why Selected |
|-------|-------|------------|--------------|
| Q2 | Callers/callees | code-target | Proven ambiguity/under-reporting trap (Trial A: cm-mcp found 1/3 callers) |
| Q3 | Dependency path | code-target | Graph-only reachability win (Trial A: graphify uniquely correct) |
| Q5 | Dependency path (absence) | code-target | False-positive trap (prove NO path exists) |
| Q7 | Architecture (circular) | code-target | IMPORTS-edge canary; index-mode failure detector |
| Q8 | Architecture (layering) | code-target | Structural violation requiring import-graph traversal |
| Q9 | Literal/config | code-target | Multi-location config; tests cross-file literal search |
| Q14 | Change-impact | code-target | Stale-trap headline; callers of the dirtied function |

**Note on Q5 prose-target exclusion:** Round 1 identified Q5 (config in markdown) as important for demonstrating "rg preferred" on prose. However, the tier2 fixture's Q5 (Redis timeout in `redis.json` + `env.ts`) is actually a code-target query. The original markdown-blind issue was specific to the AI-Dev-Shop trial (different repo). Retaining Q5 as dependency-path absence.

---

## Repo States

Each fixture repo is materialized in two states for MVP:

| State | How Created | What It Tests |
|-------|-------------|--------------|
| Clean | `git checkout` to pinned commit | Baseline — index matches reality |
| Dirty | Uncommitted working-tree edits via `setup-dirty.sh` | Backend must read worktree, not just HEAD; stale traps fire |

### Dirty Edit Design (≥3 stale patterns, affecting ≥5/7 queries)

`setup-dirty.sh` MUST apply multiple mutation types so stale behavior is tested broadly:

| Mutation | What Changes | Queries Affected |
|----------|-------------|-----------------|
| **Move function** | `calculateShippingCost` moved from `shipping.ts` → `logistics.ts` | Q14 (callers point to wrong file) |
| **Add new caller file** | New `audit.ts` imports and calls `validateInventory` | Q2 (new caller invisible to stale index) |
| **Add re-export barrel** | New `index.ts` re-exports from internal modules | Q2, Q14 (indirect callers invisible to rg) |
| **Rename import path** | Change an import to use the barrel re-export | Q7, Q8 (import-graph edges change) |
| **Modify config value** | Change Redis timeout from 5000 → 10000 | Q9 (old value in stale index) |

This ensures ≥5 of 7 selected queries have different correct answers in DIRTY vs CLEAN state.

---

## Fixture Strategy

### Tier 2 (Medium) — MVP Fixture

Purpose-built TypeScript codebase (~1500 LOC) with known architecture, call graphs, dependency chains, and ground-truth answers.

**Required structural features:**
- Multi-module (orders, inventory, payments, notifications, auth, config)
- Circular dependency (OrderService ↔ InventoryService)
- Layering violation (OrderController → InventoryData)
- Multiple config locations for same semantic value
- **Re-export barrel file** (at least one `index.ts` that re-exports internal modules)
- **Indirect call chain** (caller → barrel re-export → implementation, ≥3 hops)
- Red-herring files and generated/distractor code
- Majority of imports remain DIRECT (preserving "medium" complexity)

The re-export pattern ensures at least one query has ground-truth callers that rg cannot find by string match (proven decisive in Trial B: 90 vs 3 callers on real code with re-exports).

### Design Principles (from eval-design-playbook)
- Bug density: 1 per 100-170 lines
- No comments near targets
- Bugs are omissions, not obviously broken code
- Include red-herring files and generated/distractor code

---

## Scoring

### Correctness Grades (Primary Metric)

| Grade | Definition |
|-------|-----------|
| `PASS` | Correct outcome, all required evidence found, no stale reliance |
| `PARTIAL` | Correct area but incomplete (missed call sites, partial file list) |
| `PARTIAL_AMBIGUITY` | Incomplete due to ambiguous name resolution (tool resolved wrong node among same-named symbols) |
| `FAIL` | Wrong outcome |
| `CRITICAL_STALE` | Wrong because stale data (old path, old branch content) drove the answer |
| `EXPECTED_ABSTAIN` | Backend correctly indicated unsupported query class (prose-target on AST tool) |
| `FALSE_POSITIVE` | Backend returned positive answer for a ground-truth negative (e.g., claiming a path exists when it doesn't) |

### Set-Answer Grading (F1/Precision/Recall)

For queries with set-valued answers (callers, impacted files, config locations), the seed ledger specifies the **complete expected set**. Grading uses:

```
precision = |returned ∩ expected| / |returned|
recall    = |returned ∩ expected| / |expected|
F1        = 2 × (precision × recall) / (precision + recall)
```

- F1 ≥ 0.9 → PASS
- F1 ≥ 0.5 → PARTIAL (with recall breakdown logged)
- F1 < 0.5 → FAIL
- Recall = 1/N where N ≥ 3 → PARTIAL_AMBIGUITY (likely wrong-node resolution)

### Stale-Cause Tagging (Separate from Grade)

Every graded response also receives a stale-cause tag:

| Tag | Meaning |
|-----|---------|
| `fresh` | Answer reflects current worktree state |
| `stale:moved` | Answer references pre-move location |
| `stale:missing-new` | Answer misses newly-added file/caller |
| `stale:old-value` | Answer reports pre-edit config value |
| `stale:wrong-graph` | Answer from index that lacks required edge types |
| `not-applicable` | Query has no stale variant in this state |

This separates "what went wrong" from "how wrong is it" — enables debugging whether stale failures are fixable (reindex) vs fundamental.

### Failure Class Taxonomy

| Class | Description | Example |
|-------|------------|---------|
| `no-answer` | Backend returned empty/error | cm-mcp on markdown target |
| `partial-answer` | Backend returned subset of truth | Q2: 1/3 callers found |
| `stale-answer` | Backend returned pre-mutation data | Q14 DIRTY: points to shipping.ts not logistics.ts |
| `unsupported-capability` | Backend declared UNSUPPORTED for query class | Expected behavior for prose-target on AST tool |
| `false-positive` | Backend asserted something untrue | Claiming dep path exists when it doesn't |

---

## Operational Profile (Efficiency Metrics)

Efficiency is reported prominently but does NOT drive the pass/fail decision. When two backends tie on correctness, efficiency becomes the tiebreaker and is promoted to headline for that comparison.

| Metric | How Measured |
|--------|-------------|
| `cold_index_ms` | Time to build index from scratch (first run) |
| `tokens_per_query` | Total input+output tokens for one retrieval+executor cycle |
| `tool_turns_per_query` | Number of tool calls the executor made |
| `retrieval_ms` | Time from query to results |
| `executor_task_ms` | Time for executor to produce solution |
| `total_ms` | End-to-end wall clock per scenario |

### Report Structure

1. **Headline:** Correctness delta vs `rg-control` per query (F1 or grade)
2. **Operational Profile** (immediately below): cold-index time, tokens/query, tool-turns/query
3. **If correctness ties:** efficiency promoted to headline as tiebreaker

---

## Preflight Gates (Blocking)

These MUST pass before any scored run. Failure = harness refuses to proceed.

### Gate 1: Dirty-Edit Verification

Proves the stale-trap mechanism works for each backend:

1. Index the fixture in CLEAN state
2. Apply `setup-dirty.sh` (dirty edits)
3. Query the backend for Q14 (headline stale trap) WITHOUT reindexing
4. **Assert:** backend returns the CLEAN-state answer (callers pointing to `shipping.ts`), NOT the dirty answer (callers pointing to `logistics.ts`)
5. **Assert:** `rg` returns the DIRTY-state answer (finds `logistics.ts`)

If the backend returns errors, garbage, or the dirty answer → stale trap is invalid for that backend. Block scored runs; investigate.

### Gate 2: Index Mode Sentinel

Proves the backend has the required edge types:

1. After `adapter.prepare()`, run a sentinel query: "Does OrderService have a circular dependency?"
2. **Assert:** result count > 0 (requires IMPORTS edges)
3. Log index manifest: node count, edge types present (CALLS, IMPORTS, CONTAINS, SIMILARITY)

If sentinel returns 0 → index mode is wrong (likely fast mode). Block scored runs.

### Gate 3: Adapter Envelope Conformance

Proves all backends return the normalized envelope:

1. Run one query per backend
2. **Assert:** response matches `CodeSearchResponse` schema exactly
3. **Assert:** no backend-identifying metadata leaks through to executor

---

## MVP Scope (42 Cells)

```
1 fixture (tier2-medium) × 2 states (clean + dirty) × 7 queries × 3 backends = 42 cells
```

Backends: `rg-control`, `cm-mcp-full`, `oracle-context`

Claims are **existence-proof only** (n=1 per query class). Population-level conclusions require the full matrix (560+ cells).

### Full Matrix (Future)

```
2 fixtures × 4 states × 14 queries × 5 backends = 560 cells
```

Additional backends: `cm-mcp-fresh` (reindexed after dirty edit), `long-context` (full repo in context window).

---

## Harness Structure

```
harness-engineering/retrieval-evals/
├── README.md
├── eval-design.md                    (this file)
├── adapter-contract.md               (facade spec)
└── benchmark-suite/
    ├── README.md
    ├── fixtures/
    │   └── tier2-medium/             (synthetic TS repo, git-initialized)
    │       ├── setup-dirty.sh        (applies ≥3 mutation types)
    │       ├── setup-clean.sh        (resets to pinned commit)
    │       └── src/
    │           ├── orders/
    │           │   ├── index.ts      (re-export barrel)
    │           │   ├── shipping.ts
    │           │   ├── OrderService.ts
    │           │   └── OrderController.ts
    │           ├── inventory/
    │           │   ├── InventoryService.ts
    │           │   └── InventoryData.ts
    │           ├── payments/
    │           ├── notifications/
    │           ├── auth/
    │           ├── config/
    │           └── middleware/
    ├── seed-ledger.md                (ground truth — complete expected sets, stale signatures, target tags)
    ├── controls.md                   (positive/negative/regression controls)
    ├── run-manifest.tsv              (planned runs)
    ├── run-results.tsv               (actual results)
    ├── adapters/
    │   ├── base-adapter.ts           (normalized envelope enforcement)
    │   ├── rg-adapter.ts
    │   ├── codebase-memory-adapter.ts
    │   └── oracle-adapter.ts
    ├── executor/
    │   ├── executor-prompt.md        (fixed system prompt for controlled executor)
    │   └── run-executor.ts
    ├── graders/
    │   ├── set-grader.ts             (F1/precision/recall for set answers)
    │   ├── path-grader.ts            (dependency path yes/no + evidence)
    │   ├── stale-tagger.ts           (stale-cause classification)
    │   └── sufficiency-grader.ts     (Layer 2 information sufficiency)
    ├── preflight/
    │   ├── dirty-edit-gate.ts        (Gate 1)
    │   ├── index-sentinel-gate.ts    (Gate 2)
    │   └── envelope-gate.ts          (Gate 3)
    └── run.py                        (harness entry point)
```

---

## Executor Design

The executor is deliberately constrained:
- Fixed model (highest-capability available, temperature=0)
- Fixed system prompt (no per-backend tuning)
- Only two tools: `code_search` (normalized envelope) and `submit_solution`
- No direct file reads outside what `code_search` returns
- Same executor for all backend conditions in a scenario
- **Max turn budget:** 5 tool calls per query (prevents infinite retry loops)
- Backend identity fully hidden behind identical tool interface

This isolates the backend as the independent variable.

---

## Controls

| Type | Purpose | Example |
|------|---------|---------|
| Positive control | Oracle arm MUST pass — validates task/executor | Oracle provides exact evidence; executor should get PASS |
| Negative control | Backend correctly abstains on unsupported class | AST tool on prose-target query → EXPECTED_ABSTAIN |
| Stale trap | Backend returns outdated info in dirty state | Q14 dirty: returns `shipping.ts` instead of `logistics.ts` → CRITICAL_STALE |
| False-positive trap | Backend must NOT claim something untrue | Q5/Q6: must answer NO (no path exists); YES = FALSE_POSITIVE |

---

## Run Protocol

1. **Preflight:** Run all 3 gates (dirty-edit, sentinel, envelope). Block on failure.
2. **Setup:** Initialize fixture in target state via `setup-clean.sh` or `setup-dirty.sh`
3. **Prepare backend:** Call `adapter.prepare()`, record `cold_index_ms`, log index manifest
4. **Layer 1 (conformance):** Verify adapter returns valid normalized response shape
5. **Execute:** Run executor with pinned backend (max 5 turns), record all metrics
6. **Layer 2 (sufficiency):** Feed results to sufficiency grader
7. **Layer 3 (end-task):** Grade executor output — F1 for sets, binary for yes/no, stale-cause tag
8. **Teardown:** Reset fixture state
9. **Record:** Write row to `run-results.tsv` with: grade, F1, stale-cause, tokens, turns, latency

---

## What "Graph Doesn't Help" Looks Like

For a given query, if:

```
rg_F1 >= backend_F1
AND rg_tokens <= backend_tokens
AND rg_total_ms <= backend_total_ms
```

Then the eval concludes: **"Backend X adds no value for [query]. Use rg."**

This is surfaced prominently in the results summary, not buried. It is a primary finding.

For the MVP (existence-proof scope), this conclusion applies only to the specific query tested, not the entire query class.

---

## What "Stale Graph Is The Problem" Looks Like

If `cm-mcp-full` fails on dirty state but `cm-mcp-fresh` (reindexed) passes:

**"The graph's answer is correct when fresh. The deployment question is: how often to reindex."**

This is the actionable distinction the fresh-graph arm provides.

---

## Known Risks

1. **Conflating agent reasoning with retrieval quality.** Mitigated by the oracle arm and sufficiency layer.
2. **Executor model variance.** Pin model and temperature. Report model used. Re-run on model upgrade.
3. **Index amortization.** Graph tools may only win after warm-up. Report cold and warm separately.
4. **rg is surprisingly good.** For simple repos with direct imports, rg may beat indexed tools. This is a valid finding.
5. **Re-export coverage.** The fixture adds indirection but keeps it bounded — don't over-represent it relative to real codebases at this size.
6. **Fixture maintenance.** Ground truth is pinned to specific fixture commits. Any fixture edit requires re-verification of the seed ledger AND re-running preflight gates.
7. **Silent under-reporting.** Tools may return plausible partial results (1/3 callers). F1 grading catches this; binary pass/fail would not.
8. **Index mode as hidden variable.** Fast mode drops edge types silently. Sentinel gate catches this; pin index mode explicitly.
9. **Existence-proof limitations.** n=1 per class means no statistical power. Label all findings as existence-proofs; do not generalize without the full matrix.
10. **Semantic class deferred.** No backend in MVP supports semantic search without prep (enrichment/embeddings). Include in full matrix only after prep cost is part of the measured setup.
