# Doc Staleness Watchlist

High-risk docs that should be reviewed against concrete repo artifacts on a recurring cadence.

| Doc | Verify Against | Cadence Days | Last Reviewed | Reason |
|---|---|---:|---|---|
| `AGENTS.md` | `agents/`, `skills/coordination/SKILL.md`, `framework/workflows/multi-agent-pipeline.md`, `framework/operations/pipeline-quickstart.md` | 30 | 2026-03-22 | Root runtime map must stay aligned with actual routing and workflow docs. |
| `framework/operations/pipeline-quickstart.md` | `AGENTS.md`, `framework/workflows/multi-agent-pipeline.md`, `framework/routing/file-trigger-table.md` | 30 | 2026-03-22 | Quickstart is the human-readable map and must reflect current routing defaults. |
| `framework/routing/file-trigger-table.md` | `agents/`, `skills/coordination/SKILL.md` | 21 | 2026-03-22 | Trigger routing should stay aligned with current agent ownership. |
| `framework/workflows/multi-agent-pipeline.md` | `agents/`, `framework/templates/`, `framework/routing/file-trigger-table.md` | 30 | 2026-03-22 | Stage context and routing assumptions drift easily when new docs land. |
| `harness-engineering/runtime/context-offloading.md` | `agents/coordinator/skills.md`, `agents/programmer/skills.md`, `agents/testrunner/skills.md` | 30 | 2026-03-22 | Offloading rules should match the actual roles expected to apply them. |
| `harness-engineering/quality/load-bearing-harness-audit.md` | `harness-engineering/maintenance/observer-cadence.md`, `harness-engineering/runtime/session-continuity.md`, `harness-engineering/runtime/self-validation.md`, `harness-engineering/quality/evaluation-loops.md` | 30 | 2026-03-25 | Model-upgrade pruning rules must stay aligned with the continuity and evaluation docs they influence. |
