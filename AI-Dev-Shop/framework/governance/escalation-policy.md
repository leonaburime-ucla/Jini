# Escalation Policy

Defines when agents must stop and escalate to a human, what the retry budgets are per stage, and what distinguishes a recoverable failure from a systemic problem. This document governs all escalation decisions in the pipeline.

Supplements the convergence policy in `<AI_DEV_SHOP_ROOT>/AGENTS.md` and the resume logic in `<AI_DEV_SHOP_ROOT>/framework/workflows/recovery-playbook.md`.

---

## Escalation Triggers (Blocking — Pipeline Halts)

The following conditions halt the pipeline immediately. The Coordinator must surface the issue to the human and wait for a decision before any further dispatch.

| Trigger | Stage | What to Surface to Human |
|---------|-------|--------------------------|
| Spec hash mismatch between dispatch and agent output | Any | The two hashes, which file changed, when it changed |
| 3+ BLOCKING findings from Red-Team Agent | post-spec | All BLOCKING findings with exact spec refs; recommended spec changes |
| CONSTITUTION_FLAG from Red-Team Agent | post-spec | The flag, the relevant constitution article, the spec text in question |
| Constitution violation without documented exception | architect | The article violated, the ADR section, what the unjustified decision was |
| Security finding classified Critical or High | security | Full finding, exploit scenario, proposed mitigation |
| Same failure cluster persists after hitting retry budget (see below) | programmer, tdd | Cluster ID, all failing tests, retry count, spec ACs involved, hypothesis |
| [NEEDS CLARIFICATION] marker reaches Software Architect stage unresolved | architect dispatch | The marker text, what decision is blocked, options identified |
| Spec discovered to be wrong mid-implementation | programmer | What the code reveals, what the spec says, recommended spec revision |

---

## Retry Budgets Per Stage

When a stage fails, the Coordinator re-dispatches up to the budget defined in `<AI_DEV_SHOP_ROOT>/framework/workflows/job-lifecycle.md`. On budget exhaustion, escalate to human and stop retrying.

`job-lifecycle.md` is the single source of truth for retry counts, backoff behavior, and per-stage escalation thresholds. Do not duplicate numeric budgets in this document.

**Budget tracking:** The Coordinator records retry counts in the `Iteration Counts` table of `pipeline-state.md`. An agent may not be dispatched if its stage is at budget — escalate first.

---

## Escalation Severity Levels

| Level | Examples | Human Action Required |
|-------|----------|----------------------|
| **BLOCKING** | Spec hash mismatch, Critical/High security finding, constitution violation | Full stop. Human decision before any dispatch. |
| **ADVISORY** | Red-Team ADVISORY finding, Medium security finding, Recommended code review finding | Pipeline continues. Human informed. Human may intervene or accept. |
| **FLAG** | Observer drift alert, Low security finding, scorecard regression | Logged. Surfaced in next Observer report. No immediate stop. |

---

## What Escalation Is Not

Do not escalate for:
- Expected test failures during `programmer` cycles (within budget)
- Red-Team findings classified as ADVISORY only
- Refactor proposals the Refactor Agent disagrees with
- Architecture alternatives the Software Architect considered and rejected with documentation
- Observer recommendations (these are inputs to future work, not stops)
- Self-validation runs that end `PARTIAL` after the bounded retry path, provided the report records the exact failing step, evidence, current hypothesis, and remaining risk

Escalating for non-blocking issues erodes human trust in escalations and causes humans to ignore them. Reserve escalation for conditions that genuinely require a human decision.

---

## Escalation Message Format

When surfacing to the human, the Coordinator must include:

```
ESCALATION — [BLOCKING / ADVISORY / FLAG]

Feature: FEAT-<NNN> — <feature name>
Stage: <pipeline stage>
Trigger: <one sentence — which rule was hit>

Evidence:
<specific artifact references, quotes, hashes>

Options:
A. <option and consequence>
B. <option and consequence>
C. Abort this feature run

Waiting for human decision.
```

The Coordinator does not suggest a preference unless asked. Present options neutrally.

---

## After Human Decision

1. Record the decision in `pipeline-state.md` Notes section: what was decided, by whom, when
2. If the decision results in a spec revision, the spec hash changes — all downstream artifacts (ADR, test certification) are invalidated and must be re-run
3. If the decision results in a constitution exception, the Software Architect must document it in the ADR Complexity Justification table before the pipeline resumes
4. Mark the relevant human checkpoint checkbox in `pipeline-state.md`

---

## Systemic vs. One-Off Failures

The Observer Agent distinguishes:

- **One-off failure**: A cluster appears once, resolves within budget, does not recur across features. Log as `[FAILURE]` in memory-store, no further action.
- **Systemic failure**: Same cluster type appears in 3+ features, or same agent consistently requires max retries. This signals a skills.md problem, not a feature problem. Observer flags to Coordinator; Coordinator surfaces to human with a skills.md update recommendation.

Systemic failure escalation goes in the Observer's weekly pattern report, not as a blocking pipeline escalation.
