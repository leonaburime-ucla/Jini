# Context Firewalls

This file defines when discovery work should be isolated from implementation context.

## Why This Exists

Discovery and implementation have different context needs.

- Discovery wants breadth: grep results, file maps, traces, candidate paths, comparisons.
- Implementation wants depth: the smallest set of facts needed to change code correctly.

Mixing them in one active context window makes implementation sessions noisier and more error-prone.

## Default Rule

When a task needs broad discovery before execution, isolate that discovery into a read-only sub-agent or an explicit research pass first.

If the current host is in single-agent mode because subagent spawning is unavailable or unverified, use the same pattern inside one session: do the research pass first, summarize it, then continue implementation with the condensed findings instead of carrying raw exploration noise forward.

Treat the discovery step as a context firewall:

- the discovery worker explores
- the implementation owner receives only the structured findings
- raw search noise stays out of the implementation context unless later needed

## Use This Pattern When

- the agent does not yet know which files or modules own the behavior
- the task needs grep-heavy exploration across many files
- multiple candidate implementation locations must be compared
- the codebase is large enough that inline exploration would crowd out the actual fix context
- the task is brownfield work on an unfamiliar area

## Required Discovery Output

The discovery pass should return only:

- likely owner files or modules
- the key file paths and line references
- a short summary of how the area works
- open uncertainties
- the recommended next owner or next step

Do not return large raw logs, giant grep dumps, or pasted file bodies unless the parent agent explicitly asks for them.

## Brownfield Default

For existing codebases, use CodeBase Analyzer on the first pass unless a fresh analysis already covers the requested area.

For narrower follow-up work inside one area, a smaller read-only discovery worker is often enough.

## Guardrails

- discovery workers should stay read-only
- implementation owners should not inherit full discovery noise by default
- if the discovery result is stale or inconclusive, rerun discovery instead of guessing
