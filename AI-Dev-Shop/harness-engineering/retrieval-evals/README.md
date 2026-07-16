# Retrieval Evals

Analyzer-agnostic retrieval+task benchmark. Determines whether graph-based code search tools improve end-task correctness compared to `rg` alone.

This is the "decision instrument" from a 3-model /debate on codebase analyzer integration strategy (2026-06-27). No backend is adopted without passing this benchmark.

## Files

- `eval-design.md` — query classes, scoring rubric, fixture design, harness structure
- `adapter-contract.md` — `code_search` facade interface spec, trust envelope schema, backend adapter trait

## Quickstart

```bash
# Validate suite structure (once fixtures exist)
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/retrieval-evals/benchmark-suite

# Run benchmark (once harness exists)
python3 harness-engineering/retrieval-evals/benchmark-suite/run.py --backend rg-control --fixture tier2-medium
```

## Backend Notes

### understand-anything (LLM-enriched graph)

The `understand-anything` backend requires an enrichment pass to populate node summaries and tags for semantic search. Without enrichment, the Fuse.js search engine operates on empty fields and returns noise.

- **Enrichment model:** Gemini 2.5 Flash (via `agy`/Antigravity)
- **Script:** `integrations/understand-anything/enrich-graph.mjs`
- **Metadata:** Each enriched graph stores `meta.enrichment` with model, tool, and date

Eval results for the `understand-anything` condition MUST note that Gemini was used to generate the summaries. This is relevant because:
1. It introduces a model-dependency — results may vary on model version change
2. The enrichment cost (time + tokens) is part of `cold_prepare_ms`
3. Comparing against `rg-control` (zero-prep) must account for this setup cost

## Provenance

- Design source: `/cowork` run 20260627T193650Z (Claude Opus 4.6 + Codex GPT-5.5 xhigh + Gemini 3.1 Pro High)
- Strategy source: `/debate` consensus report `ADS-memory/reports/swarm-consensus/runs/20260627T181138Z-consensus-report.md`
- Binding constraints from debate (do not re-litigate): benchmark-first, branch-on-repo-size, lazy freshness, one portable facade, no new storage now, split-by-artifact install
