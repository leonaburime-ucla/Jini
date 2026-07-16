# Context Offloading

This file defines when large outputs should move into durable files instead of staying in chat or handoff text.

## Why This Exists

Long-running agent work degrades when logs, diffs, stack traces, or generated summaries stay in active context for too long. File-backed offloads keep the working context small while preserving exact evidence.

## Offload Triggers

Create an offload artifact when any of these are true:

- a command or log dump is longer than roughly 120 lines
- a generated diff, JSON blob, or trace is too large to scan inline
- the same raw output will need to be referenced more than once across retries or handoffs
- a resume or recovery handoff depends on raw evidence that would otherwise flood the next session
- a passing command would otherwise dump large routine output that does not need to stay in active context

## Output Style Rule

Use success-silent / failure-loud output handling:

- on success, keep only the short summary, status line, and any key counts
- on failure, keep the exact failure output or offload it immediately if it is large

The goal is to keep normal passes quiet and make failures richly inspectable.

## Context Budget Rule

Do not wait for the active context to become crowded before offloading.

If your tool exposes context usage, stay comfortably below the limit rather than operating near exhaustion. If it does not, treat repeated logs, repeated summaries, and large raw evidence as signals to compact early.

## Canonical Locations

- Feature-bound work: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/offloads/<timestamp>-<slug>.md`
- Toolkit maintenance or non-feature work: `<ADS_MEMORY_ROOT>/reports/offloads/<workstream>/<timestamp>-<slug>.md` for host-project workstreams, or `<AI_DEV_SHOP_ROOT>/project-knowledge-template/reports/offloads/<workstream>/<timestamp>-<slug>.md` when maintaining the toolkit itself

Use `<AI_DEV_SHOP_ROOT>/framework/templates/context-offload-template.md` for markdown offloads. Raw `.txt`, `.json`, or `.log` files are fine when the source format matters.

## Required Contents

Every offload should preserve:

- what produced the output
- why it was offloaded
- the key takeaways or reason it matters
- the raw content or a pointer to the raw content

## Handoff Rule

Do not paste the whole offloaded body back into chat. Reference the file path and provide only:

- a one-paragraph summary
- the 1-3 key findings or failure signatures
- the next action that depends on it

## Resume Rule

If a progress ledger or recovery handoff depends on the artifact, list the offload path there explicitly. A fresh session should be able to find the evidence without rerunning the original expensive command first.
