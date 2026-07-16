# Seed Ledger — Eval 6: Task Scheduler

Checklist items covered: 1-6 plus 2 trick seeds.

---

ID: SEED-CL-01
Checklist Item: 1. Purpose clarity
Source Skill: coding-foundations, testable-design-patterns
Category: Purpose clarity
Seeded issue: Function named `handleTask` that validates input, scores priority, assigns to user, sends a webhook notification, logs to console, and returns the result — 6 distinct responsibilities hidden behind a vague name. Name doesn't describe any one of these behaviors.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer renames and extracts into focused functions
Evidence path: src/scheduler.py — handle_task function
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-02
Checklist Item: 2. Explicit inputs and outputs
Source Skill: coding-foundations, testable-design-patterns
Category: Explicit dependencies
Seeded issue: The priority scoring function reads from a module-level `CONFIG` object for tag weights and base scores instead of receiving them as parameters. The CONFIG is mutated by a setup function, creating a hidden dependency.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer passes config as parameter or injects it
Evidence path: src/scheduler.py — BASE_SCORES dict and score_priority function
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-03
Checklist Item: 3. Required and optional argument objects
Source Skill: testable-design-patterns
Category: Stable boundaries
Seeded issue: The exported `handleTask` function takes 6 positional parameters: (title, description, priority, dueDate, assigneeId, tags). This violates the two-object parameter convention.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Programmer converts to (input, options?) pattern
Evidence path: src/scheduler.py — handle_task signature
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-04
Checklist Item: 4. Typed contract
Source Skill: testable-design-patterns
Category: Typed/stable result
Seeded issue: The function returns `string` on success (task ID), `null` on assignment failure, `{ error: string }` on validation failure, and throws `Error` on webhook failure. Four different result shapes for a single function.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer normalizes to a single typed result
Evidence path: src/scheduler.py — multiple return statements
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-05
Checklist Item: 5. Pure-by-default logic
Source Skill: coding-foundations
Category: Pure logic vs effects
Seeded issue: The `scorePriority` function (which should be pure math) calls `Date.now()` directly to calculate days-until-due, and increments a module-level `metricsCounter` variable.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer injects clock and removes counter side effect
Evidence path: src/scheduler.py — score_priority function
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-06
Checklist Item: 6. Effect boundary clarity
Source Skill: coding-foundations, observability-implementation
Category: Effect boundary clarity
Seeded issue: Deep inside the "pure" priority scorer, there's a call to `notifyWebhook(taskId, score)` that sends an HTTP POST. This is a hidden side effect buried in what should be pure computation. No indication in the function signature or contract that it performs I/O.
Expected owner: Programmer
Expected severity: Critical
Expected signal: Programmer extracts the webhook call to the orchestration layer
Evidence path: src/scheduler.py — notify_webhook call inside score_priority
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-TRICK-01
Checklist Item: (trick) Missing await
Source Skill: coding-foundations
Category: Async trap
Seeded issue: The `assignTask` async function calls `workloadService.recordAssignment(taskId, assigneeId)` without `await`. The assignment appears to work but the recording is a fire-and-forget promise. If it fails, the error is silently swallowed and workload tracking becomes stale.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer adds missing await or documents fire-and-forget
Evidence path: src/scheduler.py — assign_task function
Caught by Programmer:
Caught by Code Review:
False positive risk: Low
Framework change needed: No

---

ID: SEED-CL-TRICK-02
Checklist Item: (trick) Misleading variable name
Source Skill: coding-foundations
Category: Naming trap
Seeded issue: A variable named `remainingCapacity` is calculated as `assignee.maxTasks - assignee.activeTasks` but is then used as `if (remainingCapacity > 0)` to decide assignment. However, there's a subtle bug: `activeTasks` includes completed-but-not-archived tasks, so `remainingCapacity` can be negative, and the comparison still passes because the variable is actually `maxTasks - totalTasks` (which includes completed). The misleading name masks the real metric.
Expected owner: Programmer (should notice the name/value mismatch)
Expected severity: Medium
Expected signal: Programmer questions the capacity calculation
Evidence path: src/scheduler.py — remaining_capacity variable
Caught by Programmer:
Caught by Code Review:
False positive risk: Medium
Framework change needed: No
