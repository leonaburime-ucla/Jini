# `@jini/ui` — generic, product-neutral UI primitives

Renamed from `@jini/components` in this session (2026-07-16) once it became clear
one "components" bucket undersold the scope: this package is meant to hold more
than flat presentational components — pure business logic, hooks, and injectable
providers for whatever generic (non-chat, non-OD-branded) UI domains fall out of
extracting OD's ~217-file `apps/web/src/components/` zone.

## Scope boundary (hard rule, decided 2026-07-16)

Only genuinely **cross-product-reusable** UI lands here — buttons, dialogs, form
controls, layout primitives, icons, and any small feature-shaped domain (e.g. a
generic toast/notification system) that isn't tied to Open Design's product
vocabulary.

**Not here:** anything OD-product-specific — `FileViewer`, `ProjectView`,
`DesignSystemFlow`, memory-extraction config UI, automations, handoff,
brand/plugin/figma-specific components. Those stay in
`integrations/open-design/` as OD's own UI if/when that adapter needs them.
`SettingsDialog` itself is one of these (its `execution`/`orbit`/`media`/
`composio`/`critiqueTheater`/`pet`/`designSystems`/`projectLocations`/
`routines`/`about` tabs and its AMR/autosave shell state stay OD-specific) —
but its reusable tabbed-dialog *shell* and 6 of its small, clean, generic
tabs (`appearance`, `notifications`, `language`, `instructions`,
`integrations`, `privacy`) shipped as `src/features/settings-dialog/`; see
`packages/ui/source-map.md`.
Also not here: chat/artifact UI — that's `@jini/chat-core` (already built),
`@jini/chat-react`, and `@jini/renderers-react` (separate packages, kept
separate deliberately — see the chat-core/chat-react split discussion in
`docs/jini-port/` session notes).

## Internal structure

