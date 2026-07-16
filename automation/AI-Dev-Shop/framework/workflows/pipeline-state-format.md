# Pipeline State Format

Every pipeline run writes a `pipeline-state.md` file to the active feature's canonical pipeline folder in the project-owned sibling workspace. The Coordinator reads this file at the start of every session to detect and resume incomplete runs.

**Location:** `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/pipeline-state.md`

Status and confidence labels follow
`<AI_DEV_SHOP_ROOT>/framework/workflows/status-confidence-taxonomy.md`. Pipeline
state records routing consequences; it does not translate source evidence labels
into different confidence systems.

Legacy note: older runs may still use `.pipeline-state.md`. Treat that as the previous filename and migrate it to `pipeline-state.md` when the run is next resumed or updated.

---

## File Format

```markdown
# Pipeline State

- run_id: <uuid or timestamp-based ID, e.g. 2026-02-22T14:30:00Z>
- feature: <NNN>-<feature-name>
- coordinator_mode: review | pipeline | direct
- debug_mode: on | off
- spec_provider: <speckit | openspec | bmad | other>
- provider_native_root: <upstream-native conceptual root, e.g. specs/ | openspec/ | _bmad-output/>
- provider_output_root: <actual durable output root for this run, default under ADS-memory/specs/>
- spec_version: <version>
- spec_hash: <sha256>
- spec_entrypoint_path: <provider-defined planning entrypoint path>
- spec_readiness_artifact: <provider-defined readiness artifact path>
- spec_support_paths: <comma-separated list or N/A>
- spec_mode: greenfield | brownfield | migration | reverse_spec
- provider_mode: <provider-specific mode or compatibility/native track, or N/A>
- validator_result: PASS | FAIL | NOT_RUN
- validator_manual_waiver: <single-line reviewer/timestamp/reason/manual checks string, or N/A>
- spec_hash_verified_at: <ISO-8601 UTC or N/A>
- planning_preflight_status: NOT_RUN | PASS | FAIL
- planning_preflight_checked_at: <ISO-8601 UTC or N/A>
- planning_preflight_spec_hash: <sha256 or N/A>
- planning_preflight_failures: <summary or N/A>
- red_team_status: NOT_RUN | PASS | ADVISORY_ONLY | BLOCKING | CONSTITUTION_FLAG
- red_team_spec_hash: <sha256 or N/A>
- red_team_artifact: <path or N/A>
- red_team_completed_at: <ISO-8601 UTC or N/A>
- red_team_human_decision: APPROVED | REVISE | N/A
- system_blueprint_path: <path or N/A>
- system_blueprint_status: NOT_RUN | DRAFT | APPROVED | REVISE | N/A
- codebase_analysis_reports: <comma-separated ANALYSIS/MIGRATION/TESTABILITY paths or N/A>
- reverse_spec_artifacts: <comma-separated reverse-spec artifact paths or N/A>
- reverse_spec_review_status: NOT_APPLICABLE | PENDING | APPROVED | REVISE
- tasks_artifact: <path or N/A>
- test_certification_artifact: <path or N/A>
- test_certification_hash: <sha256 or N/A>
- verification_packet_artifact: <path or N/A>
- verification_packet_hash: <sha256 or N/A>
- test_file_hash_status: NOT_RUN | PASS | FAIL | N/A
- latest_testrunner_report: <path or N/A>
- testrunner_status: NOT_RUN | PASS | FAIL | UNAVAILABLE | BLOCKED
- executed_test_count: <integer or N/A>
- expected_test_count: <integer or N/A>
- required_suite_status: PASS | FAIL | PARTIAL | N/A
- coverage_status: NOT_RUN | PASS | FAIL | UNAVAILABLE | N/A
- flaky_test_status: NONE | KNOWN_APPROVED | UNAPPROVED | N/A
- code_review_gate_status: NOT_READY | READY | WAIVED
- started_at: <ISO-8601 UTC>
- last_updated_at: <ISO-8601 UTC>
- progress_ledger_path: <ADS_MEMORY_ROOT>/reports/pipeline/.../progress-ledger.md or <ADS_MEMORY_ROOT>/reports/continuity/.../progress-ledger.md
- current_stage: <stage name — see Stages below>
- status: IN_PROGRESS | WAITING_FOR_HUMAN | COMPLETE | FAILED | CANCELLED | ABORTED

## Completed Stages

| Stage | Completed At | Output Artifact | Output Hash |
|-------|-------------|-----------------|-------------|
| spec | 2026-02-22T14:32:00Z | <provider-defined spec entrypoint> | sha256:abc... |
| architect | 2026-02-22T15:10:00Z | ADS-memory/reports/pipeline/001-feature/adr.md | sha256:def... |
| tasks | 2026-02-22T15:12:00Z | ADS-memory/reports/pipeline/001-feature/tasks.md | sha256:ghi... |

## Current Stage Detail

- stage: tdd
- dispatched_at: 2026-02-22T15:13:00Z
- job_status: QUEUED | DISPATCHED | RUNNING | DONE | RETRYING | FAILED | ESCALATED | WAITING_FOR_HUMAN | CANCELLED | ABORTED
- retry_count: 0
- current_hypothesis: <one sentence or N/A>
- last_output_summary: <one sentence>

## Parallel Task Tracking

| Task ID | Owner Agent | Scope / Files | Status | Started At | Completed At | Blocks |
|---------|-------------|---------------|--------|------------|--------------|--------|
| T008 | TDD | `tests/...` | QUEUED | N/A | N/A | T010 |

Only the Coordinator updates task status and checkboxes in `tasks.md`.
Specialist agents may report task progress in handoffs, but do not mutate this
table unless explicitly delegated. Parallel tasks must have non-overlapping
write scopes; if a shared utility, test-certification record, coverage artifact,
or state file needs updates, serialize that update through the Coordinator or a
single owner.

## Iteration Counts

| Stage | Cycle Count | Budget | Status |
|-------|-------------|--------|--------|
| tdd | 1 | 3 | WITHIN_BUDGET |
| programmer | 0 | 5 | NOT_STARTED |

## Failure Clusters

| Cluster | First Seen | Retry Count | Stage | Notes |
|---------|-----------|-------------|-------|-------|
| AC-03 timeout edge case | 2026-02-22T15:20:00Z | 2 | programmer | |

## Human Checkpoints Cleared

- [ ] Spec approval
- [ ] Reverse-spec review digest approval (if applicable)
- [ ] System blueprint approval (if produced)
- [ ] Red-Team clearance
- [ ] Architecture sign-off (includes Constitution Check)
- [ ] Convergence escalation (if triggered)
- [ ] Security sign-off

## Notes

<free-form notes from Coordinator, e.g. "AC-05 deferred to next spec revision", "Security agent flagged Medium finding, tracked in adr.md", "Constitution Article III exception logged in ADR">
```

