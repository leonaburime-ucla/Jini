# OD reference repos and branches

Both repos below are **public** — no auth/credentials needed to clone them, from a
local machine or a cloud Claude Code session's sandbox alike. Neither is wired as a
CCR routine `sources` entry: as of 2026-07-16, Claude Code cloud routines support
exactly one `git_repository` source, cloned at its default branch only (no
multi-repo, no ref/branch selection — see the routine-config note in
`automation/project-runner/cloud-routine-prompt.md`). So any session that needs
this material pulls it itself, live, via a plain `git clone` in a Bash step —
there is no vendoring of these into the Jini repo, and none is needed since
they're public and cloning is cheap.

## Upstream

`https://github.com/nexu-io/open-design` — the real product. `main` is the
current, **unrefactored** state for anything not called out below (i.e. this is
the "before" picture recon docs like `recon/r1-daemon.md` and `recon/r4-webui.md`
analyzed). Provenance commit used for the extraction work so far:
`951fa5f1541c3b7af23ccb07e3e60b294def56b1` (2026-07-12).

## Fork (the user's vertical-slice refactor branches)

`https://github.com/leonaburime-ucla/open-design` — draft/checkpoint PRs
decomposing OD's frontend god-components per
`docs/adr/0002-frontend-vertical-slice-decomposition.md` (an OD-side doc, not a
Jini one). None of these are merged to upstream `main` — they only exist as
branches on this fork. `git clone --branch <branch> --single-branch
https://github.com/leonaburime-ucla/open-design <dest>` to pull one.

| PR | State | Branch | What it decomposes | Jini relevance |
|---|---|---|---|---|
| #5228 | CLOSED | `refactor/web-memory-slice` | `MemorySection.tsx` → `features/memory/` | The original canary; reviewed in `recon/r4-webui.md` §2. Verdict there: adopt the ports+dependencies+barrel seam, drop the ADR's anti-sharing rule at the package boundary. |
| #5461 | OPEN (draft) | `refactor/web-chat-pane-slice` | `ChatPane.tsx` (4,332→1,212 lines) → `features/chat-pane/` | Direct source for `@jini/chat-react`'s `useConversation`/`<MessageList>` (r4b §1.2/§3). Already has clean DOM/transport ports (`ChatPaneDomPort`, `AmrLoginPort`). |
| #5465 | OPEN (draft) | `refactor/web-chat-composer-slice-pr` | `ChatComposer.tsx` (5,569→1,774 lines) → `features/chat-composer/` | Direct source for `@jini/chat-react`'s `useComposer`/`<Composer>` (r4b §1.2/§3). Ports: `ViewportPort`, `ComposerDraftPort`, `WorkingDirPort`, `ComposerCataloguePort`. |
| #5474 | OPEN (draft) | `refactor/web-handoff-slice` | `HandoffButton` → `features/handoff/` | OD-product feature (per the packages/ui scoping decision in this session) — reference only if `integrations/open-design/` ever needs it; not `@jini/*` package material. |
| #5475 | OPEN (draft) | `refactor/web-automations-slice` | automations cluster → `features/automations/` | Same as handoff — OD-product, not engine material. |
| #5482 | CLOSED | `agent/project-view-merge-continue` | `ProjectView.tsx` (18/22 clusters) → `features/project-view/` | OD-product (project shell). Not engine material. |
| #5483 | CLOSED | `agent/file-workspace-finish` | `FileWorkspace.tsx` (complete) → `features/file-workspace/` | OD-product. Not engine material. |
| #5485 | OPEN (draft) | `agent/file-workspace-clean` | `FileWorkspace.tsx` (isolated checkpoint base) | Same slice as #5483, a cleaner checkpoint. OD-product. |
| #5484 | CLOSED | `agent/file-viewer-continue-ghf` | `FileViewer.tsx` clusters (checkpoint, not for merge) | OD-product (design/deck preview — the most OD-tilted surface in the app). Not engine material. |
| #5486 | OPEN (draft) | `agent/file-viewer-clean` | `FileViewer.tsx` clusters (isolated checkpoint base) | Same slice as #5484, cleaner checkpoint. OD-product. |

**Reading the table**: only #5228, #5461, #5465 are candidate source material for
`@jini/*` packages (chat-core already done; chat-react is next). Everything else
in this table is real, useful work, but it's OD's own product decomposition —
per this session's scoping decision, it belongs in `integrations/open-design/`
if/when that adapter needs it, not in `packages/@jini/**`.

## Daemon-side (backend) refactor PRs

Covered by `recon/r1-daemon.md`'s GENERIC-ENGINE / OD-PRODUCT / MIXED
classification already; not re-indexed here. Use `gh pr list --repo
nexu-io/open-design --author leonaburime-ucla --search "refactor(daemon) OR
arch(daemon) in:title"` (or similar) to re-list them on demand — the set is
large (~25 PRs) and most map to milestones 5-10, which haven't started yet.