- `src/components/` — flat, presentational-only atoms. Props in, JSX out, no
  state/logic/fetch (same discipline as OD's own ADR 0002 slice rule).
- `src/features/<domain>/` — anything that needs its own hooks + ports +
  dumb-components + barrel because it's a cohesive concern, not a single atom
  (mirrors the ports+dependencies+barrel discipline already proven by OD's
  `features/memory`, `features/chat-pane`, `features/chat-composer` slices —
  see `docs/jini-port/od-reference-branches.md`). **Within each feature
  (decided 2026-07-17):** files with zero React import (`types.ts`,
  `constants.ts`, `rules.ts`, `ports.ts`, `dependencies.ts`, the barrel
  `index.ts`) stay at the feature's top level; anything that imports React
  (`hooks/`, `components/`) moves under a `react/` subfolder —
  `features/<domain>/react/{hooks,components}/`. This is a deliberately
  *lighter* motivation than the `@jini/chat-core`/`@jini/chat-react` package
  split: not "prepare for a Vue consumer" (no such consumer exists or is
  planned), just keeping the pure layer visibly and mechanically separate
  from the React layer within one package, at effectively zero cost. See
  `packages/ui/source-map.md`'s `features/connectors/` section for the
  worked example. **Not yet retrofitted onto the flat `src/components/`/
  `src/hooks/` buckets below** — those still sit at the top level; revisit if
  this pattern proves worth extending there too.
- `src/providers/` — the *only* place allowed to import a concrete
  transport/DOM adapter and bind it to a `features/<domain>/ports.ts`
  interface. Everything else in this package depends on the port, never a
  concrete implementation.
- `src/hooks/` — generic hooks that don't belong to one feature domain
  specifically (feature-local hooks live inside their own `features/<domain>/`
  instead).
- `src/utils/` — non-component pure helpers and small stateful browser-API
  wrappers that don't need the full ports+dependencies ceremony. Added in the
  i18n/observability/utils porting task (2026-07-16); see
  `packages/ui/source-map.md`.

## Status

Real content has landed in several parallel passes — see
`packages/ui/source-map.md` for full per-section provenance:

- `src/utils/` — a framework-free DOM/pure-function layer (2026-07-16), plus
  a second batch (i18n/observability-adjacent utils: notifications, uuid,
  platform, etc., also 2026-07-16).
- `src/features/i18n/` and `src/features/observability/` (2026-07-16).
- `src/components/` and `src/hooks/` — `docs/jini-port/ui-extraction-plan.md`
  section A's flat-group components and the `useInView` hook (2026-07-17) —
  the first content in these two directories, and the first task to pull in
  `react`/`react-dom` as real dependencies of this package.
- `src/features/connectors/` — the `ConnectorsBrowser.tsx` god-component
  canary (2026-07-17), per `docs/jini-port/god-components-extraction-plan.md`
  §0: an OAuth integration marketplace UI (ports+dependencies+hooks+
  components+barrel).
- `src/features/browser-chrome/` — a **partial** slice of
  `DesignBrowserPanel.tsx` (2026-07-17), per
  `docs/jini-port/god-components-extraction-plan.md`'s Section B: the
  generic "embeddable webview/iframe browser tab" primitive (navigation
  stack, address-bar normalization, history/favicon utilities, a
  viewport-preset switcher, and ports for `onNavigate`/history storage/
  brand-bridge registration) — not the full file. The first feature to use
  the new `react/{hooks,components}/` layout described above. See
  `packages/ui/source-map.md` for the full breakdown, including a confirmed
  duplicate with `FileViewer.tsx`'s (not-yet-ported) viewport controls.
- `src/features/sketch-editor/` — `SketchEditor.tsx`'s Excalidraw-integration
  shim (2026-07-17), per the god-components-extraction-plan.md Consolidation
  map §B: theme sync, dirty/save/export orchestration, and a DOM-enhancement
  toolkit for embedding `@excalidraw/excalidraw`. The first feature to use
  the **new** `react/{hooks,components}/` layout described above, and the
  first to take a real third-party UI-library dependency (not just
  browser/DOM primitives).
- `src/features/asset-grid/` — a generic `AssetGrid<TAsset>` ported from
  `LibrarySection.tsx` (2026-07-17), per
  `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map:
  rubber-band multi-select, day-bucketed timeline grouping, kind/source
  facets, debounced search, SSE live-merge, grid/timeline view toggle,
  bulk-delete-with-confirm, keyboard shortcuts, kind-aware thumbnail
  dispatch. The first feature built under the **new**
  `react/{hooks,components}/` layout described above.
- `src/features/viewer-shell/` — the file-viewer's media-viewer shell family
  (2026-07-17), per `docs/jini-port/god-components-extraction-plan.md`'s
  consolidation map: a generic viewer-toolbar/body chrome, a resolved
  viewport-switcher-overlap pair (`ViewportSwitcher`/`ViewportToggleGroup`),
  the comment side-panel, and a markdown split-pane with scroll-sync. The
  first feature built under the new `react/{hooks,components}` layout
  described above (not yet retrofitted onto `connectors`/`progress-card`).
- `src/features/settings-dialog/` (shell) + `src/features/settings-dialog/
  tabs/{appearance,notifications,language,instructions,integrations,privacy}/`
  — extracted from `SettingsDialog.tsx` (2026-07-17), per
  `docs/jini-port/god-components-extraction-plan.md` item 5. Uses the NEW
  `react/{hooks,components}` layout (this is the first feature built with it
  from scratch). See `packages/ui/source-map.md`.
- `src/features/list-detail-panel/` — a generic `ListDetailPanel<TItem>`
  master-detail (list+preview) navigator shell, ported from
  `DesignSystemsTab.tsx` (2026-07-18), per
  `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map.
  `PluginsView.tsx`'s detail modal and `ProjectView.tsx`'s composition were
  read and confirmed NOT to share this shape (a portal overlay and a
  resizable 2-pane split, respectively) — scoped to `DesignSystemsTab.tsx`
  alone rather than forcing a broader generalization. See
  `packages/ui/source-map.md`.
- 10 more `src/components/` flat atoms (2026-07-18) — the Section C
  bucket-A batch from `NewProjectPanel.tsx` (`OptionCards`, `CompactToggle`,
  `ToggleRow`), `PluginsView.tsx` (`StatCard`, `Notice`, `ImportChoice`,
  `FileImportPanel`), and `EntryShell.tsx` (`OnboardingPanelHeader`,
  `OnboardingChipField`, `OnboardingDropdown`). See `packages/ui/source-map.md`.
- `src/features/memory/` — ported from OD's never-merged PR #5228 (a
  vertical-slice decomposition of `MemorySection.tsx`, 2026-07-18): the
  saved-memory list/editor, the extraction-history stream, and the
  connector-sourced-suggestions flow. Carries forward every async/
  state-correctness fix that PR's own long review cycle found (the bugs were
  independently confirmed pre-existing in OD's original monolith, not
  introduced by the decomposition), plus one additional fix
  (`fetchMemoryList()`'s under-validated response) made during this port. See
  `packages/ui/source-map.md` for the full provenance note, including why its
  connector-reconciliation reducers reuse `features/connectors/rules.ts`
  instead of re-deriving a third copy.

- `src/features/schedule-picker/` — `RecurringSchedulePicker`, a generic
  "cron-lite" recurring-schedule editor (2026-07-18), ported from
  `NewAutomationModal.tsx`'s `SchedulePopover` per
  `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map.
  Also added flat `src/components/{PillButton,PopoverMenu,PopoverItem}.tsx`
  and `src/utils/timezone.ts`, both from the same source file. See
  `packages/ui/source-map.md`.
- `src/features/mention-autocomplete/` — `MentionAutocomplete`, a generic
  "type a trigger character, get a filtered picker" mention/capability
  autocomplete (2026-07-18), also ported from `NewAutomationModal.tsx`, per
  the same Consolidation map row. Checked against `QuickSwitcher.tsx` and
  the `composer/*` Lexical `@mention` system for a possible 3-way overlap —
  concluded they're three distinct shapes, not one primitive done three
  times; see `packages/ui/source-map.md` for the full comparison (read that
  section before extracting either of those two).

- `src/features/file-dropzone/` — `FileDropzone`, a consolidated file-staging
  primitive (2026-07-18) ported from **two** independent OD file-staging
  zones — `DesignSystemAssetDropzone.tsx` (a kind-aware thumbnail grid +
  lightbox) and `DesignSystemFlow.tsx`'s `DropZone` (a labeled zone with a
  file-dialog cancel-vs-still-loading detection heuristic) — read in full,
  confirmed the same underlying interaction, and shipped as one primitive
  instead of two. Also promoted the drag/drop directory-walk and clipboard
  utilities the two features already duplicated a third time (from
  `features/asset-tree-browser/rules.ts`) up to `utils/file-transfer.ts` and
  `browser/useFileDropTarget.ts`, so this package now has exactly one copy.
  See `packages/ui/source-map.md` for the consolidation evidence, a real
  infinite-render-loop bug found and fixed during this port, and full
  test/coverage numbers.
- `src/utils/scroll-tabs-with-wheel.ts` and `src/utils/color-math.ts`
  (2026-07-18) — two flat bucket-A atoms from
  `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map §C:
  a generic wheel-to-horizontal-scroll handler for an overflowing tab strip
  (from `FileWorkspace.tsx`'s `scrollWorkspaceTabsWithWheel`) and hex/RGB/
  luminance/mix color-math primitives (from `DesignSystemFlow.tsx`). See
  `packages/ui/source-map.md` for the full writeup, including what was
  deliberately left behind (the OD-specific color-selection heuristic that
  consumes the math, not the math itself).

Section B (vertical-slice `features/<domain>/` work: `byok-config`,
`mcp-config`, `rich-text-input`, `workspace-tabs`) and section C
(cross-package routing) of the extraction plan are not started. The
god-components-extraction-plan.md list beyond the features enumerated above
is also not started.
