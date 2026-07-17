# `@jini/ui` extraction plan — the actual task list

This is the executable plan for populating `@jini/ui`, derived from
`docs/jini-port/recon/r5-components-sweep.md`'s classification. Source files
are vendored at `integrations/open-design/reference/components-original/` —
read from there, not the live OD clone (a cloud session doesn't have that
clone; a local session shouldn't need it for this specific plan either, so
everyone works from the same snapshot). Follow `packages/ui/README.md`'s
structure and scope boundary.

**Two refactor patterns, per r5 §7 — pick per item, don't apply one pattern
uniformly:**

- **Flat-group** (mechanical move + barrel export, no ports/hooks needed): for
  presentational leaves or pure functions with no state of their own. Same
  spirit as the daemon's `capability-barrel`/`flat-grouping` PRs
  (`docs/jini-port/od-reference-branches.md`).
- **Vertical-slice** (`ports.ts` + `dependencies.ts` + `hooks/*.hooks.ts` +
  `components/*.tsx` + barrel `index.ts`): for anything with real state,
  fetches, or injectable behavior. **Template: the user's own `MemorySection.tsx`
  refactor** (`refactor/web-memory-slice`, PR #5228, reviewed in
  `recon/r4-webui.md` §2 — read that review before starting the first
  vertical-slice item; it names the one adjustment needed when reused for a
  shared package: adopt the ports+dependencies+barrel seam, but drop ADR 0002's
  "no shared hooks" rule, since here the package IS the shared layer).

Every item below gets the same task-type breakdown project-runner already
uses (`red-spec`/`impl`/`package-contract`/`tarball`/`consumer-canary`/
`evidence`) — see "Loading this into the cloud" at the end for what that means
concretely for a single component vs. a whole feature slice.

---

## A. Flat-group items (GENERIC-ENGINE, r5 §3) — do these first

Highest-value single item: **`Icon.tsx`** (849 lines, 109 fan-in, zero deps —
unblocks nothing else, but is the most-reused file in the whole directory, so
port it first as the pattern-setter for this bucket).