---

## Field Reference

### `progress_ledger_path` (required for resumable or long-running work)

```markdown
progress_ledger_path: <ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/progress-ledger.md
```

Points to the human/agent-readable resume surface defined in `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/session-continuity.md`.

- Required when work is expected to cross sessions, handoffs, or retry-heavy loops
- Recommended for any feature that reaches programmer retry 2+
- If absent on a resumable run, the Coordinator should create it before further dispatch

### `coordinator_mode` (required)

```
coordinator_mode: review | pipeline | direct
```

Tracks the Coordinator's current operating mode:
- `pipeline` — full multi-agent pipeline is active; jobs are created and tracked
- `review` — Coordinator is reviewing artifacts or answering questions; no jobs are created
- `direct` — user is working directly with a single agent; in-progress jobs are set to WAITING_FOR_HUMAN, not cancelled

### `debug_mode` (optional, default: off)

```
debug_mode: on | off
```

When `on`, the Observer emits `[DEBUG]` trace entries at every dispatch, gate check, and mode switch. Does not affect job state or pipeline logic — controls trace verbosity only.

### `spec_provider` (required for new runs)

```markdown
spec_provider: speckit | openspec | bmad | other
```

Records which upstream planning provider owns the spec surface for this run.

Legacy runs may omit this field. In that case, treat the run as Speckit compatibility mode unless a human says otherwise.

