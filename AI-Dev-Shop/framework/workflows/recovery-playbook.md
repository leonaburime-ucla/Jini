# Recovery Playbook

When a pipeline session ends mid-run (context limit hit, network drop, user closes session), the Coordinator uses this playbook to resume from the last valid checkpoint rather than restarting from scratch.

---

## Step 1 — Detect an Incomplete Run

At the start of every session, before doing anything else:

1. Ask the user: "Is there an active feature in progress?"
2. If yes, locate the canonical pipeline folder: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/`
3. Check for `pipeline-state.md` in that folder
4. If `pipeline-state.md` is missing, check for legacy `.pipeline-state.md` and treat it as the same run state file
5. If found and status is `IN_PROGRESS`, `WAITING_FOR_HUMAN`, or `ABORTED` → follow this playbook
6. If not found or status is `COMPLETE`, `FAILED`, or `CANCELLED` → start fresh

---

## Step 2 — Validate the Checkpoint

Before resuming, verify the checkpoint is trustworthy:

| Check | How | Fail Action |
|-------|-----|-------------|
| Spec provider is recorded | Read `spec_provider` from `pipeline-state.md` or fall back to default provider if the run predates provider recording | If unknown, stop and ask human whether to resume under Speckit compatibility mode or update the run |
| Spec hash matches | Re-hash the file at `spec_entrypoint_path` (or Speckit `feature.spec.md` via `spec_path` compatibility), compare to state file's `spec_hash` | Stop — spec may have changed. Escalate to human before resuming. |
| Provider validator passed | Read `validator_result`; if not `PASS`, rerun the provider-local validator. If `python3` is unavailable, try `python` or `py`; if runtime is still unavailable, require a human-approved single-line `validator_manual_waiver` | Stop — route back to Spec or human review before resuming at Software Architect or later. |
| Planning preflight valid | If resuming at or after `architect`, rerun Coordinator Planning Preflight from `multi-agent-pipeline.md` | Stop — route to the owning failed stage; do not resume downstream. |
| Red-Team clearance recorded | Defense-in-depth check covered by Planning Preflight: if resuming at or after `architect`, verify Red-Team completed against the same `spec_hash` and has no unresolved BLOCKING or CONSTITUTION_FLAG state | Stop — run Red-Team or resolve findings before resuming. |
| Reverse-spec checkpoint recorded | If `reverse_spec_artifacts` is not `N/A`, verify `reverse_spec_review_status: APPROVED` and the referenced `review-digest.md` exists | Stop — present the review digest to the human before resuming. |
| Blueprint approval recorded | If `system_blueprint_path` is set, verify `system_blueprint_status: APPROVED` | Stop — route back to System Design or human review. |
| Completed stage artifacts exist | Check that every file listed in Completed Stages actually exists on disk | If missing, treat that stage as incomplete and re-run it |
| Current stage output is partial | Check whether the in-progress stage produced any artifact | If artifact exists and looks complete, treat stage as done and advance |
| Constitution Check not bypassed | If resuming at or after `architect`, verify adr.md has a completed Constitution Check table | If missing, re-run architect stage |
| Progress ledger exists | If `progress_ledger_path` is set, verify the file exists and has current Next Actions / Resume Instructions | If missing or stale, recreate/update it before further dispatch |
| Offloaded evidence exists | If the progress ledger references offload files, verify those files still exist | Recreate the offload or record the missing evidence before resuming |

If the run still uses legacy `.pipeline-state.md`, rename it to `pipeline-state.md` before continuing so future resumes use the visible canonical filename.

---

## Step 3 — Resume Decision Tree

```
Is status WAITING_FOR_HUMAN?
  YES → Present the pending human checkpoint to the user. Wait for approval. Then continue from current_stage.
  NO (IN_PROGRESS) → Continue at current_stage using the resume rules below.
```

### Resume Rules by Stage

| Stage | Idempotent? | Resume Action |
|-------|-------------|---------------|
| `spec` | Yes | Re-dispatch Spec Agent with the provider-defined planning surface as input. Instruct it to continue, not restart. |
| `clarify` | Yes | Re-dispatch Spec Agent in clarify mode against the provider-defined clarification surface. |
| `architect` | Yes | Re-dispatch Software Architect Agent. Provide the provider-defined planning surface, existing research.md, and constitution.md. |
| `tasks` | Yes | Regenerate tasks.md from ADR. Safe to overwrite. |
| `tdd` | Yes | Re-dispatch TDD Agent. Provide existing partial test file if present. |
| `programmer` | **Partial** | Re-dispatch Programmer with existing code as context. Do not ask it to restart — continue from failing tests. |
| `testrunner` | Yes | Re-run. Pure reporting, no state. |
| `code-review` | Yes | Re-dispatch. Review is read-only. |
| `security` | Yes | Re-dispatch. Review is read-only. |
| `refactor` | Yes | Re-dispatch with same Code Review findings. |

**Partial** means: provide all existing artifacts as context. The agent should continue, not restart.

Before any resume dispatch, read `progress-ledger.md` if it exists and inject:

- current objective
- last verified good state
- next actions
- current hypothesis and failure-cluster note
- referenced offload summaries if the ledger points to large evidence files

---

## Step 4 — Update State File

After successfully resuming:

1. Update `last_updated_at` in the state file
2. Add a note in the Notes section: `"Resumed from checkpoint at <timestamp>. Prior session ended at stage: <stage>."`
3. Update the progress ledger's `last_updated_at`, `Recent Progress`, and `Resume Instructions`
4. Continue writing state updates as normal from that point forward

---

## What Not to Do

- Do not re-run completed stages unless their artifact is missing or the spec hash has changed
- Do not ask the human to re-approve checkpoints they already cleared (the checkbox record is the source of truth)
- Do not resume if the spec hash has changed — this is a blocking condition requiring human review
- Do not resume a `FAILED` run — start fresh and reference the failed run's Notes for context
- Do not skip the Constitution Check validation when resuming at or after the architect stage

---

## Upward Feedback Loop: Architecture Revision Request

If a downstream agent (TDD/Programmer/QA/TestRunner/Code Review) discovers a blocking architecture mismatch, it may raise:

`[ARCHITECTURE_REVISION_REQUEST]`

Required payload:
- Blocking constraint observed
- What was tried and why it failed
- Impacted artifacts (spec/ADR/tasks/tests)
- Requested revision scope (macro blueprint vs feature ADR)

Coordinator actions:
1. Pause affected downstream work.
2. Route to System Design Agent if revision is macro/domain-boundary level.
3. Route to Software Architect Agent if revision is feature-level technical architecture.
4. Require human approval on revised blueprint/ADR.
5. Resume from the last valid checkpoint using updated artifacts.
