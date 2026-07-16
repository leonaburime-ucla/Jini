# Database Eval Seed Design

## Metadata

- Design date: 2026-05-11
- Source cowork run: `20260511T045050Z`
- SQL-depth cowork update: `20260511T050647Z`
- Status: canonical seed design for future suite generation
- Scope: Database agent only
- Future suite directory: `benchmark-suite/` inside this bucket
- Fixture status: not created

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T045050Z/`
- SQL-depth cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T050647Z/`

## Suite Shape

- Seeds: 27
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 3
- Scoring target: 24 flaw-catching seeds and 3 false-positive controls

## Dimensions

- `1. Spec-to-Logical Model, Ownership & Normalization`
- `2. Migration Safety, Rollback & Data Integrity`
- `3. SQL Programmability, Query Semantics & Platform Delegation`

## Design Notes

- This suite is completely separate from Supabase evals. Database can test dispatch-to-Supabase as a boundary behavior, but it must not depend on Supabase eval artifacts.
- Database owns logical schema, constraints, migration planning, SQL functions/triggers, query semantics, index recommendations, and platform dispatch decisions.
- Database must not implement Supabase RLS, PostgREST, storage, edge functions, or typed client setup.
- Complex SQL authoring is first-class coverage: PL/pgSQL, triggers, volatility, `SECURITY DEFINER`, `search_path`, recursive CTEs, window functions, upserts, advisory locks, transaction boundaries, and tenant partitioning must be reviewed as executable behavior, not just schema text.
- Platform unknown is a valid stopping point after logical modeling if the agent asks a targeted Coordinator question.
- Negative controls must protect valid denormalization, valid additive migrations, valid advanced SQL functions, and valid platform-unknown pauses.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| DB-SEED-01 | database-eval-1-logical-model | 1 | omission | single | Easy | positive_control | Critical | None | Required relationship is modeled with nullable FK and no domain justification. |
| DB-SEED-02 | database-eval-1-logical-model | 1 | type_contract_error | single | Easy | standard | Required | Low | Money amount is modeled as floating point instead of exact numeric type. |
| DB-SEED-03 | database-eval-1-logical-model | 1 | omission | combined | Medium | standard | Required | Low | Junction table lacks composite unique constraint and duplicate relationship prevention. |
| DB-SEED-04 | database-eval-1-logical-model | 1 | semantic_mismatch | distributed | Medium | standard | Required | Medium | Schema follows UI screen labels instead of entities and cardinality described in spec. |
| DB-SEED-05 | database-eval-1-logical-model | 1 | invariant_violation | layered | Hard | standard | Critical | Medium | Aggregate boundary in ADR forbids shared mutable state, but schema introduces a shared mutable status table. |
| DB-SEED-06 | database-eval-1-logical-model | 1 | hidden_dependency | camouflaged | Medium | standard | Required | Medium | Denormalized field appears harmless but has no sync strategy or source of truth. |
| DB-SEED-07 | database-eval-1-logical-model | 1 | boundary_error | interference | Hard | standard | Required | Medium | System Blueprint assigns table ownership to another domain, but planned DDL alters it directly. |
| DB-SEED-08 | database-eval-1-logical-model | 1 | cosmetic_fix | single | Medium | negative_control | Recommended | High | Intentional denormalization has explicit read-model rationale and sync strategy. |
| DB-SEED-09 | database-eval-1-logical-model | 1 | omission | distributed | Medium | regression | Required | Low | Prior guarded failure mode: invariant is enforced only in application code, with no CHECK/UNIQUE/FK constraint. |
| DB-SEED-10 | database-eval-2-migration-integrity | 2 | omission | single | Easy | positive_control | Critical | None | Destructive `DROP COLUMN` migration has no rollback path or acknowledged product risk. |
| DB-SEED-11 | database-eval-2-migration-integrity | 2 | boundary_error | single | Easy | standard | Required | Low | Migration is labeled additive but introduces a NOT NULL column without default/backfill. |
| DB-SEED-12 | database-eval-2-migration-integrity | 2 | hidden_dependency | distributed | Medium | standard | Required | Low | Migration order creates FK before owner table exists in the current dependency wave. |
| DB-SEED-13 | database-eval-2-migration-integrity | 2 | state_leak | combined | Medium | standard | Required | Medium | Soft delete is added without query filtering discipline or partial uniqueness strategy. |
| DB-SEED-14 | database-eval-2-migration-integrity | 2 | invariant_violation | layered | Hard | standard | Critical | Medium | Data-transforming migration wraps debit/credit logic in a helper function, but the function can commit the debit path without completing the credit path. |
| DB-SEED-15 | database-eval-2-migration-integrity | 2 | contradiction | distributed | Hard | standard | Critical | Medium | Spec requires retention while migration permanently deletes historical records. |
| DB-SEED-16 | database-eval-2-migration-integrity | 2 | omission | camouflaged | Medium | standard | Required | Medium | Migration summary claims no lock risk, but the backfill function uses session-level `pg_advisory_lock` and a blocking index build on a high-traffic table. |
| DB-SEED-17 | database-eval-2-migration-integrity | 2 | dead_code | single | Medium | negative_control | Recommended | High | Additive nullable column with explicit backfill plan should not be blocked as destructive. |
| DB-SEED-18 | database-eval-2-migration-integrity | 2 | semantic_mismatch | distributed | Medium | regression | Required | Low | Prior guarded failure mode: migration plan omits compatibility window despite active readers. |
| DB-SEED-19 | database-eval-3-sql-programmability | 3 | omission | single | Easy | positive_control | Critical | None | `SECURITY DEFINER` transfer function omits fixed `search_path` and caller authorization checks, allowing privilege escalation through search-path injection. |
| DB-SEED-20 | database-eval-3-sql-programmability | 3 | anti_pattern | single | Easy | standard | Required | Low | Function is marked `IMMUTABLE` even though it reads a configuration table and `current_setting`, creating stale planner and index-expression behavior. |
| DB-SEED-21 | database-eval-3-sql-programmability | 3 | hidden_dependency | distributed | Medium | standard | Required | Medium | Cross-table `AFTER UPDATE` triggers update each other without `pg_trigger_depth()` or idempotence guard, causing recursive writes under normal updates. |
| DB-SEED-22 | database-eval-3-sql-programmability | 3 | anti_pattern | combined | Medium | standard | Required | Medium | Upsert function uses `NOT EXISTS` and `ON CONFLICT (email)` while the actual uniqueness rule is a partial active-user index, creating duplicate active rows under concurrency. |
| DB-SEED-23 | database-eval-3-sql-programmability | 3 | invariant_violation | layered | Hard | standard | Critical | Medium | Balance-transfer function performs read-then-write debit/credit steps under default isolation, so concurrent calls can produce negative balances. |
| DB-SEED-24 | database-eval-3-sql-programmability | 3 | semantic_mismatch | distributed | Medium | standard | Required | Medium | Batch ranking query uses `ROW_NUMBER() OVER (ORDER BY created_at)` without `PARTITION BY tenant_id`, leaking cross-tenant cardinality and corrupting per-tenant ordering. |
| DB-SEED-25 | database-eval-3-sql-programmability | 3 | boundary_error | interference | Hard | standard | Required | Medium | Platform is Supabase, but Database authors RLS/PostgREST helper functions instead of handing platform-specific implementation to the Supabase Sub-Agent. |
| DB-SEED-26 | database-eval-3-sql-programmability | 3 | hidden_dependency | distributed | Medium | regression | Required | Low | Prior guarded failure mode: recursive CTE in hierarchy traversal lacks `CYCLE` handling or depth limit, allowing cyclic data to hang the session. |
| DB-SEED-27 | database-eval-3-sql-programmability | 3 | cosmetic_fix | single | Hard | negative_control | Recommended | High | Advanced admin SQL function uses pinned `search_path`, explicit role guard, transaction-scoped advisory lock, `VOLATILE`, tenant partitioning, and bounded recursion; it should not be flagged merely for complexity. |

