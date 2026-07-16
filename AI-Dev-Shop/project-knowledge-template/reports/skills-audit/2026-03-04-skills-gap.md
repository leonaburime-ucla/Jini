# Skills Gap Audit - 2026-03-04

## Scope
Requested skills from skills.sh:
- find-skills (vercel-labs/skills)
- test-driven-development (obra/superpowers)
- systematic-debugging (obra/superpowers)
- postgresql-table-design (wshobson/agents)
- seo-geo (resciencelab/opc-skills)
- shadcn-ui (google-labs-code/stitch-skills)
- supabase-postgres-best-practices (supabase/agent-skills)

## Installed to ~/.codex/skills
- find-skills
- test-driven-development
- systematic-debugging
- seo-geo
- shadcn-ui
- supabase-postgres-best-practices
- postgresql (resolved source path: wshobson/agents/plugins/database-design/skills/postgresql)

## Source Resolution Notes
- `shadcn-ui` had multiple sources on skills.sh. Installed: `google-labs-code/stitch-skills` per user request.
- `postgresql-table-design` on skills.sh maps to `wshobson/agents/plugins/database-design/skills/postgresql`.

## Gap Findings vs Current AI-Dev-Shop Toolkit

### 1) Skill Discovery and Installation Workflow
Current state:
- No built-in workflow in project skills for searching/updating external skills.

External coverage added:
- `find-skills` adds a repeatable process (`npx skills find/add/check/update`) for ecosystem discovery.

Gap:
- No local operating note in project docs for when to run discovery or how to evaluate candidate skill quality.

### 2) TDD Process Reinforcement
Current state:
- Local toolkit already has strong TDD structure (`agents/tdd/skills.md` + `skills/test-design/SKILL.md`).
- Focus is pipeline certification, coverage thresholds, and spec-hash alignment.

External coverage added:
- `test-driven-development` adds strict behavior-shaping guardrails: hard red-green-refactor discipline, anti-rationalization language, and explicit test-first enforcement heuristics.

Gap:
- Local toolkit is strong procedurally but less explicit on anti-rationalization signals and immediate restart behavior when test-first is violated.

### 3) Debugging Discipline
Current state:
- Local `harness-engineering/quality/debug-playbook.md` provides a concise reproduce/isolate/instrument/hypothesize loop.

External coverage added:
- `systematic-debugging` adds stronger phase gates, multi-component boundary instrumentation patterns, and architecture-escalation framing after repeated failed fixes.

Gap:
- Local playbook does not explicitly define phase-gated "no fix before root cause" policy language or multi-layer tracing templates.

### 4) Supabase + Postgres Performance Depth
Current state:
- Local `skills/supabase/SKILL.md` is strong on platform capabilities (RLS, PostgREST, client setup, realtime, storage, edge functions, auth).

External coverage added:
- `supabase-postgres-best-practices` provides deep performance references split by category (query/indexing, connection pooling, lock/concurrency, monitoring, advanced JSONB/FTS).

Gap:
- Local Supabase skill is platform-complete but not as deep on production performance tuning playbooks.

### 5) PostgreSQL Table Design
Current state:
- Local toolkit already includes `skills/postgresql/SKILL.md` and `skills/sql-data-modeling/SKILL.md`.

External coverage added:
- Installed `postgresql` skill overlaps heavily and can serve as a second opinion/checklist.

Gap:
- Low. This area is already strong locally.

### 6) Frontend Design and GEO Coverage
Current state:
- Local toolkit has architectural frontend guidance (`skills/feature-slice-design/SKILL.md`) and review/a11y assets.

External coverage added:
- `shadcn-ui`: practical component integration workflow and registry-driven usage.
- `seo-geo`: AI-search + traditional SEO execution playbook.

Gap:
- No dedicated local frontend component-library playbook for shadcn.
- No dedicated local SEO/GEO skill for discoverability and AI citation optimization.

## Priority Recommendations
1. Adopt `find-skills` operationally as a monthly capability scan and pre-feature discovery step.
2. Merge `systematic-debugging` phase gates into local debug playbook language (especially "no fixes before root cause" and multi-layer tracing).
3. Use `supabase-postgres-best-practices` as required companion reference whenever Database/Supabase agents touch query-heavy features.
4. Add a local shadcn integration note (component ownership, token mapping, customization boundaries) for frontend implementation consistency.
5. Add a local SEO/GEO skill if growth/discoverability is a product goal.

## Operational Note
Newly installed Codex skills are available in this environment, but restarting Codex is recommended after installation to ensure all clients pick up new skills consistently.
