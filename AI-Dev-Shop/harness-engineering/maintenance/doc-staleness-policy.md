# Doc Staleness Policy

This file defines the narrow staleness checks used for docs that reference concrete repo behavior.

## Why This Exists

Agents trust repo-local documentation heavily. When a doc references a specific file path, workflow step, or source-of-truth artifact that no longer matches the repo, the failure is often silent: the agent follows the stale document confidently.

## Scope

Do not try to prove that all prose matches all code.

Instead, maintain a narrow watchlist of high-risk docs that:

- reference concrete repo paths
- define routing or workflow behavior
- act as source-of-truth maps for agents

## Watchlist

The watchlist lives in `<AI_DEV_SHOP_ROOT>/harness-engineering/maintenance/doc-staleness-watchlist.md`.

Each entry should record:

- the doc to watch
- the files or directories it should stay aligned with
- the review cadence in days
- the last reviewed date
- a short reason

## Audit Behavior

`doc_staleness_audit.py` is advisory, not a hard gate.

It checks:

- the watched docs still exist
- the referenced code or source-of-truth targets still exist
- the review date is not overdue relative to the declared cadence

## Default Use

- run during harness-maintenance passes
- run after framework changes that touch routing, workflow, or root instructions
- refresh the watchlist when a new source-of-truth doc becomes critical to routing
