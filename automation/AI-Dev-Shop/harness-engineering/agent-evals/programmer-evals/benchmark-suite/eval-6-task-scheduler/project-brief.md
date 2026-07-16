# Task Scheduler

Build a task scheduler that manages task creation, priority scoring, and assignment for a project management tool in Python.

## Requirements

1. Accept task creation requests with: title, description, priority (low/medium/high/critical), dueDate, assigneeId, tags.
2. Score task priority on a 0-100 scale based on: base priority (low=10, medium=30, high=60, critical=90), days until due (closer = higher), and tag weights (configurable).
3. Assign tasks to users based on priority score and current workload.
4. Return a typed `ScheduleResult` with: taskId, priorityScore, assignedTo, scheduledAt, warnings.
5. Reject tasks with missing title, invalid priority, or past due dates with descriptive errors.
6. Support configurable tag weights passed as an options parameter.

## Constraints

- Pure Python, no external dependencies
- Priority scoring must be a pure calculation — no side effects
- Must include tests