### `provider_native_root` and `provider_output_root` (required for new runs)

```markdown
provider_native_root: <upstream-native conceptual root>
provider_output_root: <actual durable output root>
```

- `provider_native_root` records the upstream provider's conceptual surface, such as `specs/`, `openspec/`, or `_bmad-output/`
- `provider_output_root` records the actual path AI Dev Shop wrote for this run; the default root is under `<ADS_MEMORY_ROOT>/specs/`
- downstream agents must use recorded actual paths, not infer write targets from upstream-native examples

### `spec_entrypoint_path` and `spec_readiness_artifact` (required for new runs)

```markdown
spec_entrypoint_path: <provider-defined requirements entrypoint>
spec_readiness_artifact: <provider-defined readiness artifact>
```

- `spec_entrypoint_path` is the file used for drift detection and resume hashing
- `spec_readiness_artifact` is the file or artifact used to prove the planning surface is ready for architecture work
- for the default Speckit provider, these typically map to `feature.spec.md` and `spec-dod.md`
- new AI Dev Shop runs should normally place these paths under `<ADS_MEMORY_ROOT>/specs/`

### Planning preflight fields (required before Software Architect dispatch)

```markdown
planning_preflight_status: NOT_RUN | PASS | FAIL
planning_preflight_checked_at: <ISO-8601 UTC or N/A>
planning_preflight_spec_hash: <sha256 or N/A>
planning_preflight_failures: <summary or N/A>
```

The Coordinator writes these fields when `/plan`, manual Software Architect dispatch, or
resume validation reaches the architecture boundary. `PASS` means provider
readiness, hash verification, human approval, Red-Team clearance, blueprint
status, reverse-spec review, and brownfield evidence wiring have all passed for
the same spec hash.

Preflight relies on the primary provider validator and Red-Team fields for
validator and adversarial-review status. Do not duplicate those values into
separate preflight-specific status fields.

### Validator waiver fields (allowed only when the validator runtime is unavailable)

```markdown
validator_result: PASS | FAIL | NOT_RUN
validator_manual_waiver: reviewer=<name>; timestamp=<ISO-8601 UTC>; reason=<why runtime unavailable>; manual_checks=<checks performed>
```

Provider-local validators are mandatory before Software Architect dispatch. A manual
waiver is not a substitute for fixing a failing validator; it exists only when
the required runtime cannot be executed in the host environment. The waiver must
stay on one line using semicolon-separated fields so state parsers do not split
or drop waiver evidence.

### Brownfield and reverse-spec fields

```markdown
system_blueprint_path: <path or N/A>
system_blueprint_status: NOT_RUN | DRAFT | APPROVED | REVISE | N/A
codebase_analysis_reports: <ANALYSIS/MIGRATION/TESTABILITY paths or N/A>
reverse_spec_artifacts: <merged requirements, review digest, manifest, coverage map, consumer inventory, intentional changes, characterization tests, or N/A>
reverse_spec_review_status: NOT_APPLICABLE | PENDING | APPROVED | REVISE
```

Existing-codebase features and rewrites use these fields so Coordinator can
prove the Software Architect saw the sampled codebase evidence and any reverse-spec
human checkpoint before architecture decisions are made.

### Verification and review gate fields

```markdown
tasks_artifact: <path or N/A>
test_certification_artifact: <path or N/A>
test_certification_hash: <sha256 or N/A>
verification_packet_artifact: <path or N/A>
verification_packet_hash: <sha256 or N/A>
test_file_hash_status: NOT_RUN | PASS | FAIL | N/A
latest_testrunner_report: <path or N/A>
testrunner_status: NOT_RUN | PASS | FAIL | UNAVAILABLE | BLOCKED
executed_test_count: <integer or N/A>
expected_test_count: <integer or N/A>
required_suite_status: PASS | FAIL | PARTIAL | N/A
coverage_status: NOT_RUN | PASS | FAIL | UNAVAILABLE | N/A
flaky_test_status: NONE | KNOWN_APPROVED | UNAPPROVED | N/A
code_review_gate_status: NOT_READY | READY | WAIVED
```

