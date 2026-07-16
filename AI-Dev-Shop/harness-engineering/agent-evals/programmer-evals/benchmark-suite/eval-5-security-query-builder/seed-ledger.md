# Seed Ledger — Eval 5: Secure Search Query Builder

Rewritten against the current Python fixture on `2026-04-29`.
Seed IDs are retained for suite backfill compatibility.

ID: SEED-5A
Category: Public contract drift
Seeded issue: The implementation now exposes snake_case request/response fields (`query_text`, `date_range`, `page_size`, `total_count_sql`) while the brief still defines the API in camelCase (`queryText`, `dateRange`, `pageSize`, `totalCountSql`). A caller following the brief does not hit the actual contract.
Expected owner: Programmer
Expected severity: Required
Expected signal: Align the external field names with the published API contract or update the brief and all consumers together.
Evidence path: `src/query_builder.py` — `SearchInput`, `SearchOptions`, `SearchQueryResult`
False positive risk: Low

ID: SEED-5B
Category: Operational telemetry
Seeded issue: `_log_search_operation()` counts every non-`None` filter value as active. Empty structures like `tags=[]` or `date_range={}` still inflate `filterCount`, so the logs misstate how much filtering a query actually used.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Count only meaningful, populated filters in the telemetry path.
Evidence path: `src/query_builder.py` — `_log_search_operation()`
False positive risk: Low

ID: SEED-5C
Category: Input validation gap
Seeded issue: `date_range` shape is not validated before indexing. A partial or malformed date-range dict raises raw `KeyError` instead of a clean `ValidationError`.
Expected owner: Programmer
Expected severity: Required
Expected signal: Validate nested filter shapes before SQL assembly and raise a stable adapter-owned validation error.
Evidence path: `src/query_builder.py` — date-range handling in `build_search_query()`
False positive risk: Low

ID: SEED-5D
Category: Predictable errors
Seeded issue: Bad input still fails through multiple error surfaces. Invalid page/sort values raise `ValidationError`, but malformed nested filters can bubble raw `KeyError` or `TypeError`, so callers cannot handle bad search input uniformly.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Normalize invalid-input failures to one consistent error boundary.
Evidence path: `src/query_builder.py` — validation helpers vs nested filter access
False positive risk: Low

ID: SEED-5E
Category: Typed/stable result
Seeded issue: The returned field names are typed, but the result contract itself no longer matches the documented API (`total_count_sql` / `total_count_params` vs `totalCountSql` / `totalCountParams`). The shape is internally consistent and externally drifted.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Treat the documented output keys as part of the stable contract and align them.
Evidence path: `src/query_builder.py` — `SearchQueryResult` and final return dict
False positive risk: Low

ID: SEED-5F
Category: Stable boundaries
Seeded issue: Several public types still fall back to loose `dict` / `list` members for nested shapes (`date_range`, params arrays). The contract communicates less structure than the builder actually depends on.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Tighten the nested types so malformed filter shapes are harder to express and easier to validate.
Evidence path: `src/query_builder.py` — `SearchFilters`, `SearchQueryResult`
False positive risk: Low

ID: SEED-5G
Category: Single responsibility
Seeded issue: `build_search_query()` still performs validation, telemetry logging, WHERE construction, ORDER BY assembly, pagination, and total-count query generation in one large function. The logic is correct more often than not, but the boundary is still dense.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Extract clause builders and keep the top-level function as composition/orchestration.
Evidence path: `src/query_builder.py` — `build_search_query()`
False positive risk: Low

ID: SEED-5H
Category: Test quality / missing adversarial coverage
Seeded issue: The tests cover SQL injection well, but they do not cover the rewritten contract risks: camelCase caller input, malformed partial `date_range`, or `filterCount` behavior for empty filters such as `tags=[]`.
Expected owner: Code Review
Expected severity: Required
Expected signal: Add regression coverage for contract drift and malformed nested-filter handling, not just injection cases.
Evidence path: `tests/test_query_builder.py`
False positive risk: Low

ID: SEED-5I
Category: Function scoring
Seeded issue: The main builder still carries an `@overallScore 88` annotation even though the public API contract drift and raw nested-filter error path remain unresolved. The score reads more stable than the actual boundary contract.
Expected owner: Code Review
Expected severity: Required
Expected signal: Call out the mismatch between the retained score and the remaining contract bugs.
Evidence path: `src/query_builder.py` — `build_search_query()` docstring
False positive risk: Low
