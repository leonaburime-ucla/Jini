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

## Consolidation map — where every remaining file actually lands (2026-07-17)

**Why this exists:** `r6-god-component-internals.md` correctly *identifies* several patterns that
recur across multiple god-files (§3, its cross-file pattern table), but only 2 of those clusters
(connector/source config, progress-card) were ever promoted into this plan's dispatch list — the
rest existed only as recon analysis. Without this written down, dispatching each remaining file cold
means re-deriving the grouping ad hoc every time, which risks 2-3 near-duplicate extractions landing
in separate feature folders that then need merging later (exactly the failure mode already flagged —
and not yet resolved — for the connector/source-config cluster below). Every dispatch prompt for an
item in this plan should reference this section for its target destination, not invent one.

Three destination *kinds*, not just "own feature folder":
- **Shared feature** — multiple source files feed one `packages/ui/src/features/<name>/` (or
  equivalent package) because the same interaction shape recurs more than once.
- **Own feature** — one source file yields one self-contained slice with no known duplicate
  elsewhere in this sweep.
- **Flat `components/`/`hooks/`/`utils/`** — the yield is a small, stateless, single-purpose
  primitive (matches the bucket-A treatment `Icon.tsx`/`Toast.tsx`/etc. already got) — a `features/`
  folder would be ceremony for something with no feature-local state or ports.

### A. Shared features (multiple sources → one destination)

| Target | Sources | Notes |
|---|---|---|
| `features/connectors/` (already exists — the canary) | `ConnectorsBrowser.tsx` (✅ done), `PluginsView.tsx`'s `SourcesPanel` (§1.11), `EntryShell.tsx`'s `OnboardingByokSetupPanel` (§1.7, reinforces not newly discovers), `McpClientSection.tsx`, `byok/*`, Memory slice's connector reducers | **The biggest cluster — 6 places.** Still an **open question**, not a decision: the plan already flags "revisit whether `mcp-config`/`byok-config` should be rebuilt as thin configs of one shared `SourceConfigList` primitive instead of three separate extractions" (item 4 below) — resolve that *before* dispatching `SourcesPanel`/`OnboardingByokSetupPanel`, or they'll land as a 7th near-duplicate instead of configs of the existing one. |
| `features/progress-card/` | `DesignSystemFlow.tsx`'s `WorkspaceActivityCard`+`GenerationStatusCard` (🔄 in flight) | r6 §3 also lists `RevisionDiffCard`/`RevisionHistoryList` (same file, §1.5) as conceptually related ("status-badged... progress bar + status icon" family) — not confirmed identical, but evaluate together before the in-flight routine's PR merges, since both are on-domain for Jini's `Run`/`Agent`/`Tool` vocabulary. |
| `features/tab-strip/` | `WorkspaceTabsBar.tsx` (1,220 lines, §1.3 addendum), `FileWorkspace.tsx`'s inline `Tab` (§1.4) | Independently reimplemented — not even shared *within* OD's own codebase. `WorkspaceTabsBar.tsx` needs 3 things parameterized before it generifies: the tab-kind union, route-mapping functions, and storage/event key names (two of which are literal product-identity strings that would trip the neutrality guard verbatim). |
| `features/list-detail-panel/` (generic `ListDetailPanel<TSummary,TDetail>`) | `DesignSystemsTab.tsx` (§1.18) | r6 §3 also names `PluginsView.tsx`'s detail modal and `ProjectView.tsx`'s composition as "conceptually" related — neither's own per-file section (§1.11, §1.2) calls out a concrete second instance of this shape, so treat those two as aspirational, not confirmed; `DesignSystemsTab.tsx` is the only verified source today. |
| Blocked — provider-grouped model picker | `NewProjectPanel.tsx`'s `MediaModelCards` (§1.13), `InlineModelSwitcher.tsx` (r5 §4, not one of these 23 files) | Confirmed recurring shape, but straddles the `@jini/ui` vs `@jini/chat-react`/`@jini/agent-runtime` package boundary r5 already flagged as unresolved. Don't dispatch either half until that boundary ruling happens — extracting `MediaModelCards` into `@jini/ui` first risks landing on the wrong side of a line not yet drawn. |
| Not yet actionable — iframe keep-alive LRU | `FileWorkspace.tsx`'s inline browser-webview cache (§1.4) | Third occurrence of the "cap N mounted iframes, LRU-evict" pattern (after `IframeKeepAlivePool.tsx`, r5 §3 — outside this 23-file sweep). §1.4's own read calls this instance "not independently extractable without a rewrite." Recognize it as a future third consumer once `IframeKeepAlivePool.tsx` itself gets a real slice; nothing to dispatch here yet. |

**3 more overlaps spotted while building this map, not in r6's own cross-file table** (r6's 9
parallel sub-analyses each read 2-5 files in isolation — nothing forced a side-by-side compare
across all 23 until now):

- **Viewport-preset switcher, twice**: `FileViewer.tsx`'s `PreviewViewportControls`/
  `FileVersionViewportControls` (§1.1, "self-contained responsive desktop/tablet/mobile viewport
  switcher, zero business types") and `DesignBrowserPanel.tsx`'s `BrowserViewportControls` (§1.12,
  "a responsive viewport-preset switcher") read as the same shape from two independent
  descriptions. Diff them before shipping both — this may be a 2-file version of the tab-strip
  situation above, not two separate primitives.