The Coordinator updates these fields after accepting TDD and TestRunner outputs.
`code_review_gate_status` may be `READY` only when the Coordinator verification
packet is PASS for the active spec hash, certified test-file hashes match,
executed tests are greater than zero and meet/exceed the certified expected
count, required suites and coverage gates pass or are explicitly N/A, and no
unapproved flaky tests remain. A waiver must name the human reviewer, timestamp,
scope, reason, and remaining risk in Notes.

---

## Stages (Valid Values for `current_stage`)

| Stage | Description |
|-------|-------------|
| `spec` | Spec Agent writing or revising spec |
| `clarify` | Spec Agent resolving [NEEDS CLARIFICATION] markers |
| `architect` | Software Architect Agent producing research.md + ADR |
| `tasks` | Coordinator generating tasks.md |
| `tdd` | TDD Agent writing and certifying tests |
| `programmer` | Programmer Agent implementing |
| `qa-e2e` | QA/E2E Agent writing browser tests |
| `testrunner` | TestRunner Agent verifying pass rate |
| `code-review` | Code Review Agent classifying findings |
| `security` | Security Agent reviewing threat surface |
| `devops` | DevOps Agent producing IaC/CI/deployment configs |
| `docs` | Docs Agent generating user-facing documentation |
| `refactor` | Refactor Agent proposing improvements |
| `done` | Pipeline complete, artifacts shipped |

---

## Write Rules

- The Coordinator writes or updates `pipeline-state.md` at every stage transition.
- Keep `progress_ledger_path` current when a progress ledger exists.
- Update `current_hypothesis` whenever a retry changes approach.
- After each human checkpoint is cleared, mark the corresponding checkbox.
- Never delete a completed stage row — append only.
- On FAILED status, write the failure reason to Notes before stopping.

---

## Read Rules

- At session start, the Coordinator checks for `pipeline-state.md` in the active feature folder under `<ADS_MEMORY_ROOT>/reports/pipeline/`.
- If found and status is `IN_PROGRESS` or `WAITING_FOR_HUMAN`, follow the Recovery Playbook (`<AI_DEV_SHOP_ROOT>/framework/workflows/recovery-playbook.md`).
- If found and status is `ABORTED`, treat as resumable — follow the Recovery Playbook.
- If `progress_ledger_path` is present, read the ledger before resuming or retrying.
- If the ledger references offloaded evidence files, verify they still exist before resuming.
- If found and status is `COMPLETE`, `FAILED`, or `CANCELLED`, do not resume — start a new run or treat as reference only.
- If not found, create a new one at the start of the spec stage.

---

## Example: Mid-Run State (Programmer stage, active retry cluster)