| Source (`components-original/`) | Target | Verify before porting |
|---|---|---|
| `Icon.tsx` | `src/components/Icon.tsx` | — |
| `RemixIcon.tsx` | `src/components/RemixIcon.tsx` | — |
| `AgentIcon.tsx` | `src/components/AgentIcon.tsx` | Name suggests agent-domain; confirm it's a generic icon-by-key renderer, not hardcoding OD's agent list |
| `Toast.tsx` | `src/components/Toast.tsx` | — |
| `Loading.tsx` | `src/components/Loading.tsx` | — |
| `TooltipLayer.tsx` | `src/components/TooltipLayer.tsx` | Not dead — the graph tool showed 0 fan-in but a direct grep found real consumers (`SketchEditor.tsx`, `FileViewer.tsx`, both OD-product). Fine to port; graph coverage gap noted for future sweeps. |
| `CustomSelect.tsx` | `src/components/CustomSelect.tsx` | Verified 0 consumers via direct grep too (not just the graph tool) — likely dead code. Confirm before porting; may not be worth shipping. |
| `KitErrorBoundary.tsx` | `src/components/KitErrorBoundary.tsx` | Swap the concrete `reportHandledException` import for an injected callback prop (analytics-adapter pattern, r4 §4 slot table) |
| `LanguageMenu.tsx` | `src/components/LanguageMenu.tsx` | `LOCALES`/`LOCALE_LABEL` content is swappable data — keep as a prop/config, not hardcoded |
| `WorkingDirPicker.tsx` | `src/components/WorkingDirPicker.tsx` | This is the UI atom the chat-composer slice's `WorkingDirPort` binds to — coordinate with `@jini/chat-react` work so the port and the atom agree on shape |
| `AppChromeHeader.tsx` | `src/components/AppChromeHeader.tsx` | — |
| `ExportDiagnosticsButton.tsx` | `src/components/ExportDiagnosticsButton.tsx` | — |
| `PaletteTweaks.tsx` | `src/components/PaletteTweaks.tsx` | **0 fan-in** — verify it's live before porting |
| `plugins-home/useInView.ts` | `src/hooks/useInView.ts` | — |
| `auto-open-file.ts`, `enterpriseUrl.ts`, `markdown-scroll-sync.ts` | `src/utils/` (new — `packages/ui/README.md` doesn't define this slot yet; add it, these are non-component pure helpers) | Verified consumers (`ProjectView`/`DesignSystemFlow`, `EntryShell`/`EntrySettingsMenu`, `FileViewer` respectively) are all OD-product today — that's fine, a package can ship reusable logic before anyone outside OD uses it, but keep an eye out in case these turn out narrower than they look on a closer read |

**Moved out of this bucket after checking real consumers, not just import-count (this is
exactly the check you should run before finalizing any "pure, so it's generic" call):**
`composer-detail-position.ts` and `composer-flyout-placement.ts` looked generic
(zero deps) but their only consumer is `ComposerPlusMenu.tsx` — chat-composer's
plus-menu, not generic UI. Likewise `agentOrdering.ts`'s consumers include
`InlineModelSwitcher.tsx` (bucket C, agent-runtime/chat-react domain), alongside
`SettingsDialog.tsx`/`AvatarMenu.tsx` (OD-product). All three move to bucket C
below — they belong with chat-composer/agent-runtime work, not `@jini/ui`,
regardless of how clean their own code reads.

**Deferred pending an architecture ruling (r5 §4/§5c) — do NOT port to `@jini/ui` yet:**
`IframeKeepAlivePool.tsx` overlaps `@jini/renderers-react`'s srcdoc sandbox
domain — resolve which package owns it before landing either copy.

---

## B. Vertical-slice items (MIXED, r5 §2/§5) — MemorySection-pattern

| Source | Target | Generic core | OD residue to drop/port-behind-a-slot |
|---|---|---|---|
| `byok/*` (6 files: `ByokKeyField`, `ByokModelField`, `ByokProviderPicker`, `ByokConnectionTestControl`, `ByokProviderBaseUrl`, `validation.ts`) | `src/features/byok-config/` | Bring-your-own-API-key config UI — genuinely reusable for any agent-runtime consumer | Typed against OD's `state/config.KnownProvider` / `state/apiProtocols.API_KEY_PLACEHOLDERS` — port these out as a generic provider-catalog port (`ProviderCatalogPort`) the slice's `dependencies.ts` binds |
| `McpClientSection.tsx` | `src/features/mcp-config/` | MCP server add/list/test config UX | Bound to `providers/registry` + `SettingsDialog` tab placement — extract an `McpConfigPort` (add/list/test), drop the dialog-placement assumption |
| `composer/*` minus `MentionNode.ts`'s one OD binding (`LexicalComposerInput.tsx`, `CaretFloatingLayer.tsx`, `serialize.ts`, `deserialize.ts`) | `src/features/rich-text-input/` (or ship as a `src/components/` primitive with an injectable color-resolver prop if the vertical-slice ceremony turns out to be overkill — implementation-time judgment call, r5 §7 flags this as smaller than a full feature slice) | Generic Lexical rich-text/mention editor — verified zero OD imports in the four files above | `MentionNode.ts` imports `connectorBrandColor`/`resolveBrandTheme` from `utils/` to color-code `@mention` chips by OD "connector" brand — drop this import, accept an injected `resolveMentionColor` prop instead |
| `workspace/`'s tab-bar half (`SideChatTab.tsx`, `TabLauncherMenu.tsx`) | `src/features/workspace-tabs/` (or fold into a plain component if state stays simple after extraction) | Generic open-tabs bar layout, `od=0` | The rest of `workspace/` (`useConversationChat.ts`, `TerminalViewer.tsx`) is NOT part of this — those bind directly to `state/projects.ts`/`providers/daemon.ts` and belong to `@jini/chat-react` territory or stay OD-adapter, not `@jini/ui` |
| `WorkspaceTabsBar.tsx` | Fold into `src/features/workspace-tabs/` above, or `src/components/` if it turns out to need no state of its own beyond what the tab-bar slice already owns | Generic open-tabs-bar layout | One `router.ts` import (OD's hand-rolled singleton) — extract behind a navigation port |

**MIXED items needing a closer read before committing to a plan row (r5 §5,
flagged as not-fully-verified):** `QuickSwitcher.tsx` (generic Cmd-K pattern,
typed on OD's `WorkspaceContextItem`/`ProjectFile` — needs a generic
"switchable item" type param), `EditorIcon.tsx` (same shape as `Icon.tsx`, keyed
by OD's `HostEditorId` — generify the key union), `DesignKitView.tsx` (only 1
OD-dir import hit despite the OD-sounding name — r5 explicitly did not verify
this one, read it in full before deciding).

---

## C. Cross-package — NOT this plan's scope, routing only

Per r5 §4, these read as "generic" by coupling count but are chat/model/agent-runtime
domain, not generic UI. `packages/ui/README.md` already excludes chat UI by design.
**Get a Software Architect Agent ruling on the exact `@jini/chat-react` vs.
`@jini/agent-runtime` boundary before porting any of these** — this plan does
not resolve that call:

`ToolCard.tsx`/`QuestionForm.tsx` (r4 already says ship as-is to `@jini/chat-react`),
`SessionModeToggle.tsx`, `NextStepActions.tsx`, `ConversationsMenu.tsx`,
`FileOpsSummary.tsx` → `@jini/chat-react`. `InlineModelSwitcher.tsx`,
`modelOptions.tsx`, `modelCapabilityTags.ts`, `agentModelSelection.ts`,
`providerModelsCache.ts`, `AgentDiagnosticRow.tsx`, `AgentPicker.tsx`,
`agentOrdering.ts` (found via real-consumer check, not import count —
`InlineModelSwitcher.tsx` is one of its consumers) →
`@jini/agent-runtime` UI surface or `@jini/chat-react` (needs the ruling).
`PreviewModal.tsx` → `@jini/renderers-react`. `composer-detail-position.ts`,
`composer-flyout-placement.ts` (found the same way — only consumer is
`ComposerPlusMenu.tsx`) → wherever `@jini/chat-react`'s Composer positioning
logic lands.

---

## Loading this into the cloud

Two ways to actually run this plan through the automatic mechanism already
built this session, not mutually exclusive:

1. **Ad hoc dispatch** (what's been used for protocol/core/platform/sidecar/
   chat-core/daemon so far) — one subagent or one cloud routine prompt per row
   or small group of rows above, pointed at this doc + the vendored snapshot.
   Works today, no further engineering needed.
2. **Real `project-runner` WorkItems** — extend the ledger's DAG so `claim`
   picks these up automatically the same way it does the backend milestones.
   This is real but not-yet-done engineering: `automation/project-runner/src/dag/
   extraction-milestones.ts` currently only knows the 10 backend milestones from
   extraction-plan §8; someone needs to add a UI milestone set (this doc's rows,
   each as a `WorkItem` with the same `red-spec`/`impl`/`package-contract`/
   `tarball`/`consumer-canary`/`evidence` task-type breakdown) before `claim`
   will ever surface UI work. Not started — flagged in `refactor-roadmap.md`'s
   "ledger gap" section too.

Until (2) happens, use (1): `cloud-routine-prompt.md`'s general shape, with the
task-specific instruction swapped to point at one row of this plan and
`components-original/` as the source.
