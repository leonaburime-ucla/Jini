# Overlap Extraction and Merge - 2026-03-04

## Objective
Extract net-new guidance from quarantined overlap skills and merge into canonical local skills without activating duplicate domain authorities.

## Sources (Inbox)
- `harness-engineering/skills-inbox/external/2026-03-04-postgresql-table-design/SKILL.md`
- `harness-engineering/skills-inbox/external/2026-03-04-test-driven-development/SKILL.md`
- `harness-engineering/skills-inbox/external/2026-03-04-supabase-postgres-best-practices/SKILL.md`

## Canonical Targets Updated
- `skills/postgresql/SKILL.md`
- `skills/test-design/SKILL.md`
- `skills/supabase/SKILL.md`

## Net-New Additions Merged

### PostgreSQL
Added `## Table Design Guardrails`:
- identity PK default guidance
- explicit FK index requirement
- safer type defaults (`TIMESTAMPTZ`, `NUMERIC`, `TEXT`)
- schema-first invariants via constraints
- `UNIQUE ... NULLS NOT DISTINCT` guidance
- identifier casing convention

### Test Design (TDD)
Added `## TDD Execution Mechanics (Mandatory)`:
- strict red-green-refactor flow
- explicit red verification requirement
- minimal green implementation constraint
- test-passes-first-run invalidation rule
- no batched behavior changes per cycle

### Supabase
Added `## Performance Checklist (Supabase + Postgres)`:
- index strategy (FK/composite/partial/covering)
- keyset pagination preference
- RLS predicate indexing guidance
- EXPLAIN ANALYZE/BUFFERS requirement for critical queries
- connection pooling/churn guidance
- JSONB indexing and generated-column extraction guidance

## Pruning Status
Overlap candidates remain quarantined in inbox and are not active in `skills/`.

