# `components-original/` — vendored reference snapshot

Read-only reference. Do not edit files in this directory — it exists so a
cloud session (Claude Code routine) has this source material available
without needing a second `git_repository` source (CCR routines support
exactly one, see `foundry/automation/project-runner/cloud-routine-prompt.md`) or a
live outbound `git clone` to work.

**Source:** `apps/web/src/components/` from the local `open-design-agentic`
clone's `main` branch, at the same HEAD (`951fa5f1541c3b7af23ccb07e3e60b284def56b1`
lineage — see the correction below) that `foundry/docs/jini-port/recon/r5-components-sweep.md`
analyzed. Copied verbatim, 2026-07-16.

**Provenance caveat (same one flagged in `foundry/docs/jini-port/od-reference-branches.md`
and `packages/protocol/source-map.md`):** this clone's `main` is a personal
integration branch, not true upstream `nexu-io/open-design` `main` — it locally
merges the still-open `chat-pane-slice`/`chat-composer-slice` PRs. That's
actually why this snapshot is useful: `ChatPane.tsx`/`ChatComposer.tsx` here
are already the post-slice 1,212/1,774-line orchestrators, not the old
monoliths, matching what the sweep analyzed and what `@jini/chat-react`
extraction should use.

**The plan for what to do with these files:** `foundry/docs/jini-port/ui-extraction-plan.md`.
That doc is the actual task list; this directory is just the source material it
points at.

**Refreshing this snapshot:** if the source clone moves forward and a task
needs newer content, re-copy the specific file(s) needed and note the new
state in the plan doc — don't silently regenerate the whole directory without
updating `r5-components-sweep.md`'s classifications, since counts/line-numbers
there are tied to this exact snapshot.