## Planned Fixtures

### `database-eval-1-logical-model`

Purpose: test spec-to-ERD translation, normalization, constraints, data type selection, aggregate alignment, and ownership guardrails.

Fixture concepts:
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/adr.md`
- `seed-state/reports/pipeline/system-blueprint.md`
- `seed-state/schema/current-schema.sql`
- `seed-state/prompts/original-database-request.md`

### `database-eval-2-migration-integrity`

Purpose: test migration classification, rollback strategy, compatibility windows, lock-risk reasoning, and data-transforming safety.

Fixture concepts:
- `seed-state/schema/current-schema.sql`
- `seed-state/migrations/proposed-migration.sql`
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/adr.md`
- `seed-state/runtime/traffic-profile.md`

### `database-eval-3-sql-programmability`

Purpose: test PL/pgSQL function correctness, trigger safety, transaction isolation, volatility contracts, privilege boundaries, query semantics, concurrency behavior, and Supabase dispatch boundaries.

Fixture concepts:
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/system-blueprint.md`
- `seed-state/reports/pipeline/adr.md`
- `seed-state/schema/current-schema.sql`
- `seed-state/functions/proposed-functions.sql`
- `seed-state/functions/trigger-definitions.sql`
- `seed-state/query-patterns.md`
- `seed-state/concurrency/load-scenario.md`
- `seed-state/coordinator-directive.md`

## Acceptance Checks For Suite Generation

- The generated suite must pass `validate_eval_suite.py`.
- Every seed must map to `agents/database/skills.md`, `skills/sql-data-modeling/SKILL.md`, `skills/postgresql/SKILL.md`, or the Database dispatch rules.
- Fixture inputs must be self-contained and must not depend on Supabase eval outputs.
- Direct Supabase implementation by Database must be scored as a boundary failure when platform-specific implementation is required.
- Valid platform-unknown pauses must be scored as correct behavior, not incompleteness.
- Complex SQL seeds must require reasoning about executable behavior, including volatility, trigger recursion, isolation, advisory lock lifecycle, recursive CTE bounds, tenant partitioning, and definer-rights safety.
- Valid advanced SQL patterns with pinned `search_path`, explicit authorization checks, transaction-scoped locks, and documented volatility must be scored as correct, not as false positives.
- `run-manifest.tsv` and `run-results.tsv` stay header-only until real isolated eval runs are recorded.
