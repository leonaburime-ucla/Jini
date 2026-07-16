# Trace Schema

Structured fields for every agent dispatch and handoff. The Observer emits a trace entry at every dispatch and completion. Traces are appended to `<ADS_MEMORY_ROOT>/knowledge/memory-store.md` as `[TRACE]` entries or to a dedicated `traces/` log file for the active feature run.

---

## Trace Entry Format

```markdown
---
## [TRACE] <stage> dispatch / completion

- trace_id: TRACE-<YYYYMMDD>-<NNN>
- run_id: <matches pipeline-state.md run_id>
- feature: <NNN-feature-name>
- stage: <stage name>
- agent: <agent name>
- event: DISPATCHED | COMPLETED | RETRIED | ESCALATED | CANCELLED | ABORTED
- started_at: <ISO-8601 UTC>
- completed_at: <ISO-8601 UTC> | null
- duration_ms: <integer> | null
- status: DONE | RETRYING | FAILED | ESCALATED | WAITING_FOR_HUMAN | CANCELLED | ABORTED
- retry_count: <integer>
- spec_hash: <sha256>
- input_hash: <sha256 of inputs provided to agent>
- output_hash: <sha256 of output produced> | null
- constitution_check: PASSED | FAILED | N/A
- errors: <list of error messages, or empty>
- tags: <list of tags for Observer queries>
```

---

## Debug Trace Entry (emitted when debug mode is ON)

```
[DEBUG] <ISO-8601 UTC>
Stage: <stage name>
Agent: <agent being dispatched or completing>
Event: DISPATCHED | COMPLETED | GATE_CHECK | MODE_SWITCH
Inputs: <key inputs — spec hash, ADR ref, task IDs>
Decision: <brief rationale>
Gate checks: <list of conditions verified>
Output summary: <what was produced or decided>
```

Debug entries are only emitted when `debug: on` is active. They do not replace regular trace entries.

---

## Storage Options

**Option A — Append to memory-store.md** (simple, single file)
Add `[TRACE]` entries to `<ADS_MEMORY_ROOT>/knowledge/memory-store.md`. Use for small features or when simplicity is preferred. Downside: mixes traces with DECISION/FAILURE/FACT/CONSTITUTION entries.

**Option B — Dedicated trace log** (preferred for long runs)
Append to `specs/<NNN>-<feature-name>/traces.md`. Self-contained per feature, easier to audit. Observer reads this file for pattern analysis.

---

## Signals to Surface

The Observer reads trace logs to produce these signals:

| Signal | How to Derive |
|--------|--------------|
| Failure rate by stage | Count `status: FAILED` grouped by `stage` |
| Average retry count per stage | Average `retry_count` grouped by `stage` |
| Spec drift events | Count entries where `spec_hash` differs from the run's starting hash |
| Escalation rate | Count `event: ESCALATED` per feature |
| Constitution check failures | Count `constitution_check: FAILED` grouped by `stage` |
| Slowest stages | Highest average `duration_ms` by stage |
| Stale dispatches | `completed_at: null` entries older than current session |

---

## Observer Responsibilities

- Write a `DISPATCHED` trace entry when the Coordinator dispatches any agent
- Write a `COMPLETED` trace entry when the agent returns output (include output_hash and duration)
- Write a `RETRIED` entry on each retry, incrementing retry_count
- For Software Architect stage: record `constitution_check` result
- At end of pipeline run, produce a trace summary in the cycle summary output
- Weekly: aggregate signals from all feature traces — pay particular attention to constitution_check failure trends
