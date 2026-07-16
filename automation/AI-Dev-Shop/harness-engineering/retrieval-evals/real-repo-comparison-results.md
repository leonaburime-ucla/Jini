# Real-Repo Head-to-Head — Results

Run date: 2026-06-27
Repo under test: AI-Dev-Shop (this repo) — markdown/docs-heavy framework + Python eval harnesses + TS integrations
Executor: Claude Opus 4.8 (inline, single operator), clean working-tree state
Backends: rg, codebase-memory-mcp, codegraph, serena, graphify, understand-anything

This is the informal "which tools are worth a damn" arm from the retrieval-evals
handoff — NOT the synthetic scored harness (that's still unbuilt). Grades are
operator judgment on completeness/precision/effort against rg-established ground truth.

## Ground Truth

| Q | Class | Target | Truth |
|---|-------|--------|-------|
| Q1 | Symbol lookup | `dispatch_eval` defs | 3 defs (contract-enforcement, drift-sensors, git-and-docs `run_evals.py`) |
| Q2 | Callers | callers of `run_suite` | 3 (`main` in each of the 3 files) |
| Q3 | Dependency path | swarm-consensus/SKILL.md → systematic-debugging | **No path** (direct or transitive) |
| Q4 | Architecture | modules with circular imports | none cleanly identifiable |
| Q5 | Literal/config | `max_retry_cycles` | `framework/slash-commands/cowork.md` (markdown) |
| Q6 | Semantic | "getting unstuck / escalation" | escalation-policy.md, `unstuck_escalation_hook.py`, AGENTS.md |
| Q7 | Change-impact | rename `CodeSearchBackendAdapter` | `adapter-contract.md` only — markdown interface, zero implementers |

## Scoring Matrix

| Query | rg | codebase-memory-mcp | codegraph | serena | graphify | understand-anything |
|-------|----|--------------------|-----------|--------|----------|--------------------|
| Q1 symbol | ✅ all 3 | ✅ all 3 + metadata | ✅ all 3 + sigs | — MCP-only | ⚠️ 1 of 3 | ❌ noise |
| Q2 callers | ✅ all sites | ⚠️ **1 of 3** (name ambiguity) | ✅ all 3 clean | — MCP-only | ⚠️ via neighbors | ❌/— |
| Q3 dep path | ⚠️ manual (no ref) | — code-only | — code-only | — | ✅ **"no path"** | — |
| Q4 circular imports | ❌ | ❌ no IMPORTS edges (fast mode) | ❌ no command | — | ⚠️ diagnose ≠ cycles | ❌ |
| Q5 config | ✅ exact | ❌ 0 (markdown invisible) | ❌ not found | — | ❌ not a symbol | ❌ noise |
| Q6 semantic | ✅ many files | ❌ 0 | ⚠️ hook + noise | — | ✅ hook node | ✅ hook 0.937 + noise |
| Q7 change-impact | ✅ exact | ❌ 0 | ❌ not found | — | ❌ | ❌ |

## Findings

1. **rg won or tied 6 of 7.** It is the only backend that handled markdown/config/
   prose targets (Q5, Q6, Q7), because those targets are not code symbols — and this
   repo's substance lives in markdown.

2. **Graph tools only matched rg on pure code-symbol queries (Q1, Q2),** where they
   add metadata (signatures, complexity) but not better recall. codegraph matched rg
   exactly. codebase-memory-mcp **under-performed rg on Q2** — `trace_path` resolved the
   ambiguous name `run_suite` to ONE node and silently dropped the other two callers,
   even though the graph contained all three (confirmed via Cypher).

3. **graphify uniquely won Q3** (dependency reachability). Proving the *absence* of a
   transitive path is genuinely hard with grep; graphify answered "No path found"
   correctly. This is the one place a graph clearly beat ripgrep.

4. **understand-anything is unreliable on this repo.** The repo-root graph was never
   enriched (only the tier2 fixture was) and it indexes `.local-artifacts/` + eval
   fixtures, so semantic search drowns in noise (Q1/Q5 returned unrelated fixtures).

5. **serena is not usable as a one-shot CLI.** `find_symbol` / `find_referencing_symbols`
   exist only as MCP tools over a language-server backend — requires `start-project-server`
   + an MCP client. High integration cost; not evaluated for one-shot retrieval.

6. **Q4 (circular imports): no backend answered.** codebase-memory `fast` mode builds no
   IMPORTS edges; codegraph has no cycle command; graphify `diagnose` detects edge-collapse,
   not import cycles. Needs a full-index codebase-memory pass or a dedicated cycle analyzer.

7. **Setup cost asymmetry.** codebase-memory-mcp was NOT indexed for this repo (handoff
   claim was stale) — required a cold `index_repository` (13,279 nodes / 19,976 edges).
   rg = zero setup. graphify/codegraph/understand-anything graphs pre-existed from prior sessions.

## Verdict / Decision Input

For a **docs/markdown-heavy repo like this one, `rg` is the correct default.** The graph
backends do not justify their setup + staleness cost for most query classes here.

Worth wiring as targeted capabilities, NOT a blanket replacement:
- **Dependency-path / reachability** (graphify's Q3 win) — the clearest graph-only value.
- **Code-symbol metadata** (codegraph: signatures, complexity, clean callers) — when the
  target is genuinely code, not prose.

Concerns to log before adopting:
- codebase-memory-mcp `trace_path` ambiguous-name recall gap (Q2) — silent under-reporting.
- understand-anything needs repo-scoped enrichment + `.local-artifacts`/fixture exclusion
  before its semantic search is trustworthy.

Caveat: single-operator, clean-state, one repo. The dirty/renamed/branch-switched stale
traps and the scored synthetic harness remain unbuilt — those are where graph freshness
(or staleness) would actually be stressed.