- **Resource-dashboard shell, twice, both directly Run-vocabulary-relevant**: `DesignsTab.tsx`'s
  dashboard shell (§1.17 — sub-tabs, search, bulk-actions, a **config-driven status-kanban** whose
  vocabulary `not_started/running/awaiting_input/succeeded/failed/canceled` "reads like a generic
  agent-run/job lifecycle") and `TasksView.tsx`'s list shells (§1.20 — hero+metric-tile header,
  tabbed template gallery, **row-list-with-expandable-run-history**, "a recognizable generic
  scheduled-job list CRUD shape"). Both are independently flagged as plausible sources for Jini's own
  future run/job dashboard. Building these as two separate primitives risks shipping two competing
  "Run list" shapes when Jini only needs one — evaluate together, likely as one
  `features/resource-dashboard/` (or a name that doesn't presuppose "design" — this is the single
  most core-engine-relevant cluster in the whole sweep and deserves care over speed).
- **Choice-card shape, maybe three times**: `EntryShell.tsx`'s `OnboardingChoiceCard` (§1.7, "generic
  accessible choice card: icon/title/body/benefits/badge/selected state") and `NewProjectPanel.tsx`'s
  `OptionCards<T>`/`FidelityCard` (§1.13, "generic radio-card grid" / "two-option illustrated-choice-
  card shape") all describe a selectable card with icon/title/body — not confirmed identical (could
  be 2-3 genuinely distinct shapes that just sound similar in prose), but worth a direct read-side-by-
  side before extracting more than one "choice card" primitive.

### B. Own feature (single source, no known duplicate elsewhere in this sweep)

| Target | Source | 
|---|---|
| `features/annotation-canvas/` | `PreviewDrawOverlay.tsx` (🔄 in flight via Codex Cloud) |
| `features/sketch-editor/` (or `@jini/renderers-react`) | `SketchEditor.tsx`'s Excalidraw-integration shim |
| `features/asset-grid/` (generic `AssetGrid<TAsset>`) | `LibrarySection.tsx` — rubber-band multi-select (the single cleanest generic core in the whole sweep, per §1.16), facets, debounced search, SSE live-merge, day-bucketed grouping, kind-dispatch thumbnails |
| `features/asset-tree-browser/` (generic `AssetTreeBrowser<TFile>` + `FilePreviewPane<TFile>`) | `DesignFilesPanel.tsx` |
| `features/browser-chrome/` (embeddable webview/iframe browser tab) | `DesignBrowserPanel.tsx` — nav stack, address-bar normalization, history/favicon utilities, ports for `onNavigate`/history storage/brand-bridge registration |
| `features/viewer-shell/` (the 9-times-repeated "viewer toolbar + body" shell) | `FileViewer.tsx` — `BinaryViewer`/`DocumentPreviewViewer`/`ImageViewer`/`SketchViewer`/`VideoViewer`/`AudioViewer`/`SvgViewer`/`TextViewer`, plus `CommentSidePanel`/`CommentSideDock` and the `MarkdownViewer` split-pane |
| `features/settings-dialog/` (shell) + `features/settings-dialog/tabs/{appearance,notifications,language,instructions,integrations}` | `SettingsDialog.tsx` — shell is reusable chrome (8 of 17 tabs already separate files prove it); `integrations` needs its hardcoded `'open-design'`-branded MCP-install-snippet strings parameterized (same shape-class as `McpClientSection`, installer-direction-reversed — plausibly worth a note in the connectors cluster above, since it's the mirror image, even though it doesn't share code today); `privacy` still needs the r6-flagged follow-up verification before it's added to this list |
| `features/schedule-picker/` (`RecurringSchedulePicker`) | `NewAutomationModal.tsx` |
| `features/mention-autocomplete/` (`MentionAutocomplete`, same shape as the existing `QuickSwitcher.tsx` precedent) | `NewAutomationModal.tsx` |
| `hooks/useResizableSplitPane` | `ProjectView.tsx` (the one genuine exception in an otherwise ~99%-OD-specific 9,907-line file) |

### C. Flat `components/`/`hooks/`/`utils/` (small atoms — bucket-A treatment, not a `features/` folder)

- **Components**: `BrandLogo`, `HeaderActionsMenu` (`DesignKitView.tsx`); `OptionCards<T>`,
  `CompactToggle`/`ToggleRow` (`NewProjectPanel.tsx` — see the choice-card overlap flagged above
  before treating these as fully separate from `OnboardingChoiceCard`); `PillButton`/`PopoverMenu`/
  `PopoverItem` (`NewAutomationModal.tsx`); `StatCard`/`Notice`, `ImportChoice`/`FileImportPanel`
  (`PluginsView.tsx`); `OnboardingDropdown`/`OnboardingChipField`/`OnboardingPanelHeader`
  (`EntryShell.tsx`); `CodeWithLines`/`JsonPanel` (`FileViewer.tsx`)
- **Hooks**: `scrollWorkspaceTabsWithWheel` (`FileWorkspace.tsx`); `home-hero/EdgeAutoScroll.tsx`
  (`HomeHero.tsx` — already isolated, ship as-is); `useBrandFonts` (`DesignKitView.tsx`, genericize
  its fetch-URL-builder parameter)
- **Utils**: `designMd*` markdown-heading-slice utilities (`DesignKitView.tsx`); `detectLocalTimezone`/
  `listSupportedTimezones` (`NewAutomationModal.tsx`, pure `Intl` wrappers); color-contrast/luminance/
  hex-mixing math (`DesignSystemFlow.tsx`, travels with whichever token-chip feature ends up
  consuming it)

### D. Confirmed OD-specific — do not attempt (full read already done, see §2 below for the rest)

`HomeView.tsx`, `pet/PetSettings.tsx` (both r6 §1.10/§1.21, joining the list in the existing §2
below).

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
