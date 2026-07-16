# Agent Performance Scorecard

Written and maintained by the Observer Agent. Tracks per-agent quality trends across pipeline runs. Feeds skills.md update decisions with evidence rather than intuition.

The Observer updates this file after each feature ships and produces a full scoring pass weekly. The Coordinator reads this file when considering whether to include Observer recommendations in dispatch context.

---

## How Scores Are Computed

Each agent is scored on the dimensions defined in `<AI_DEV_SHOP_ROOT>/skills/evaluation/eval-rubrics.md` using LLM-as-judge methodology. Scores are 1–5 per dimension. The composite score is the unweighted mean, rounded to one decimal place.

A **regression** is a composite score drop of >1.0 vs. the agent's rolling 4-run baseline. Regressions are flagged to the Coordinator immediately, not held for the weekly report.

Scores reference specific memory-store.md `[QUALITY]` entry IDs as evidence. Scores without evidence references are not valid — the Observer must cite what it observed.

---

## Scorecard

### Spec Agent

| Run | Feature | Completeness | Testability | Ambiguity Resolution | Constitution Check | Composite | Evidence |
|-----|---------|-------------|-------------|---------------------|-------------------|-----------|---------|
| — | — | — | — | — | — | — | — |

**Baseline:** Not yet established (requires 4+ runs)

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Architect Agent

| Run | Feature | Pattern Fit | Constitution Compliance | Complexity Justification | Research Depth | Composite | Evidence |
|-----|---------|------------|------------------------|--------------------------|---------------|-----------|---------|
| — | — | — | — | — | — | — | — |

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### TDD Agent

| Run | Feature | AC Coverage | Test Isolation | Edge Case Coverage | Cert Hash Match | Composite | Evidence |
|-----|---------|------------|---------------|-------------------|----------------|-----------|---------|
| — | — | — | — | — | — | — | — |

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Programmer Agent

| Run | Feature | Spec Alignment | Test Pass Rate at Handoff | Scope Discipline | Code Quality | Composite | Evidence |
|-----|---------|--------------|--------------------------|-----------------|-------------|-----------|---------|
| — | — | — | — | — | — | — | — |

**Defect escape rate:** Not yet established
(Defect escape = Required code review findings that should have been caught by Programmer self-review before handoff, divided by total Required findings.)

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Code Review Agent

| Run | Feature | Finding Classification Accuracy | Spec Alignment Coverage | Security Surface Detection | Composite | Evidence |
|-----|---------|--------------------------------|------------------------|--------------------------|-----------|---------|
| — | — | — | — | — | — | — |

**False negative rate:** Not yet established
(False negative = Security finding later caught by Security Agent that should have been flagged by Code Review.)

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Security Agent

| Run | Feature | Threat Coverage | Finding Severity Accuracy | Exploit Scenario Quality | Composite | Evidence |
|-----|---------|----------------|--------------------------|------------------------|-----------|---------|
| — | — | — | — | — | — | — |

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Red-Team Agent

| Run | Feature | BLOCKING Accuracy | ADVISORY Signal Quality | Constitution Pre-flight | Composite | Evidence |
|-----|---------|------------------|------------------------|------------------------|-----------|---------|
| — | — | — | — | — | — | — |

**False BLOCKING rate:** Not yet established
(False BLOCKING = a BLOCKING finding that the Architect resolved without spec revision, suggesting the Red-Team over-classified.)

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

### Coordinator

| Run | Feature | Routing Correctness | Context Injection Quality | Escalation Judgment | Budget Tracking | Composite | Evidence |
|-----|---------|--------------------|--------------------------|--------------------|----------------|-----------|---------|
| — | — | — | — | — | — | — | — |

**Baseline:** Not yet established

**Recurring issues:** None logged

**Recommended skills.md updates:** None pending

---

## Cross-Agent Trends

Updated weekly by Observer.

| Pattern | First Seen | Occurrences | Affected Agents | Status | Action |
|---------|-----------|-------------|----------------|--------|--------|
| — | — | — | — | — | — |

---

## Constitution Compliance Frequency

Tracks which articles are most often challenged, excepted, or violated. High frequency on an article may indicate the article needs clarifying guidance rather than the agents making mistakes.

| Article | Exception Count | Violation Count | Most Recent Feature | Notes |
|---------|----------------|----------------|---------------------|-------|
| I — Library-First | 0 | 0 | — | |
| II — Test-First | 0 | 0 | — | |
| III — Simplicity Gate | 0 | 0 | — | |
| IV — Anti-Abstraction Gate | 0 | 0 | — | |
| V — Integration-First Testing | 0 | 0 | — | |
| VI — Security-by-Default | 0 | 0 | — | |
| VII — Spec Integrity | 0 | 0 | — | |
| VIII — Observability | 0 | 0 | — | |

---

## Pending skills.md Updates

Changes backed by scorecard evidence that have not yet been applied.

| Agent | Proposed Change | Evidence (memory-store entry IDs) | Priority | Status |
|-------|----------------|----------------------------------|----------|--------|
| — | — | — | — | — |

When a pending update is applied, move it to the Amendment section of the relevant agent's skills.md (or add one if missing), and remove it from this table.

---

## Observer Notes

Free-form notes on scoring methodology, anomalies, or context that does not fit the tables above.

_No entries yet._
