# Job Lifecycle

Every agent dispatch is a job. Jobs have explicit lifecycle states. The Coordinator tracks job state in the active `pipeline-state.md` file and applies retry and backoff rules before escalating to a human.

---

## States

```
QUEUED → DISPATCHED → RUNNING → DONE
                              ↘ RETRYING → RUNNING (loop)
                              ↘ FAILED
                              ↘ ESCALATED
                              ↘ WAITING_FOR_HUMAN → RUNNING (after approval)
                              ↘ CANCELLED  (operator decision — terminal)
                              ↘ ABORTED    (external condition — terminal)
```

| State | Meaning |
|-------|---------|
| `QUEUED` | Coordinator has decided to dispatch but has not yet sent context to the agent |
| `DISPATCHED` | Agent context sent; waiting for first output |
| `RUNNING` | Agent is actively producing output |
| `DONE` | Agent produced a valid output satisfying its handoff contract |
| `RETRYING` | Output was rejected (failed validation, missing handoff contract, spec hash mismatch); queued for re-dispatch |
| `FAILED` | Retry budget exhausted; job cannot proceed without human intervention |
| `ESCALATED` | Coordinator has routed to human due to budget exhaustion or blocking condition |
| `WAITING_FOR_HUMAN` | Job is paused at a mandatory human checkpoint |
| `CANCELLED` | Human explicitly stopped the job. Intentional, no error. Record reason in `pipeline-state.md` Notes. |
| `ABORTED` | Job stopped due to external condition (context limit hit, session dropped, system error). Not intentional — resume via recovery playbook. |

---

## Retry Policy

| Stage | Max Retries | Backoff | Escalation Trigger |
|-------|-------------|---------|-------------------|
| `spec` | 2 | None — immediate | Unresolvable [NEEDS CLARIFICATION] after 2 passes |
| `clarify` | 1 | None | Human must provide answers directly |
| `architect` | 2 | None | Constitution violation without Complexity Justification entry |
| `tdd` | 3 | None | Same test failures after 3 cycles |
| `programmer` | 5 total retries across all clusters | Inject failure cluster summary each retry | Same failing cluster after 3 retries (escalate that cluster even if total budget not exhausted) |
| `testrunner` | 2 | None | Infrastructure/tooling failure (not test logic) |
| `code-review` | 1 | None | Rare — escalate if output is malformed |
| `security` | 1 | None | Escalate all Critical/High findings immediately |
| `coverage-loop` (tdd → programmer → testrunner cycle for gap fill) | 3 per High-priority gap cluster | None | Same High-priority gap cluster unresolved after 3 full cycles — escalate; Medium/Low gaps are deferred, not escalated |

**Backoff rule for Programmer retries 3+:**
Before dispatching retry 4 or 5, inject the full failure cluster history and ask the agent to reason about root cause before attempting a fix. Do not just re-dispatch with the same context — that produces the same result.

## Pre-Completion Gate

Before the Coordinator accepts `DONE` for implementation or verification stages, require the pre-completion checklist defined in `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/tripwires.md`.

Reject the handoff if:

- the checklist is missing
- the evidence is stale or partial
- the claimed completion does not map back to the active task/spec
- runtime-changing work required self-validation evidence and the handoff lacks either a self-validation report path or an explicit reason it was not run
- runtime-changing work claims `Self-Validation = PARTIAL` but does not record the failing step, attempts used, current hypothesis, and offload/report evidence
- verification handoffs omit current spec-hash verification, certified test-file
  hash status, executed vs expected test count, required-suite status, coverage
  status, or flaky-test status when those fields are required by the stage

## Loop-Detection Tripwires

Loop detection fires before budget exhaustion when any of these are true inside one failure cluster:

- the same file is edited 3 times
- the same command/test is rerun 3 times with materially identical failure output
- retry 2 ends without a materially new hypothesis

When a loop trigger fires:

1. keep the job in `RETRYING`
2. require a `Loop Alert` summary plus a different next approach
3. update the progress ledger before another retry
4. escalate early if no different approach exists

---

## Rejection Criteria

A job output is rejected (triggers `RETRYING`) if any of the following are true:

- Output does not reference the active spec version and hash
- Output references a stale spec hash or lacks mechanical hash verification when
  the stage is at or after TDD
- Handoff contract is missing or incomplete (no input refs, output summary, risks, or suggested next)
- Agent operated outside its assigned scope (e.g., Programmer refactored untouched code)
- Output contains a known failure marker (e.g., "[NEEDS CLARIFICATION]" left unresolved by Spec Agent)
- ADR is missing Constitution Check table or has unjustified EXCEPTION entries
- TDD certification lacks a test-file hash inventory or expected runnable test
  count
- TestRunner reports zero executed tests, skipped-only success, stale test-file
  hashes, missing required coverage artifacts, or unapproved flaky tests as a
  pass
- A specialist mutates `tasks.md` task status, `pipeline-state.md`, or another
  shared stage artifact without Coordinator delegation

---

## Escalation Criteria

Escalate to human (set state to `ESCALATED`) when:

- Any stage hits its max retry count
- Programmer: same failing cluster persists after 3 retries — this signals a spec or architecture problem, not a code problem
- Loop trigger fires and no materially different next approach is available
- Self-validation ends in `BLOCKER` because runtime evidence shows a confirmed critical-path, auth/security, data-loss, or migration-stop problem
- Security: any Critical or High finding
- Spec hash changes mid-run
- Certified test-file hashes change without TDD recertification or Coordinator
  waiver
- Required coverage evidence is unavailable for a required suite
- Unapproved flaky tests remain in the advancement path
- Two agents produce directly conflicting guidance
- Constitution violation in ADR without a corresponding Complexity Justification row (same severity as spec hash mismatch)

`Self-Validation = PARTIAL` is not an automatic escalation. If the bounded retry path was used and the failure is recorded clearly, the Coordinator may continue downstream with the warning preserved.

---

## Recording Job State

In `pipeline-state.md`, update the Current Stage Detail block at every state transition:

```markdown
## Current Stage Detail

- stage: programmer
- dispatched_at: 2026-02-22T15:13:00Z
- job_status: RETRYING
- retry_count: 2
- last_output_summary: AC-03 and AC-07 still failing; timeout edge case not handled
```

When a job reaches `DONE`, move it to the Completed Stages table and clear the Current Stage Detail block for the next stage.

---

## Coordinator Modes and Job Lifecycle

- Jobs only exist in **Pipeline Mode**. In Review Mode and Direct Mode, no jobs are created.
- When user switches from Review Mode to Pipeline Mode, a new job is created at `QUEUED` state.
- When user switches to Direct Mode, any in-progress jobs are set to `WAITING_FOR_HUMAN` (not cancelled) — resumable on return to coordinator mode.
- Debug mode does not affect job state — it only controls trace verbosity.