```markdown
# Pipeline State

- run_id: 2026-02-22T14:30:00Z
- feature: 003-csv-invoice-export
- coordinator_mode: pipeline
- debug_mode: off
- spec_version: 1.1.0
- spec_hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- started_at: 2026-02-22T14:30:00Z
- last_updated_at: 2026-02-22T17:45:00Z
- progress_ledger_path: ADS-memory/reports/pipeline/003-csv-invoice-export/progress-ledger.md
- current_stage: programmer
- spec_provider: speckit
- provider_native_root: specs/
- provider_output_root: ADS-memory/specs/003-csv-invoice-export/
- status: IN_PROGRESS
- spec_entrypoint_path: ADS-memory/specs/003-csv-invoice-export/feature.spec.md
- spec_readiness_artifact: ADS-memory/specs/003-csv-invoice-export/spec-dod.md
- spec_support_paths: ADS-memory/specs/003-csv-invoice-export/api.spec.md, ADS-memory/specs/003-csv-invoice-export/state.spec.md, ADS-memory/specs/003-csv-invoice-export/orchestrator.spec.md, ADS-memory/specs/003-csv-invoice-export/ui.spec.md, ADS-memory/specs/003-csv-invoice-export/errors.spec.md, ADS-memory/specs/003-csv-invoice-export/behavior.spec.md, ADS-memory/specs/003-csv-invoice-export/traceability.spec.md, ADS-memory/specs/003-csv-invoice-export/spec-manifest.md
- spec_mode: greenfield
- provider_mode: compatibility
- validator_result: PASS
- validator_manual_waiver: N/A
- spec_hash_verified_at: 2026-02-22T14:54:00Z
- planning_preflight_status: PASS
- planning_preflight_checked_at: 2026-02-22T14:56:00Z
- planning_preflight_spec_hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- planning_preflight_failures: N/A
- red_team_status: PASS
- red_team_spec_hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- red_team_artifact: ADS-memory/reports/pipeline/003-csv-invoice-export/red-team-findings.md
- red_team_completed_at: 2026-02-22T14:55:00Z
- red_team_human_decision: N/A
- system_blueprint_path: N/A
- system_blueprint_status: N/A
- codebase_analysis_reports: N/A
- reverse_spec_artifacts: N/A
- reverse_spec_review_status: NOT_APPLICABLE
- tasks_artifact: ADS-memory/reports/pipeline/003-csv-invoice-export/tasks.md
- test_certification_artifact: ADS-memory/reports/pipeline/003-csv-invoice-export/test-certification.md
- test_certification_hash: sha256:c1d4e7f2a9b5083f74ce05a3b216d9f4e8a3072c6d9f4183b7e0a2d5f8c1b4e
- verification_packet_artifact: N/A
- verification_packet_hash: N/A
- test_file_hash_status: NOT_RUN
- latest_testrunner_report: N/A
- testrunner_status: NOT_RUN
- executed_test_count: N/A
- expected_test_count: 18
- required_suite_status: N/A
- coverage_status: NOT_RUN
- flaky_test_status: N/A
- code_review_gate_status: NOT_READY

## Completed Stages

| Stage | Completed At | Output Artifact | Output Hash |
|-------|-------------|-----------------|-------------|
| spec | 2026-02-22T14:32:00Z | specs/003-csv-invoice-export/feature.spec.md | sha256:a3f8... |
| red-team | 2026-02-22T14:55:00Z | ADS-memory/reports/pipeline/003-csv-invoice-export/red-team-findings.md | sha256:b1c4... |
| architect | 2026-02-22T15:30:00Z | ADS-memory/reports/pipeline/003-csv-invoice-export/adr.md | sha256:b9e2... |
| tasks | 2026-02-22T15:32:00Z | ADS-memory/reports/pipeline/003-csv-invoice-export/tasks.md | sha256:c7d3... |
| tdd | 2026-02-22T16:10:00Z | ADS-memory/reports/pipeline/003-csv-invoice-export/test-certification.md | sha256:c1d4... |

## Current Stage Detail

- stage: programmer
- dispatched_at: 2026-02-22T16:15:00Z
- job_status: RETRYING
- retry_count: 2
- current_hypothesis: CSV escaping logic wraps fields correctly but does not double embedded quotes
- last_output_summary: AC-06 and AC-07 (CSV escaping) still failing; double-quote escape logic inverted

## Iteration Counts

| Stage | Cycle Count | Budget | Status |
|-------|-------------|--------|--------|
| tdd | 1 | 3 | WITHIN_BUDGET |
| programmer | 2 | 5 | WITHIN_BUDGET |

## Failure Clusters

| Cluster | First Seen | Retry Count | Stage | Notes |
|---------|-----------|-------------|-------|-------|
| AC-06/AC-07 RFC4180 escaping | 2026-02-22T16:20:00Z | 2 | programmer | Double-quote escape logic inverted — wraps but does not double internal quotes |

## Human Checkpoints Cleared

- [x] Spec approval
- [x] Red-Team clearance
- [x] Architecture sign-off (includes Constitution Check)
- [ ] Convergence escalation (if triggered)
- [ ] Security sign-off

## Notes

Resumed from checkpoint at 2026-02-22T17:00:00Z. Prior session ended during programmer retry 1.
AC-06/AC-07 cluster: if retry count reaches 3, escalate — this may be a spec precision issue on INV-01.
```
