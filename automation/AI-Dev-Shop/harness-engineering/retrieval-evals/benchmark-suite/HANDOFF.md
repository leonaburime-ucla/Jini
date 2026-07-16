# Retrieval Eval Benchmark Suite — Handoff

## Status: Adapters Fixed, Evals Pending Re-run

All 6 active adapters pass spot-checks (prepare + search return results).
Full eval re-runs and three-model audit still pending.

## Completed Eval Results (before latest fixes)

| Backend | Avg F1 (clean) | Notes |
|---------|---------------|-------|
| crg-full | 0.87 | Clear winner |
| rg-control | 0.72 | Strong baseline |
| codegraph | 0.61 | Good on callers |
| ua-tree | 0.63 | Semantic, not structural |
| graphify | 0.35 | Was broken, now fixed |
| cm-mcp-full | 0.24 | Was broken, now fixed |

## Fixes Applied This Session

### 1. GraphifyAdapter._build_node_file_map (adapters.py ~L1089)
- **Bug**: Looked for `node.get("file")` / `node.get("path")` — actual field is `source_file`
- **Fix**: Now reads `source_file` first; maps both `id` and `label` keys
- **Impact**: 0 → 382 map entries

### 2. GraphifyAdapter.search — callers routing (adapters.py ~L1107)
- **Bug**: Callers query ran `graphify path <sym> <sym>` (self-to-self path = useless)
- **Fix**: Callers/change_impact now use `graphify explain` + `_parse_explain_connections`
- **Impact**: 0 → 2 caller results

### 3. CodebaseMemoryAdapter._parse_search_result (adapters.py ~L588)
- **Bug**: Checked `item.get("file")` but cm-mcp returns `file_path`
- **Fix**: Added `file_path` as first lookup
- **Impact**: sentinel gate now passes; search returns results

### 4. CodebaseMemoryAdapter._parse_trace_result (adapters.py ~L522)
- **Bug**: Same `file`→`file_path` field mismatch
- **Fix**: Added `file_path` first in lookup chain

### 5. Added `Set` to typing imports (adapters.py L8)

## Spot-Check Results (post-fix)

```
rg-control:   prepare OK, callers=12
codegraph:    prepare OK, callers=9
crg-full:     prepare OK, callers=18
graphify:     prepare OK, callers=2
ua-tree:      prepare OK, callers=1
cm-mcp-full:  prepare OK, callers=1, sentinel=PASS
```

## Remaining Work

1. **Run full evals** for all backends with fixes:
   ```bash
   python3 run.py --backend cm-mcp-full --fixture fixtures/tier2-medium --output /tmp/eval-cm-mcp2.tsv
   python3 run.py --backend graphify --fixture fixtures/tier2-medium --output /tmp/eval-graphify2.tsv
   python3 run.py --backend ua-tree --fixture fixtures/tier2-medium --output /tmp/eval-ua2.tsv
   ```

2. **Three-model audit** (user explicitly requested):
   Dispatch Codex (GPT-5.5 xhigh) + agy (Gemini 3.1 Pro) + Claude subagent to review all adapters for remaining bugs. Use `skills/llm-operations/references/peer-llm-dispatch.md` for dispatch protocol.

3. **Serena-lsp adapter**: Untested — complex LSP startup, may need additional work.

## Key Architecture Notes

- **mcp_probe.py**: `python3 tools/mcp_probe.py --call <tool> --args '<json>' -- <server_cmd>`
- **cm-mcp params**: `repo_path`, `project`, `function_name`, `direction` (inbound/outbound/both), `mode` (calls/data_flow)
- **CRG tools**: `query_graph_tool` with `pattern: "callers_of"` (not `get_callers_tool`)
- **Graphify graph.json**: nodes use `source_file`, `id`, `label` fields
- **UA**: needs LLM enrichment via `enrich-graph-batch.mjs` (uses agy + Gemini 3.1 Pro)

## File Locations

- Adapters: `adapters.py`
- Runner: `run.py`
- Preflight gates: `preflight.py`
- MCP probe: `tools/mcp_probe.py`
- Fixture: `fixtures/tier2-medium/`
- Previous results: `/tmp/eval-{rg,codegraph,crg,cm-mcp,ua,graphify}.tsv`
