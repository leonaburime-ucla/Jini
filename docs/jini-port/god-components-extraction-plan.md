# God-component extraction plan — the actual task list

Derived from `docs/jini-port/recon/r6-god-component-internals.md`'s priority order (§4). Source
files are vendored at `integrations/open-design/reference/components-original/`. Pattern: the
`MemorySection.tsx` refactor (`docs/jini-port/od-reference-branches.md`'s PR #5228) — ports +
dependencies + hooks + presentational components + barrel `index.ts`, same discipline already
proven by `features/chat-pane`/`features/chat-composer`/`ConnectorsBrowser`-shaped work.

**Canary policy:** do `ConnectorsBrowser.tsx` alone first, verify it end-to-end (typecheck, tests,
guard, a real review of what shipped), and only then dispatch the rest of this list. Don't batch
multiple FULL SLICE items in parallel until the canary proves the pattern holds up for a cloud
session working from this plan doc alone.

**i18n policy (added after the canary's first pass got this wrong):** the vendored
`fixing-open-design-web/SKILL.md` says to preserve i18n keys verbatim — correct for its native
context (refactoring *inside* OD's own codebase, where OD's dictionaries stay in scope), but this
plan is extracting *into a different package* (`@jini/ui`) with its **own**, separate
`features/i18n` mechanism. Do NOT read "preserve i18n keys" as license to drop i18n from the ported
component — and do NOT read "OD's translated copy is product content, don't ship it" as license to
drop the *mechanism* either (that was the canary's first-pass mistake, self-corrected afterward).
The two are separable: OD's actual translated dictionaries are genuinely product content and should
NOT be ported, but `@jini/ui`'s `useT()` hook is a zero-cost no-op when unconfigured — `t(key)`
returns `key` verbatim with no `I18nProvider` mounted. The convention is **the English string itself
is the key** (`t('Connect')`, not a namespaced key like `t('connectors.connectLabel')`), so wrapping
every user-facing string costs nothing today and makes the component translatable for free later.
Wrap every user-facing string (JSX text, `aria-label`, `title`, default prop values for
label/message props) in `useT()`'s `t()`. Pure logic modules (a `rules.ts` with no React) stay
hook-free by design — wrap their return value at the call site instead (`t(statusLabel(status))`),
don't thread `t` into them. Verify the wiring actually works with a real test that mounts the
component under `I18nProvider` with a dictionary and asserts the translated text renders — a test
suite that only exercises the unconfigured/passthrough case cannot catch a hardcoded literal that
was never wrapped in the first place.

---

## Required cloud-dispatch preflight

Every cloud task for an item in this plan must start by recording, before any
edit, the source branch and commit SHA, Jini destination package, task branch,
and full validation command set. It must then prove it read the primary
`MemorySection` canary from the same OD branch:

- `apps/web/src/features/memory/`
- `apps/web/src/providers/memory/`
- `apps/web/tests/features/memory/`
- `docs/adr/0002-frontend-vertical-slice-decomposition.md`
- `apps/web/AGENTS.md`
- `scripts/check-web-slice-boundaries.ts`

The task must also enumerate the target's live callers and identify the
product-only adapter seam. If the branch cannot supply any of these references,
the task reports the gap and stops; a vendored snapshot is evidence only, never
a substitute for current source. Cloud tasks work on a task branch and open a
draft PR; they do not push directly to `main`.

`automation/project-runner/cloud-routine-prompts/god-component-extraction.md`
is the runnable template that enforces this gate for the next item.

---

## 0. Canary — `ConnectorsBrowser.tsx` (1,573 lines)

**Verdict (r6 §1.15): FULL SLICE — cleanest full-file candidate in the whole sweep.** Nearly the
entire file is a generic "OAuth integration marketplace" UI (comparable to a Slack/Zapier app
directory). OD-specific only via `ConnectorDetail`/`ConnectorConnectResponse`/`ConnectorStatusResponse`
types, `providers/registry` fetch calls, and a ~90-entry Composio category→i18n label lookup table
(pure data, not logic).

**Target:** `packages/ui/src/features/connectors/` (or reconsider naming once the McpClientSection-
archetype consolidation below happens — this may become the shared primitive other slices bind to,
not just its own isolated feature).

**What ships:**
- `ports.ts` — `fetchConnectors`/`connectConnector`/`disconnectConnector`/`fetchConnectorDetail` +
  status polling, typed against a **generic** `Connector` shape (not `ConnectorDetail` verbatim —
  strip Composio-specific fields, generify).
- `dependencies.ts` — the one file that would bind a real transport (a host supplies this; ship a
  fake/test double in this package, not a real `providers/registry` call).
- `hooks/` — auth-pending persistence, the OAuth `postMessage`/focus/visibility-refresh handshake
  with stale-auth auto-cancel (r6 flags this concurrency-correctness logic as worth keeping intact,
  not simplifying).
- `components/` — search+filter, provider-tab bar (config-driven, keep the `match`-predicate
  mechanism generic even though only one entry exists today), locked/gated state for missing API
  key, card grid, connect/disconnect state UI, modal detail drawer with paginated tool list.
- Drop: the ~90-entry Composio category→i18n label map (OD-specific data, not logic — a host
  supplies its own category labels).
- `index.ts` — public barrel.

**Gate for calling the canary successful:** typecheck/test/guard all green, `source-map.md` written
with the same rigor as every prior package, no product-identity strings, real tests exercising the
OAuth handshake states (pending/authenticated/stale-cancel), not just the presentational shell, and
(per the i18n policy above) every user-facing string wired through `useT()` with an `I18nProvider`
end-to-end test proving it — the canary's first pass shipped without this and needed a follow-up fix;
don't repeat that on the next items in this list.

---

## 1. Next in priority order (per r6 §4) — dispatch only after the canary is verified

1. **`PreviewDrawOverlay.tsx`** (2,158 lines) — near-complete annotation-canvas engine (freehand
   draw/undo-redo, canvas redraw with rAF/DPR handling, box-select, draggable text labels, a
   collision-avoiding floating-toolbar placement engine). OD-specific only via a thin,
   already-isolated seam (`markKind()`, `data-od-*` attributes, the snapshot/composite/submit
   pipeline). Target: a generic `AnnotationCanvas` component/hook in `@jini/renderers-react` or
   `@jini/ui`, OD supplying the snapshot/submit callback via a port.
2. **The "progress/status card" pattern from `DesignSystemFlow.tsx`** — `WorkspaceActivityCard` +
   `GenerationStatusCard`, independently reimplemented twice in the same file against different data
   shapes. Higher strategic priority than a purely generic-UI finding: this maps almost 1:1 onto
   Jini's own `Run`/`Agent`/`Tool` vocabulary. Unify into one generic progress-card component.
3. **`SketchEditor.tsx`**'s Excalidraw-integration shim (~60-70% of the 1,088-line file) — theme
   sync, save/dirty timers, scene diff/export glue, and a ~300-line DOM-enhancement toolkit for
   embedding a third-party library that exposes no hooks for this. Target: `@jini/renderers-react`
   or a components package. Drop: legacy sketch-item migration, `.sketch.json` naming convention,
   OD's i18n override tables, `od-*` CSS classes.
4. **Consolidate the McpClientSection-archetype duplicates** — the "URL/OAuth source add +
   trust/status + list + per-item test/refresh/remove" shape recurs independently in at least 6
   places: `McpClientSection.tsx`, `byok/*`, `PluginsView.tsx`'s `SourcesPanel`,
   `ConnectorsBrowser.tsx` (the canary above), the Memory slice's connector reducers, and
   `EntryShell.tsx`'s `OnboardingByokSetupPanel`. Once the canary lands, revisit whether
   `mcp-config`/`byok-config` (already planned in `ui-extraction-plan.md`) should be rebuilt as thin
   configurations of one shared `SourceConfigList`/`ConnectorCatalog` primitive instead of three
   separate extractions.
5. **`SettingsDialog.tsx`**'s shell + clean tabs (8,538 lines total, but 8 of 17 tabs are *already*
   separate files — this is mostly assembly, not fresh extraction). Ship the tab-container shell as
   reusable chrome, plus the `appearance`/`notifications`/`language`/`instructions` tabs (small,
   clean) and `integrations` (parameterize the hardcoded `'open-design'`-branded MCP-install-snippet
   strings — same shape-class as `McpClientSection`, installer-direction-reversed). Leave
   `execution`/`orbit`/`media`/`composio`/`critiqueTheater`/`pet`/`designSystems`/`projectLocations`/
   `routines`/`about` as OD-specific. Verify `privacy` in a follow-up (r6 flagged it "likely generic,
   not fully verified").
6. **`LibrarySection.tsx`**'s rubber-band multi-select + asset-grid shell, and **`DesignsTab.tsx`**'s
   status-kanban dashboard shell — both plausible near-term sources for Jini's own list/dashboard UI
   (the kanban's status vocabulary — `not_started/running/awaiting_input/succeeded/failed/canceled`
   — reads like a generic agent-run lifecycle, not an OD concept).
7. **Batch "atoms" sweep** — the remaining moderate/thin PARTIAL files each yield one or two small,
   low-risk extractions not worth an individual PR each: `OptionCards<T>`/`CompactToggle`/
   `ToggleRow`/`FidelityCard` shell (`NewProjectPanel.tsx`), `BrandLogo`/`HeaderActionsMenu`/the
   `designMd*` markdown-slice utilities (`DesignKitView.tsx`), `scrollWorkspaceTabsWithWheel`
   (`FileWorkspace.tsx`), `useResizableSplitPane` (`ProjectView.tsx`), `home-hero/EdgeAutoScroll.tsx`
   (as-is, already isolated), the media-viewer-shell family + `PreviewViewportControls` +
   `CommentSidePanel`/`CommentSideDock` + `CodeWithLines`/`JsonPanel` (`FileViewer.tsx`),
   `RecurringSchedulePicker`/`MentionAutocomplete`/popover chrome primitives
   (`NewAutomationModal.tsx`), a generic `ListDetailPanel<TSummary,TDetail>` shell
   (`DesignSystemsTab.tsx`), `AssetTreeBrowser<TFile>`/`FilePreviewPane<TFile>`
   (`DesignFilesPanel.tsx`), `DropZone`/`RevisionDiffCard`/`RevisionHistoryList`/token-chip family
   (`DesignSystemFlow.tsx`, beyond the progress-card pattern in item 2), 4 presentational
   onboarding components (`EntryShell.tsx`).
8. **`WorkspaceTabsBar.tsx`** — corrected from r5's "one-import fix" to a real parameterization job:
   extract the drag/reorder/keyboard-shortcut/hover-preview/search/persistence chrome, but requires
   genericizing three things (the tab-kind union, route-mapping functions, storage/event key names),
   not a one-line swap. Reconcile with `FileWorkspace.tsx`'s independently-duplicated `Tab` component
   rather than treating them as two extractions.

## 2. Confirmed genuinely OD-specific — do not attempt

`HomeView.tsx`, `pet/PetSettings.tsx` (both read in full, no viable extraction beyond trivial
utilities). The bulk of `FileViewer.tsx` (`HtmlViewer`, `FileVersionManagerModal`), `ProjectView.tsx`
(cross-cutting, not tab-separable — this independently explains why the prior checkpoint branch
never merged), `FileWorkspace.tsx`'s tab-content router and panels, `HomeHero.tsx`'s main component,
`EntryShell.tsx`'s main shell/onboarding state machine, `DesignSystemFlow.tsx`'s wizard/detail-tab
orchestrator, `DesignKitView.tsx`'s brand-kit render, `PluginsView.tsx`'s share/publish modal,
`DesignSystemsTab.tsx`'s `DesignSystemDetail`, `TasksView.tsx`'s domain logic, `NewAutomationModal.tsx`'s
form/REST wiring.

## 3. Open reconciliation items (not resolved by this plan — Coordinator decision needed)

- **Memory slice source-of-truth branch** — same open item as chat-pane/chat-composer
  (`docs/jini-port/od-reference-branches.md`), now confirmed to apply to Memory too. Its 3 drop-in
  reusable pieces (`useMemoryExtractions.store.ts`, `async-commit-guard.ts`, connector-reconciliation
  reducers) are ready to lift once this is resolved.
- Several god-components (`FileViewer.tsx`, `ProjectView.tsx`, `FileWorkspace.tsx`) have prior
  checkpoint/draft branches attempting full decomposition that never merged — r6 confirms their bulk
  is genuinely, deeply OD-specific (independent corroborating evidence for why those attempts
  stalled, not a contradiction of them). Don't restart those as full-file efforts.
