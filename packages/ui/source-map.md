# `@jini/ui` — provenance

Origin: `integrations/open-design/reference/web-src-directories/` (vendored
snapshot of OD's `apps/web/src/{runtime,providers,state,lib,media,analytics,
styles,i18n,observability,utils}`), per `docs/jini-port/ui-extraction-plan.md`
and `docs/jini-port/recon/r4-webui.md`.

If you are adding a new section to this file, append it below rather than
rewriting the whole document — multiple tasks land content here in parallel
and a merge conflict on this file is expected and fine (the Coordinator
reconciles it).

---

## Section: i18n/observability/utils sweep (2026-07-16)

Scope: `web-src-directories/{i18n,observability,utils}/` per the Programmer
dispatch for this task (read-only source; real consumer check done against
`integrations/open-design/reference/components-original/`, falling back to
`integrations/open-design/reference/od-web-src.orig/` where a consumer
wasn't in the smaller snapshot). Covers this porting task only — see
`docs/jini-port/ui-extraction-plan.md` for the separate components/
features-bucket work (not touched here), and the next section below for the
parallel runtime/providers/state/lib/media/analytics/styles sweep.

### i18n (`src/features/i18n/`)

Ported the *mechanism*, not OD's translated copy. `i18n/content.<locale>.ts`
(19 files) and `i18n/content.ts`/`plugin-content.ts`/`runErrors.ts` were
**not** ported — they're OD's actual product strings, explicitly out of
scope per the task brief.

No `ports.ts`/`dependencies.ts` ceremony here (unlike the vertical-slice
features): the whole "port" *is* the React context + two small pure
functions it depends on. Splitting `locale.ts` (framework-free) from
`context.tsx` (the React bits) gave the priority-chain algorithm
(`resolveSystemLocale`/`detectInitialLocale`) a direct unit-test seam
without needing a mounted tree — that seemed like a better fit for this
package's existing "ports for injectable behavior" spirit than inventing a
`ports.ts` for a single-callback-shaped dependency.

| Jini file | Origin file(s) | What changed / was dropped |
|---|---|---|
| `src/features/i18n/types.ts` | `i18n/types.ts` (part) | Kept the *shape* only: `Locale` is now a plain `string` (was a fixed 19-tag union), `TranslationDict` is now a generic `{ [key: string]: string }` index type (was `Dict`, a ~1,400-named-key interface listing every OD product string). `LOCALES`/`LOCALE_LABEL` arrays (OD's specific supported-locale list + display names) dropped entirely — a host now supplies its own locale set via the `dictionaries` prop's keys. |
| `src/features/i18n/locale.ts` | `i18n/index.tsx` (`resolveSystemLocale`, `detectInitialLocale`) | `resolveSystemLocale` ported with its exact-match / Chinese-script-special-case / base-language-match priority chain, but now takes `supportedLocales` as a parameter instead of closing over the hard-coded `LOCALES` array (and the Chinese special-case now checks the candidate is actually in the host's supported set before returning it — the origin didn't need to, since `LOCALES` always contained both `zh-CN`/`zh-TW`). `detectInitialLocale` ported the priority chain (persisted > system-detected > fallback) but as an explicit options object (`supportedLocales`, `fallbackLocale`, `persistence`, `detectSystemLocale`) rather than reading module-level constants; see "Dropped: manual-vs-auto-detected tagging" below. |
| `src/features/i18n/context.tsx` | `i18n/index.tsx` (`I18nProvider`, `useI18n`, `useT`) | `DICTS` (the 19 imported locale modules) replaced by a `dictionaries` prop — the host passes its own `Record<Locale, D>`. `LS_KEY`/`LS_SOURCE_KEY`/`MANUAL_LOCALE_SOURCE` (OD's `'open-design:locale'` localStorage keys — product-identity strings) replaced by an injected `LocalePersistencePort` (`getStoredLocale`/`setStoredLocale`); omitting it means session-only locale state, no persistence at all. `readDesktopHostOsLocale()` (imported `getOpenDesignHost` from OD's desktop-host bridge package) dropped entirely — replaced by an optional `detectSystemLocale` prop a host supplies for the same "read the real OS locale on a packaged desktop shell" need; default detector is a plain `navigator.languages` check. `RTL_LOCALES` (hard-coded `['ar', 'fa']`) is now `rtlLocales` with a slightly larger built-in default (`['ar', 'fa', 'he', 'ur']`) and is host-overridable. `useI18n()`'s no-provider fallback and `I18nProvider` with no `dictionaries` at all now behave identically (both fall through every lookup to the raw key) via one shared `interpolate()` helper, rather than duplicating the interpolation regex in two places as the origin did. |
| `src/features/i18n/index.ts` | *(new — barrel)* | Re-exports `types`/`locale`/`context`. |

#### Dropped: manual-vs-auto-detected locale tagging

Origin's `detectInitialLocale` tagged every `localStorage` write with a
`'manual'` source marker so only a deliberate "change language" action could
out-rank a freshly-read OS locale on next launch — an auto-detected pick
never got to pin the app. That's real product UX policy, not generic
mechanism, so it's not reproduced here. A host that wants the same guarantee
implements it inside its own `LocalePersistencePort` (e.g. only call
`setStoredLocale` from an explicit user action, never from the initial
detection path).

### Observability (`src/features/observability/`)

All 8 origin files were checked for actual imports before assuming
genericity, per the task brief. Every one of them imports exactly one
thing beyond browser/DOM globals: `reportSafetyEvent` from OD's
`analytics/error-tracking.ts` (a PostHog-backed transport with consent-bypass
buffering). That's the single seam that needed genericizing — replaced
everywhere with an injectable `SafetyEventReporter` callback (`ports.ts`),
defaulting to a no-op, same "context/callback + host-injected adapter"
shape as the i18n feature and the analytics-adapter pattern already
documented in `docs/jini-port/recon/r4-webui.md` §5c.

Beyond that one shared seam, each file's own genericity read as claimed in
the task brief (boot timing / white-screen / stuck-run / long-task do read
as generic perf monitoring) — with two exceptions found on the closer read
required by the brief:

| Jini file | Origin file | What changed |
|---|---|---|
| `ports.ts` | *(new)* | `SafetyEventReporter` type + `noopSafetyEventReporter` default. |
| `boot-timing.ts` | `observability/boot-timing.ts` | Reporter now injected via `BootTimingOptions.reporter`. Dropped `detectNextRenderMode()`/`next_render_mode` field — it read a Next.js-specific `data-next-render` attribute, a framework coupling this package shouldn't assume for every host. Doc comment's PostHog-specific aside reworded to stay host-agnostic. |
| `long-task.ts` | `observability/long-task.ts` | Reporter injected; `MIN_DURATION_MS` (100) is now an overridable `minDurationMs` option. Logic otherwise verbatim. |
| `resource-error.ts` | `observability/resource-error.ts` | Reporter injected. Logic verbatim. |
| `visibility.ts` | `observability/visibility.ts` | Reporter injected. Logic verbatim. |
| `white-screen.ts` | `observability/white-screen.ts` | **Genericized the two hard-coded OD-specific markers**: `APP_MOUNTED_ATTR` (`'data-od-app-mounted'`) → configurable `mountedAttribute` (default `'data-app-mounted'`); `LOADING_SHELL_CLASSES` (`{'od-loading-shell'}`) → configurable `loadingShellClasses` (default `['app-loading-shell']`). Doc comment's literal `"Loading Open Design…"` sentinel-text example and the `#2527` PR reference dropped — reworded generically. Fallback root lookup (`document.getElementById('__next') ?? document.body`, a Next.js App-Router-specific id) is now `rootElementId` (optional, host-supplied) falling back straight to `document.body` when omitted, rather than assuming every host uses Next's `#__next`. |
| `iframe.ts` (renamed from `iframe-error.ts`) | `observability/iframe-error.ts` | **Genericized OD-domain fields.** `TrackIframeOptions.artifactId`/`projectId`/`conversationId` (OD's specific domain identifiers) replaced by a free-form `context?: Record<string, unknown>` bag merged into every emitted event — a host attaches whatever ids it has. `LOAD_TIMEOUT_MS` is now an overridable `timeoutMs` option. Reporter injected. |
| `stuck-run.ts` | `observability/stuck-run.ts` | Reporter now stored per-watched-run (set once in `trackRunStart`, reused by the later `trackRunProgress`/`trackRunTerminal` calls for that run — those two keep their original 1-positional-arg signatures since they don't need new configuration). `trackRunStart(runId, context = {})` → `trackRunStart(runId, options = {})` where `options.context` replaces the bare second positional arg and `options.reporter`/`options.stuckAfterMs` (was the module-level constant `STUCK_AFTER_MS`) are new. Doc comment's specific GitHub issue-number references (`#2464`/`#2405`/`#1451`) dropped — reworded to describe the generic symptom instead of citing OD's own issue tracker. `__resetStuckRunWatchdogForTests` kept (origin already exported this exact test-only escape hatch). |
| `install.ts` | `observability/install.ts` | `installWebObservability` now takes a `WebObservabilityOptions` bag (`reporter` applied to every sub-observer, plus per-observer nested option overrides) instead of taking no arguments. Still wires exactly the same 5 observers the origin did (boot timing, long task, resource error, visibility, white screen) and still deliberately excludes `iframe.ts`/`stuck-run.ts` — both need a call site (an iframe mount, a run lifecycle), matching the origin module's own boundary; this was not changed. |
| `index.ts` | *(new — barrel)* | Re-exports every module above. |

### Utils (`src/utils/`)

New slot on this package (README.md updated), per
`docs/jini-port/ui-extraction-plan.md`'s bucket-A note that this directory
doesn't exist yet and these are non-component pure/small-stateful helpers.
All 19 origin files were routed individually by checking real consumers via
`components-original/` (falling back to the fuller `od-web-src.orig/` tree
for 3 files whose consumers weren't in the smaller snapshot), not just
import-count — the same method the extraction plan used to catch
`composer-detail-position.ts` belonging to chat-composer rather than
generic UI.

#### Ported (7)

| Jini file | Origin file | Consumers checked | What changed |
|---|---|---|---|
| `file-system-errors.ts` | `utils/fileSystemErrors.ts` | `DesignFilesPanel.tsx`, `DesignSystemFlow.tsx` (OD-product today; zero type coupling — ships per the bucket-A "reusable logic before anyone outside OD uses it" note) | Verbatim. |
| `ime-composing.ts` | `utils/imeComposing.ts` | `BoardComposerPopover.tsx`, `PreviewDrawOverlay.tsx` (OD-product canvas/composer surfaces, but the concern — IME composition handling for any text input — is UI-generic and has zero domain-type coupling) | Verbatim. |
| `notifications.ts` | `utils/notifications.ts` | `SettingsDialog.tsx`, `ProjectView.tsx` | Genericized: `labelKey: keyof Dict` (OD's fixed dictionary type) widened to a plain `string`. Hard-coded `SERVICE_WORKER_URL = '/od-notifications-sw.js'` replaced by an optional `serviceWorkerUrl` option on `CompletionNotificationOpts` (omit to skip the service-worker path entirely). Hard-coded `tag = 'od-task-${status}'` (product-identity prefix) replaced by an optional `tagPrefix` option, defaulting to `'task'`. `SUCCESS_SOUNDS`/`FAILURE_SOUNDS` label keys reworded from OD's `settings.notifySound*` dot-paths to a package-neutral `notifications.sound.*` namespace (illustrative placeholder keys — a host supplies its own i18n dictionary entries for them, same as every other UI string). |
| `platform.ts` | `utils/platform.ts` | `ProjectView.tsx`, `AvatarMenu.tsx`, `FileWorkspace.tsx` | Verbatim. |
| `smooth-scroll-to-top.ts` | `utils/smoothScrollToTop.ts` | `EntryShell.tsx`, `HomeView.tsx` (OD-product; zero coupling) | Verbatim (only file renamed to kebab-case for this package's naming convention). |
| `uuid.ts` | `utils/uuid.ts` | `DesignSystemFlow.tsx`, `ProjectView.tsx`, `workspace/useConversationChat.ts` (OD-product + chat domain; but the generator itself has zero type/domain coupling — same "ship reusable logic early" reasoning as `smooth-scroll-to-top.ts`) | Verbatim logic; doc comment's product-identity example reworded generically. |
| `visual-stability.ts` | `utils/visualStability.ts` | `DesignFilesPanel.tsx`, `SettingsDialog.tsx`, `plugins-home/cards/{DesignSystemSurface,HtmlSurface}.tsx` | Genericized the hard-coded product-identity storage key (`'open-design:visual-stability'`) into a configurable `storageKey` parameter, defaulting to `'jini:visual-stability'`. |

#### Not ported — belongs elsewhere (10)

Real consumers are chat/composer/agent-runtime/BYOK domain, or the file is
itself an OD-product feature — per the task brief, these do **not** belong
in `@jini/ui` even though several read as "pure" in isolation.

| Origin file | Real consumers | Where it actually belongs |
|---|---|---|
| `utils/agentLabels.ts` | `AssistantMessage.tsx`, `ProjectView.tsx`, `workspace/useConversationChat.ts` | agent-runtime/chat-react (agent display-name mapping for chat messages); also hard-codes `'amr': 'Open Design'`, a product-identity string that would need stripping even if it were in scope. |
| `utils/apiProtocol.ts` | `InlineModelSwitcher.tsx`, `ProjectView.tsx`, `AvatarMenu.tsx` | agent-runtime/BYOK domain (imports `AppConfig`/`ApiProtocol` + a provider-compat helper). |
| `utils/byokProvider.ts` | `ProjectView.tsx`, `SettingsDialog.tsx` | `features/byok-config` — explicitly out of scope for this task. |
| `utils/chatTime.ts` | none found in either vendored snapshot (imports `ChatMessage` + i18n `Dict`, so likely consumed by a chat surface outside the vendored subset) | chat-core/chat-react (message-time formatting is chat-domain regardless of live-consumer count). |
| `utils/connectorBrandColor.ts` | `composer/MentionNode.ts` | `features/rich-text-input` — explicitly out of scope; also the exact file `ui-extraction-plan.md` already calls out as needing to become an injected `resolveMentionColor` prop rather than a direct import. |
| `utils/inlineMentions.ts` | `ChatComposer.tsx`, `HomeView.tsx`, `NewAutomationModal.tsx`, `HomeHero.tsx`, `composer/{LexicalComposerInput,serialize,deserialize,MentionNode}` | `features/rich-text-input` — explicitly out of scope; this is the `@mention` parsing engine the composer's Lexical editor depends on. |
| `utils/pluginInsertionTracking.ts` | none found in the vendored snapshot; own doc comment names `ChatComposer`'s `@`-mention popover as its caller | Same domain as `inlineMentions.ts` above (imports it directly) — `features/rich-text-input`, out of scope. |
| `utils/pluginRequiredInputs.ts` | `HomeView.tsx` | OD's plugin-input-validation system; imports `InputFieldSpec` from `@open-design/contracts` — a forbidden import, and the concept ("plugin required inputs") is OD-product-specific, not generic UI. |
| `utils/projectName.ts` | `EntryShell.tsx`, `ProjectView.tsx` | OD-product (auto-naming a design "Project" from a prompt, with CJK/English NLP heuristics tuned to OD's own design-tool verbs). Imports OD's `Project` type. |
| `utils/promptTemplateDsCategories.ts` | none found in either vendored snapshot | OD-product (maps a design-system's metadata to prompt-template gallery categories; imports OD's `DesignSystemSummary`). |
| `utils/visibleAgents.ts` | `McpClientSection.tsx`, `AgentPicker.tsx`, `InlineModelSwitcher.tsx`, `SettingsDialog.tsx`, `AvatarMenu.tsx` | agent-runtime/chat-react (agent-list filtering); imports OD's `AgentInfo` and hard-codes the `'byok-opencode'` agent id. |

#### Not ported — OD-specific / forbidden import (1, overlapping the table above)

| Origin file | Reason |
|---|---|
| `utils/pickAndImportError.ts` | Imports `OpenDesignHostProjectImportResult` from `@open-design/host` (forbidden import) and formats OD's desktop "Open folder failed" error flow — not a generic-UI concern, and not portable without the OD desktop-host type it's built around. |

(`utils/pluginRequiredInputs.ts` above also has a forbidden `@open-design/contracts` import, in addition to being OD-plugin-specific.)

### Dependencies added by this section

`@jini/ui` now depends on `react` (the i18n feature is a React context +
hooks) — the first `@jini/*` package to do so; the parallel
runtime/providers/state/lib/media/analytics/styles sweep below explicitly
deferred adding React for exactly this reason, so this section's i18n work
is what actually adds the toolchain. `react-dom`, `@testing-library/react`,
`@types/react`, `@types/react-dom`, and `jsdom` are dev-only, for tests. No
`@jini/*` package dependency, no OD product import — verified by grep
across `packages/ui/src/**` for `@open-design/*` specifiers and the
`Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design` product-identity strings
(both clean; see Programmer handoff report for the exact commands run).

### Package scaffolding added by this section

- `packages/ui/tsconfig.json` — merged with the parallel sweep's version of
  this same new file: kept `"lib": ["ES2023", "DOM", "DOM.Iterable"]` from
  that section and added `"jsx": "react-jsx"` for this section's React
  content.
- `packages/ui/vitest.config.ts` + `packages/ui/vitest.setup.ts` (new) — jsdom
  test environment and a global `@testing-library/react` `cleanup()` after
  each test (needed once real component tests existed in this package).
- `packages/ui/package.json` — added `react` as a runtime dependency and the
  test-only React/DOM/testing-library dev dependencies described above.

### Not ported — out of task scope (unchanged from before this task)

`src/features/byok-config/`, `mcp-config/`, `rich-text-input/`,
`workspace-tabs/`, and the flat-group `src/components/` bucket (Icon.tsx,
Toast.tsx, etc.) from `docs/jini-port/ui-extraction-plan.md` are untouched —
explicitly out of scope per this task's brief.

---

## Section: runtime/providers/state/lib/media/analytics/styles sweep (2026-07-16)

Scope: fast reusability triage of the 7 directories above (~118 files) per
the Programmer dispatch for this task. Full per-file verdict table is in the
Programmer's handoff report, not duplicated here; this section only covers
what was actually ported.

### Ported

| Jini file | Origin | Transform |
|---|---|---|
| `src/utils/zip.ts` | `runtime/zip.ts` | Verbatim (already zero-dependency, zero OD refs) — minimal stored-mode ZIP encoder. Comment wording lightly reworded (dropped the OD-specific "Download as ZIP button" framing). |
| `src/utils/sse.ts` | `providers/sse.ts` | Verbatim logic (`parseSseFrame`) — already confirmed generic by `docs/jini-port/recon/r4-webui.md` §1c. Comment reworded to describe the generic transport-agnostic use (not OD's specific daemon SSE contract). |
| `src/utils/copy-to-clipboard.ts` | `lib/copy-to-clipboard.ts` | Verbatim. Dropped the comment's reference to OD's `FileViewer.tsx`/issue #451 provenance. |
| `src/utils/appearance.ts` | `state/appearance.ts` | Generified: dropped the `AppTheme` import from OD's `../types` (replaced with a local `AppearanceTheme = 'light' \| 'dark'` union — same two values the function actually branches on). `DEFAULT_ACCENT_COLOR` changed from OD's brand accent (`#c96442`) to a neutral default (`#2563eb`, previously the second swatch) since a shared package should not ship one consumer's brand color as the default; `#c96442` kept as a swatch option. Everything else (CSS custom-property names, `color-mix` formula, `normalizeAccentColor`/`resolveAccentColor`/`applyAppearanceToDocument` logic) is verbatim. |
| `src/utils/dom-subscriptions.ts` | `providers/dom/chat-pane.dom.ts` (`subscribeOutsideClickOrEscape`, `subscribeWindowEvent`, `subscribeVisibleFocusOrVisibilityChange`, `scheduleInterval`, `scheduleTimeout`, `openExternalUrl`, `getDocumentBody`) + `providers/dom/chat-composer.dom.ts` (`getViewportSize`) | Verbatim logic. These two origin files were headed "DOM bridges owned exclusively by the chat-pane/chat-composer slice," but the specific functions ported have zero chat/composer/pane-specific logic in their bodies (pure window/document event-subscription primitives) — re-verified against real usage before lifting, same check `docs/jini-port/ui-extraction-plan.md`'s §A footnotes call out for `composer-detail-position.ts` etc. Functions left behind in the origin files (`readComposerDraft`/`writeComposerDraft`, `openDesignSystemPickerTrigger`, `subscribeComposerPortalRect`, `subscribeComposerLayerHeight`) are domain-specific (composer draft persistence, a composer-specific trigger selector, composer/pane rect-tracking tied to layout assumptions) and were left for `@jini/chat-react`. |

All five files have real unit tests (`*.test.ts` alongside each). None of
`copyToClipboard`/`applyAppearanceToDocument`/`dom-subscriptions.ts` had a
jsdom/happy-dom test environment available in this repo yet (no `jsdom` or
`happy-dom` package installed, no `vitest.config.ts` at the repo root or in
this package) — tests stub the specific `window`/`document`/`navigator`
surface each function touches by hand via `vi.stubGlobal` rather than adding
a new devDependency mid-task. `packages/ui/tsconfig.json` was created
(previously missing) with `lib: ["ES2023", "DOM", "DOM.Iterable"]` added on
top of the repo's `tsconfig.base.json` so these DOM-touching utilities
typecheck.

### Explicitly not ported (belongs elsewhere or not reusable)

See the Programmer handoff report's full per-file table for the complete
list (~110 files). Summary of the routing decisions:

- **`@jini/chat-react` / `@jini/agent-runtime` territory** (chat/tool/model
  domain, not generic UI): `runtime/{markdown.tsx, shiki.ts, file-ops.ts,
  chat-events.ts (already resolved as not-portable in
  `packages/chat-core/source-map.md`), resume.ts, in-project-link.ts,
  browser-action-executor.ts, design-toolbox.ts}`, `providers/{daemon.ts
  (already known — see r4), anthropic*.ts, *-compatible.ts, api-proxy.ts,
  connection-test.ts, provider-models.ts, elevenlabs-voices.ts}`,
  `providers/dom/{chat-composer.dom.ts, chat-pane.dom.ts}`'s remaining
  domain-specific functions (see table above).
- **`@jini/renderers-react` territory** (artifact/preview rendering):
  `runtime/{srcdoc.ts (deferred, confirmed still present at 2,881 lines —
  not touched), react-component.ts, exports.ts, jsx-module-refs.ts}`,
  `lib/use-deck-preview-scale.ts`.
- **`features/byok-config` territory** (out of scope this task, owned by
  another task per the dispatch brief): `state/apiProtocols.ts` is the exact
  OD-specific data (`SUGGESTED_MODELS_BY_PROTOCOL`, `API_KEY_PLACEHOLDERS`,
  etc.) `docs/jini-port/ui-extraction-plan.md` §B already flags as the
  residue a `ProviderCatalogPort` needs to abstract away; `lib/
  resolve-finalize-request.ts` and `providers/connection-test.ts`/
  `provider-models.ts` are the BYOK finalize/connection-test transport this
  feature's `dependencies.ts` would bind to.
- **`features/mcp-config` territory** (out of scope this task, owned by
  another task): `state/mcp.ts` is the daemon transport (`fetchMcpServers`,
  `saveMcpServers`, MCP OAuth flow) that feature's `dependencies.ts` should
  bind to once that slice is built. Not ported here per the dispatch brief's
  explicit instruction to only note this, not build the slice.
- **Not reusable — OD product-specific** (brand kit, decks/presenter, AMR
  billing, plugins, onboarding, media-provider catalogs, analytics/PostHog
  wiring, project/workspace state): the remainder of `runtime/`
  (amr-*, brand-*, deck-thumbnail-parser.ts, design-kit.ts,
  design-md-parse.ts, design-system-package-audit.ts, kit-*.ts,
  plugin-source.ts, powered-preview.ts, slide-nav.ts, speaker-notes.ts,
  useBrand*.ts), `providers/{registry.ts, project-events.ts}` (already
  flagged OD-specific by r4), all of `state/` except `appearance.ts`
  (`apiProtocols.ts` routed above; `config.ts`, `libraryHandoff.ts`,
  `maxTokens.ts`, `onboarding-profile.ts`, `project-locations.ts`,
  `projects.ts`, `workspace.ts`, `litellm-models.json`), all of `media/`
  (OD's media-generation model registry, daemon-paired), all of `analytics/`
  (every file couples to `@open-design/contracts/analytics` and/or
  `posthog-js`; the host-supplied-tracker *pattern* is a design decision for
  a future `@jini/chat-react` analytics context, not a file to port), and
  the rest of `lib/` (`whats-new.ts`, `build-continue-in-cli-toast.ts`,
  `build-clipboard-prompt.ts`, `parse-provenance.ts`, `pod-members.ts`,
  `updater.ts`).
- **Deferred, not a rejection**: `lib/use-stable-handler.ts`
  (`useStableHandler`) is a genuinely generic React hook (zero OD imports)
  but this package had no React dependency wired up yet at the time of this
  section's work (`packages/ui/package.json` had none before this task, and
  no other `@jini/*` package in this repo depended on `react` yet either) —
  porting one hook was not enough justification to add the first React/JSX
  toolchain wiring as a side effect of a file-triage task. The parallel
  i18n/observability/utils section above did add that wiring for its own
  context+hooks work; `use-stable-handler.ts` itself is still not ported —
  left for whichever task next needs it for real.
- **`styles/` — human decision needed, not touched**: this task only ports
  `.ts`/`.tsx`. `styles/tokens.css`, `styles/primitives.css`, and
  `styles/base.css` read as genuinely generic design tokens/resets (color
  vars, button/form primitives, box-sizing reset) worth a human look for a
  future design-tokens package; everything else (`chat.css`,
  `design-system-flow.css`, `shell.css`, `entrance.css`,
  `social-share.css`, `modal-window-drag.css`, `plan-badge.css`, and the
  `home/`, `viewer/`, `workspace/`, `remixicon/` subdirectories) is
  OD-product-specific by name and content.

### Dependencies

None beyond the TypeScript standard library + DOM lib types
(`packages/ui/tsconfig.json` adds `"DOM"`/`"DOM.Iterable"` to the base
`lib` list). No `@open-design/*` specifier, no `Open Design`/`OD_`/
`--od-stamp`/`/tmp/open-design` product-identity string — verified by grep
across `packages/ui/src/**`.

---

## Section: ui-extraction-plan.md §A — flat-group items (2026-07-17)

Scope: `docs/jini-port/ui-extraction-plan.md` section A only (13 components,
1 hook, 3 utils). Run via a cloud routine, testing whether frontend/component
porting (as opposed to prior backend-milestone cloud runs) works through this
mechanism — see the honesty note at the end of this section for what that
surfaced.

This is the **first real content in `packages/ui/src/components/` and
`src/hooks/`**, and the first task to add `react`/`react-dom` as real
dependencies of this package (`peerDependencies` + `devDependencies` for
building/testing within the package itself; `@types/react`, `@types/react-dom`,
`@testing-library/react`, `@testing-library/user-event`, and `jsdom` were
added as devDependencies for component tests). `packages/ui/tsconfig.json`
gained `"jsx": "react-jsx"`. A new `src/utils/` slot was added per the plan
(components/ and hooks/ already existed from the prior utility-layer task).

### Ported verbatim (or near-verbatim, cosmetic only)

| Jini file | Origin | Transform |
|---|---|---|
| `src/components/Icon.tsx` | `Icon.tsx` | Verbatim. 849-line pure `name -> <svg>` switch, zero deps, zero OD references — the pattern-setter for this bucket per the plan. |
| `src/components/RemixIcon.tsx` | `RemixIcon.tsx` | Verbatim. |
| `src/components/AgentIcon.tsx` | `AgentIcon.tsx` | Verified generic per the plan's flag: the `ICON_EXT`/`MONO_ICONS` tables are coding-agent-CLI brand ids (claude, codex, gemini, aider, devin, …), not an OD product list. Added an optional `basePath` prop (default `/agent-icons`, matching the origin's hardcoded path) so a host can serve assets from elsewhere — the one behavioral addition in this row. |
| `src/components/Loading.tsx` | `Loading.tsx` | Verbatim logic. `DesignCardSkeleton`'s doc comment dropped its "DesignsTab grid" framing (an OD feature name) since the shape itself — thumbnail over meta lines — is a generic card-loading pattern; CSS class names (`design-card`, `skeleton-block`, …) are left as-is since they read as generic content-shape names, not product identity. |
| `src/components/PaletteTweaks.tsx` | `PaletteTweaks.tsx` | **Verified dead code**: re-ran the plan's zero-fan-in check with a fresh grep across `components-original/` — still zero real consumers. Shipped anyway per the routine's instruction (small, self-contained, correct); flagged explicitly with an inline `NOTE` comment rather than silently presented as a normal port. |
| `src/utils/auto-open-file.ts` | `auto-open-file.ts` | Verbatim logic. Comment wording lightly reworded to drop OD-specific framing (dropped a reference to a specific internal source file path). |
| `src/hooks/useInView.ts` | `plugins-home/useInView.ts` | Verbatim. |

### Ported with generification beyond the plan's own notes

The plan flagged `CustomSelect`/`PaletteTweaks` (dead-code) and named the
KitErrorBoundary/LanguageMenu adjustments explicitly; everything else in its
table was implicitly "mechanical move." Reading each file surfaced more OD
coupling than the plan's one-line "Verify before porting" column called out —
consistent with the plan's own warning elsewhere to keep checking real
consumers/content, not just trust the classification. Recorded here in full
rather than glossed over:

| Jini file | Origin | What was OD-specific, and what changed |
|---|---|---|
| `src/components/Toast.tsx` | `Toast.tsx` | Logic verbatim. CSS class hooks renamed `od-toast*` → `jini-toast*` — not on the AGENTS.md banned-string list (that's `OD_`/`Open Design` literal, not lowercase `od-`), but `od-` unmistakably reads as an Open-Design-branded class prefix in a package whose whole mandate is product-neutral, so renamed for genuine (not just regex-clean) neutrality. |
| `src/components/TooltipLayer.tsx` | `TooltipLayer.tsx` | Same `od-tooltip*` → `jini-tooltip*` rename (trigger class, layer class, the suppressed-native-title data attribute). This component reads a cross-component contract (`.jini-tooltip[data-tooltip]`), so `AppChromeHeader.tsx` below was updated to emit the new class name to keep the contract intact. |
| `src/components/CustomSelect.tsx` | `CustomSelect.tsx` | **Verified dead code** (see above) — shipped anyway, flagged with an inline `NOTE` comment. Same `od-select*` → `jini-select*` rename as Toast/TooltipLayer. |
| `src/components/KitErrorBoundary.tsx` | `KitErrorBoundary.tsx` + `.module.css` | Per the routine's explicit instruction: swapped the concrete `reportHandledException` analytics import for an injected `onError` callback prop, defaulting to a no-op. Also dropped: the `useT()` i18n hook (this package has no i18n system; `title`/`retryLabel` are now plain-English string props with defaults) and the `.module.css` import (this package has no CSS-module-aware build step yet — flattened to plain `jini-kit-error*` class names, same as every other component in this batch; the underlying visual CSS itself was not ported, consistent with Toast/CustomSelect/TooltipLayer not shipping CSS either). |
| `src/components/LanguageMenu.tsx` | `LanguageMenu.tsx` | Per the routine's explicit instruction: `LOCALES`/`LOCALE_LABEL` are now a `locales: LocaleOption[]` prop instead of a hardcoded import. Also dropped: OD's `useI18n()` context (replaced with `locale`/`onLocaleChange` props — the component is now fully controlled) and the `motion/react` (Framer Motion) animation — the origin's `popoverIn`/`staggerContainer`/`listItem` variants live in OD's own `../motion` module and pulling in a whole animation library as a transitive dependency for one menu's open/close felt like scope creep for a single flat-group item; replaced with a plain conditional-render (open/close is instant, no exit animation) and left animation as something a host's own CSS can add via the popover's className. |
| `src/components/WorkingDirPicker.tsx` | `WorkingDirPicker.tsx` + `.module.css` | Dropped `useT()` (replaced with a `labels` prop, spread over English defaults) and the `.module.css` import (flattened to plain `jini-working-dir-*` class names, same rationale as KitErrorBoundary — no CSS-module build step in this package yet, and no CSS shipped). Doc comments' references to "the Home composer" / "the in-project composer" (OD's specific two call sites) reworded to describe the shape generically. |
| `src/components/AppChromeHeader.tsx` | `AppChromeHeader.tsx` | Dropped `useT()` — `backLabel` already existed as an overridable prop in the origin, just widened its default from a translated string to a plain-English literal (`'Back'`). Updated its `od-tooltip` trigger class to `jini-tooltip`, matching the `TooltipLayer.tsx` rename above so the two still work together. |
| `src/components/ExportDiagnosticsButton.tsx` | `ExportDiagnosticsButton.tsx` | The largest single deviation in this batch. The origin declared a **global `Window.openDesignDesktop`** API (an Electron contextBridge binding) and hardcoded `DIAGNOSTICS_FILENAME_PREFIX = 'open-design-diagnostics'` — both unmistakably product identity, even though neither string matches the AGENTS.md banned-list regex literally (`openDesignDesktop` isn't `OD_`; `open-design-diagnostics` isn't `Open Design` with a space). Read closely, this file is exactly the kind of component the plan's own footnote warns about — "these turn out narrower than they look on a closer read" — just not one the plan's per-file table had flagged. Generified: the global was replaced with an injected `desktopBridge?: DesktopExportBridge` prop (same shape, now caller-supplied instead of read off `window`); `filenamePrefix` and `exportPath` (was hardcoded `/api/diagnostics/export`) are now props with generic defaults (`'diagnostics'`, same path kept as the default since it's a reasonable convention, not a product name). Dropped `useT()` for a `labels` prop. Renamed the exported component from `ExportDiagnosticsRow` to `ExportDiagnosticsButton` to match the plan's target filename. |
| `src/utils/localized-url.ts` | `enterpriseUrl.ts` | **Not a mechanical move — the biggest finding of this task.** The origin hardcoded OD's actual marketing domain (`https://open-design.ai`, plus a `127.0.0.1:17574` local-dev-server special case) and OD's own locale-to-landing-page-segment table. That's not reusable logic sitting next to OD-only consumers (which is what the plan's footnote anticipated for this file) — it's OD's own marketing URL, full stop, and doesn't belong in a product-neutral engine package even unported-but-dormant. What's actually generic is the *algorithm* (resolve locale → URL segment, falling back to the base's default language), so that's what was kept: `buildLocalizedUrl(locale, { baseUrl, localeSegments })` takes both the base URL and the segment table as caller-supplied arguments. Renamed the file since `enterpriseUrl` names an OD feature ("the enterprise landing page") that no longer exists in this version. |
| `src/utils/markdown-scroll-sync.ts` | `markdown-scroll-sync.ts` | Logic verbatim (this was already generic — no OD coupling found). Added `micromark`/`micromark-extension-gfm` as real (non-dev) dependencies since `extractMarkdownBlockLines` needs them at runtime. One small generification: `measurePreviewBlockOffsets` took a hardcoded `.markdown-rendered` selector for the preview root; added it as an optional `previewSelector` parameter (same default) so a host isn't forced into that exact class name. |

### Component tests

Every component and the hook got real interaction tests via
`@testing-library/react` + `@testing-library/user-event` (jsdom), not just
render smoke tests, for anything with actual state/logic: `CustomSelect`
(open/select/disabled/grouped/Escape), `Toast` (TTL auto-dismiss, code pins
open, stale-closure re-arm bug regression test), `KitErrorBoundary` (catch +
onError + retry), `LanguageMenu` (open/select/Escape), `WorkingDirPicker`
(pick/recent/clear/labels), `TooltipLayer` (show/hide/Escape/class-gating),
`PaletteTweaks` (select/deselect/hover-preview/Escape),
`ExportDiagnosticsButton` (desktop-bridge success/failure/cancel, HTTP
fallback with a mocked `fetch`), `AgentIcon` (known/mono/fallback paths),
`useInView` (mocked `IntersectionObserver`, once vs. continuous tracking, no-IO
fallback). `Icon`/`RemixIcon`/`AppChromeHeader`/`Loading` (purely
presentational) got lighter smoke-level tests. `auto-open-file.ts` and
`markdown-scroll-sync.ts`'s pure functions got thorough unit tests;
`localized-url.ts` got a handful of cases. `measureEditorBlockOffsets`/
`measurePreviewBlockOffsets` (DOM-measurement-heavy, need real layout) were
left untested — jsdom doesn't compute real box metrics, so a test would only
assert against jsdom's fixed zero-size stand-ins, not the actual algorithm.

Component tests need a jsdom DOM. This package's `vitest.config.ts` (shared
with the parallel i18n/observability porting task — see that section above)
sets `environment: 'jsdom'` package-wide since most of this package's tests
touch the DOM; the two tests that assert real *no*-DOM behavior
(`dom-subscriptions` SSR-safety, `zip`'s native-`Blob` reliance) opt back out
per-file via `// @vitest-environment node`. This task's own new test files
carry a redundant `// @vitest-environment jsdom` pragma (harmless alongside
the package default — they were written before the jsdom-vs-node reconciliation
above landed on `main`) rather than being cleaned up, to avoid re-touching 14
files for a no-op.

### Neutrality check

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|@open-design/"` across
every file in this section: clean (no matches). A second, stricter self-imposed
pass — `grep -rn "od-\|open-design\.ai\|openDesignDesktop"` (catching
lowercase-prefix and non-regex-exact product identity the literal banned list
wouldn't catch) — is also clean, after the `od-*` → `jini-*` class renames and
the `ExportDiagnosticsButton`/`localized-url` generification described above.

### Honesty note — running this kind of task as a cloud routine

Requested explicitly by the routine prompt, since this is the first cloud run
doing frontend/component porting rather than a backend milestone:

- The plan document's per-file "Verify before porting" column was accurate
  where it existed, but several files it marked with a bare `—` (implying
  "just move it") turned out to need real generification once actually read
  in full — `ExportDiagnosticsButton.tsx`'s global `window.openDesignDesktop`
  and `enterpriseUrl.ts`'s hardcoded `open-design.ai` domain being the two
  clearest examples. A plan written from a file-list + grep sweep (`r5`) is a
  good triage pass but is not a substitute for reading each file before
  porting it — this task budgeted time to do that and it paid off twice.
- Porting 13 React components pulled in `react`/`react-dom` as this package's
  first-ever framework dependency, plus a testing stack
  (`@testing-library/react`, `@testing-library/user-event`, `jsdom`) and a
  markdown-parsing dependency (`micromark`). None of that was flagged as
  necessary in the plan doc itself — it only becomes obvious once you look at
  what these specific files actually import. A cloud-routine prompt for
  component-porting work should expect to make (and should explicitly budget
  time for) real dependency/build-config decisions, not just file moves.
- jsdom-specific test failures were the main time sink, not the porting
  itself: (1) this task originally defaulted the package to Node and opted
  new component tests into jsdom per-file — reasonable in isolation, but a
  rebase onto `main` found the parallel i18n/observability task had landed
  the *opposite* choice first (package-wide `environment: 'jsdom'`, with the
  two SSR-safety tests opted back out via `// @vitest-environment node`, see
  its own `fix(ui): reconcile test-environment conflict` commit) — reconciled
  by adopting theirs, since more of this package's tests need jsdom than need
  raw Node, and it was already the precedent on `main`; (2)
  `@testing-library/react` needs an explicit `afterEach(cleanup)` wired
  through a setup file in this repo's vitest setup (no auto-detection without
  `test.globals: true`), or renders silently accumulate across tests in the
  same file; (3) jsdom's lack of real layout (`getBoundingClientRect` always
  zero) makes hover-dependent interaction tests (the working-directory
  picker's hover-opens-submenu behavior) behave differently than a real
  browser — `userEvent.click`'s simulated pointer travel can spuriously fire
  `mouseleave` on a hover-tracked ancestor. None of these are React-vs-Node
  issues, they're specifically about mixing DOM-dependent and DOM-free tests
  in one package and about component *interaction* testing (not just
  rendering) — worth calling out explicitly for whoever runs the next
  component-porting routine, since none of it was visible from the plan doc
  or from the prior (Node-only) utils-porting task's precedent.

---

## Section: `features/connectors/` — ConnectorsBrowser.tsx canary (2026-07-17)

Source: `integrations/open-design/reference/components-original/ConnectorsBrowser.tsx`
(1,573 lines) + the two pure helpers it imported from `EntryView.tsx`
(`isTrustedConnectorCallbackOrigin`, `sortConnectorsForSearch`/
`getConnectorSearchScore`/`sortConnectorsForDisplay`). Per
`docs/jini-port/god-components-extraction-plan.md` §0 — the canary for the
broader god-component extraction plan; several more components are queued
behind it pending how this one went. Per r6 §1.15: **FULL SLICE**, the
cleanest full-file candidate in the whole sweep — nearly the entire file is
a generic "OAuth integration marketplace" UI.

### What shipped — `packages/ui/src/features/connectors/`

| File | Contents |
|---|---|
| `types.ts` | Generic `Connector`/`ConnectorTool`/`ConnectorStatus`/`ConnectorActionResult`/`ConnectorAuthorizationPending(State)`/`ProviderTab` — stripped of `ConnectorDetail`/`ConnectorConnectResponse`/`ConnectorStatusResponse` verbatim shapes (Composio-specific fields dropped: no category-map dependency, `logoUrl` is host-resolved rather than Composio-CDN-derived). |
| `constants.ts` | Poll interval, tool-preview page size, storage key (`jini-connectors-authorization-pending`, renamed from `od-connectors-authorization-pending`), a `DEFAULT_PROVIDER_TABS` single-entry fallback. |
| `rules.ts` | All pure logic ported 1:1: connector/tool merging, authorization-pending prune/update, stale-authorization detection, status-change diffing, search scoring/sorting, origin-trust check, fallback-logo initials/palette hash, plus one **new** extraction born from the Phase 8.5 audit below (`scopeConnectorsToProvider`). |
| `ports.ts` | `ConnectorsPort` (fetchConnectors/fetchConnectorEnrichment/fetchConnectorStatuses/fetchConnectorDetail/connectConnector/disconnectConnector/cancelConnectorAuthorization/openExternalUrl), `ConnectorAuthPendingStoragePort`, `ConnectorAuthBridgePort`. |
| `dependencies.ts` | `createFakeConnectorsPort` — an in-memory test/demo double (per the canary's own instruction: ship a fake, not a real `providers/registry` call). `createBrowserConnectorAuthPendingStorage`/`createBrowserConnectorAuthBridge` are **real** SSR-guarded browser implementations (sessionStorage + postMessage/focus/visibility) — these two touch only generic browser APIs with no backend-specific shape, so shipping them for real (rather than faking them too) means a host only has to supply its own `data` port. |
| `hooks/useConnectorCatalog.ts` | Two-phase catalog load: always-on lightweight fetch + lazy `unlocked`-gated enrichment. |
| `hooks/useConnectorAuthorization.ts` | The concurrency-correctness core: auth-pending persistence, poll-while-pending, the OAuth postMessage/focus/pageshow/visibilitychange handshake, stale-authorization auto-cancel, connect/disconnect actions. Kept as one cohesive hook per the Phase 6 "one natural owning cluster" guidance — these pieces read/write the same `pending`/`cancelFailed`/`authError` state and would only fragment awkwardly if split further. |
| `hooks/useConnectorDetail.ts` | Detail-drawer open/close + paginated tool-preview hydration with retry-token-gated failure tracking. |
| `components/` | `ConnectorLogo` (initials-fallback + optional image, Composio-CDN slug logic dropped), `ProviderTabBar` (config-driven, `match`-predicate kept generic), `ConnectorSearchBar`, `ConnectorGate` (locked/gated state, href/copy now host-supplied instead of the hardcoded `app.composio.dev` link), `ConnectorAlertList`, `ConnectorCard`, `ConnectorGrid` (card grid + empty-state + gate composition), `ConnectorDetailDrawer` (modal detail drawer with paginated tool list). |
| `ConnectorsBrowser.tsx` | The orchestrator — composes the 3 hooks + `rules.ts` derivations, defaults `dependencies` to the fake double. |
| `index.ts` | Public barrel. |

### Dropped (per the canary plan)

- The ~90-entry Composio category→i18n label map (pure OD-specific data) — a
  host supplies `getCategoryLabel?: (category: string) => string`, default
  identity.
- `ConnectorLogo`'s Composio-CDN slug-construction logic
  (`composioLogoUrl`/`COMPOSIO_LOGO_SLUG_OVERRIDES`, a `/api/connectors/logos/*`
  daemon-proxied endpoint) — not called out by r6 as an exclusion, but is
  genuinely Composio-specific in the same way the category map is (another
  instance of the plan doc under-specifying what needs generifying once the
  file is actually read in full, consistent with the honesty note the prior
  i18n/utils task recorded). Kept the generic initials/palette-hash fallback,
  now taking a plain host-resolved `logoUrl` prop instead.
- `useResolvedTheme` (the `MutationObserver`/`matchMedia` `data-theme`
  auto-detection hook) — not in the canary's explicit "what ships" component
  list. `ConnectorLogo`/`ConnectorCard`/`ConnectorDetailDrawer` no longer take
  a theme at all (the logo is a single image, not theme-swapped); a host that
  wants theme-swapped logo URLs resolves that itself before handing
  `logoUrl` in.
- The i18n mechanism (`useT`/`Dict`) — OD's actual translated copy for this
  surface (~30 `connectors.*` keys) is product content, not the generic
  mechanism `@jini/ui`'s own `features/i18n` already ports. Replaced with
  plain English literals, matching how `constants.ts`/component defaults
  already work elsewhere in this package (e.g. `Toast.tsx`). A host wanting
  i18n wraps the rendered strings itself or forks the component text.
- `VisuallyHidden` (`@open-design/components`) — the single call site
  (a screen-reader-only `": "` separator in the alert list) was inlined as a
  local clip-rect style rather than standing up a new shared primitive for
  one use.
- `connectors-events.ts`'s cross-surface `CustomEvent` broadcast
  (`notifyConnectorsChanged`/`listenForConnectorsChanged`, used elsewhere in
  OD to refresh other tabs) — out of scope for this slice; replaced with a
  plain `onConnectorsChanged?: () => void` callback prop a host can wire to
  whatever cross-component signal it already has.
- `connectors-state.ts` was **not** ported as a file — `ConnectorsBrowser.tsx`
  only ever imported one function from it (`hasConnectorStatusChanges`,
  ported into `rules.ts`); its other exports (`mergeConnectorCatalog`,
  `fetchConnectorCatalogSnapshot`, an independently-diverged
  `applyConnectorStatuses`) belong to a different consumer (`EntryView.tsx`),
  not this canary.

### Phase 8.5 audit — what it caught

Ran the mandated audit (not just the "zero top-level functions" grep) across
every new file:

1. **Inline JSX callback props with real branching/multi-statement bodies**:
   found two 2-statement arrows in the orchestrator (`ProviderTabBar`'s
   `onSelect` combining an analytics callback + `setSelectedProvider`; the
   gate's `onClick` combining the same analytics callback + a host `onClick`)
   — extracted both into named `useCallback`s (`handleProviderTabSelect`,
   `handleGateClick`). A backdrop-click-to-close one-liner in
   `ConnectorDetailDrawer` (`if (e.target === e.currentTarget) onClose()`)
   was left inline — a single standard "click outside" DOM comparison, not
   business logic.
2. **`useMemo` bodies with multi-line derivations**: found one —
   `providerScopedConnectors`'s find-then-filter body in the orchestrator.
   Extracted to `rules.ts` as `scopeConnectorsToProvider` (now unit-tested in
   isolation); the orchestrator's `useMemo` is now a one-line call, matching
   the target end-state described in the audit instructions.
3. **Orphaned `useState`/`useRef`**: enumerated every one across all 18 new
   source files (listed by hand, not just grepped) — none found unassigned.
   The two state values that stayed in the orchestrator itself
   (`filter`, `selectedProvider`) are simple, single-owner UI state directly
   bound to one presentational component each; not extracted into their own
   hooks, on the judgment that doing so would be ceremony without payoff for
   a single string + a single pure derivation. Flagged here rather than
   silently decided, per the audit's own standard.

No other hidden logic found. `pnpm --filter @jini/ui run typecheck` was
re-run clean after each fix.

### Purity grep — reported explicitly per the task's own instructions

**Product-identity strings** (`Open Design`, `OD_`, `--od-stamp`,
`open-design.ai`, `openDesignDesktop`, `@open-design/`) across every new file
under `features/connectors/`: **clean, zero matches.**

**`window`/`document`/`fetch`/`EventSource`/`localStorage`/`sessionStorage`/
`XMLHttpRequest`/`WebSocket` used outside `dependencies.ts`**: one file, by
design — `components/ConnectorDetailDrawer.tsx` uses `document.addEventListener`
(Escape-to-close) and `document.body.style.overflow` (background-scroll
lock) directly in a `useEffect`. This is a disclosed, deliberate deviation
from the strict ADR-0002 "no DOM outside dependencies.ts" rule: these are
standard, unavoidable modal-a11y idioms (every modal component in any React
codebase does this inline), not business/transport logic smuggled past the
boundary, and routing them through a port would be pure ceremony for a
canary this scoped. `dependencies.ts` itself legitimately uses all of these
(that's its job). No other file in the feature touches any of them.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: green (zero errors), both before
  and after the Phase 8.5 fixes.
- `pnpm --filter @jini/ui exec vitest run src/features/connectors`: **144
  tests, 14 files, all green** — `rules.ts` (71, pure-function coverage of
  every merge/prune/score/sort/trust-check path), `dependencies.test.ts` (13,
  including the fake port's simulated latency and both real browser bridges'
  trusted-origin/visibility-gated firing), `useConnectorCatalog.test.ts` (5),
  `useConnectorAuthorization.test.ts` (11 — explicitly covers the
  pending/authenticated/stale-cancel OAuth handshake states: a successful
  connect with a redirect, a failed connect, ignoring a concurrent second
  action, the postMessage callback triggering a reload, window-refocus
  triggering reload **and** auto-cancelling a genuinely stale pending
  authorization while leaving a not-yet-expired one alone, interval polling
  start/continue, and pending-state persistence), `useConnectorDetail.test.ts`
  (7, including realistic two-page pagination), plus component tests for
  every presentational piece and a 6-test orchestrator smoke suite (load,
  locked-gate masking, search-empty-state, an end-to-end connect through the
  fake dependencies, provider-tab/search analytics callbacks, opening/closing
  the detail drawer). No coverage percentage was targeted — tests were
  written against actual state transitions and error paths per the task's
  own instruction, not to hit a number.
- Full monorepo `pnpm -r run typecheck` afterward: only pre-existing,
  unrelated failures in `packages/agent-runtime` and `packages/chat-react`
  (both stub packages missing a `tsconfig.json` entirely — not touched by
  this task).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending
  implementation during extraction)` — unchanged from before this task, no
  boundary violations introduced.

### Addendum: i18n wiring retrofit (2026-07-17)

The original canary session correctly declined to ship OD's own ~30 translated
`connectors.*` strings (product content), but incorrectly concluded from that
to drop the **i18n mechanism** entirely and hardcode plain English literals —
citing `Toast.tsx` as precedent for the same shortcut. That reasoning doesn't
hold: `@jini/ui`'s own `features/i18n` `useT()` hook is a zero-cost no-op when
unconfigured (`t(key)` returns `key` verbatim with no `I18nProvider` mounted),
so the convention is to use the English string itself as the key
(`t('Connect')`, not `t('connectors.connectLabel')`) — a component costs
nothing to make translatable and a host can localize it for free by mounting
`I18nProvider` with a dictionary keyed by that same English text. Every
component in this feature (`ConnectorsBrowser`, `ConnectorCard`,
`ConnectorDetailDrawer`, `ConnectorGrid`, `ConnectorSearchBar`,
`ProviderTabBar`, `ConnectorAlertList`) now routes its user-facing strings
through `useT()`; `rules.ts`'s `statusLabel()` stays a pure function (no
React) and callers wrap its return value (`t(statusLabel(status))`) instead.
Added a real end-to-end test (`ConnectorsBrowser.test.tsx`) mounting under
`I18nProvider` with a French dictionary to prove the wiring actually
localizes, not just that `t()` calls compile. 145 connectors tests now (was
144), all green.

Also caught and fixed while re-verifying: `types.ts`'s provenance comment
cited the vendored reference path literally (`integrations/open-design/...`),
which is a real, unfixed purity-guard leak the original session's "clean,
zero matches" self-report missed — reworded per the same convention
`@jini/deploy`'s source-map already documents. A pre-existing, unrelated
instance of the same pattern in `src/utils/visual-stability.ts`'s doc comment
was fixed at the same time.

### Addendum: independent review fixes (2026-07-17)

An independent second-opinion review (a different model, prompted to disprove the canary's own
"clean" self-report) confirmed the 3 correctness-neutral drops (category map, CDN slug logic,
CustomEvent) and the partial i18n fix above, then found 4 more real issues, all verified against
source and fixed:

1. **`formatToolsBadge()` was still unwrapped** at both its call sites (`ConnectorCard.tsx`,
   `ConnectorDetailDrawer.tsx`) — the i18n retrofit above missed it. Since its output bakes a count
   into the string (`"4 tools"`), wrapping the raw output in `t()` would need one dictionary entry
   per possible count — impractical. Added `toolsBadgeTranslation(count)` (returns a `{ key, vars }`
   pair; `formatToolsBadge` itself is unchanged, still tested, still used as the plain-string
   building block) and call `t(key, vars)` at both sites instead.
2. **`getDisplayableConnectorAccountLabel()` had a hardcoded `if (provider === 'composio') return
   undefined` branch** — the same class of provider-specific-logic-in-neutral-code bug as the
   category map and CDN slug, just missed in the first pass (the original has this exact branch
   with zero documented rationale). Stripped it — the function now always returns the label when
   present — and added a `getDisplayableAccountLabel` host-override prop on `ConnectorDetailDrawer`
   (threaded from `ConnectorsBrowserProps`, same shape as `getCategoryLabel`) so a host that
   legitimately wants to hide a specific provider's label can do so itself.
3. **The `toolsLimit`/`CONNECTOR_TOOL_PREVIEW_LIMIT` (50) option existed in `ports.ts`/`constants.ts`
   but was never passed** at the one hydration call site in `useConnectorDetail.ts` — a real bug, a
   host's `fetchConnectorDetail` could receive no limit at all and return an unbounded first page.
   Added a `toolsLimit` param to `useConnectorDetail`'s params (defaults to
   `CONNECTOR_TOOL_PREVIEW_LIMIT`), now actually passed on every `fetchConnectorDetail` call.
4. **Expired OAuth-pending entries from a prior session weren't pruned until the first poll
   interval fired** — `useConnectorAuthorization.ts`'s initial `useState` seeded directly from
   `authPendingStorage.load()` with no pruning. Checked the actual original
   (`ConnectorsBrowser.tsx:72-95`): `loadConnectorAuthorizationPending()` **does** call
   `pruneConnectorAuthorizationPending()` before returning — the port had silently dropped this.
   Fixed by wrapping the initial load with `pruneConnectorAuthorizationPending(..., Date.now())`.
   This changed real behavior a test had encoded: the "window refocus auto-cancels a stale pending
   authorization" test seeded an *already-expired* entry and asserted it survived until refocus —
   that setup can no longer work (it's now pruned on load, correctly). Rewrote it to seed an entry
   that's still valid at mount and goes stale a few milliseconds later (real timers + a short real
   delay, not `vi.useFakeTimers()` — fake timers don't play well with `waitFor`'s internal polling
   and leaked broken timer state into an unrelated test when tried), and added a new test asserting
   the load-time prune itself.

Two more "low" severity findings from the same review (swapping `dependencies` at runtime doesn't
refresh the catalog; removing the selected provider tab from `providerTabs` leaves none visibly
selected) were verified plausible but not fixed — genuine edge cases, lower impact, left for a host
to work around via `catalogRefreshKey`/controlled `providerTabs` state for now.

`packages/ui` test count: 375 (was 373 after the initial i18n fix omitted `formatToolsBadge`; net
+2 for `toolsLimit`-override and load-time-prune tests, +0 from the refocus-test rewrite since it
replaces the prior test 1:1).

### Honesty note — is this pattern ready to scale to the rest of the list?

Mostly yes, with two caveats worth flagging before dispatching the next
items in `docs/jini-port/god-components-extraction-plan.md` §1:

- **The plan doc under-specifies what needs generifying** — this is now the
  *second* time (after the i18n/utils task's `ExportDiagnosticsButton`/
  `enterpriseUrl.ts` finding) that reading a file in full surfaced
  product-specific logic the recon docs didn't call out (`ConnectorLogo`'s
  Composio-CDN slug construction here). A session working the next item
  should budget time to read every imported helper file, not just the god
  component itself, before trusting a plan doc's "what ships" list as
  complete.
- **The Phase 8.5 audit is genuinely necessary, not optional busywork** — it
  caught two real hidden-logic spots in a file this session wrote *itself*,
  written carefully the first time. That's the audit doing its job (per its
  own stated purpose: catching logic that "may just have never been
  extracted in the first place"), and a strong signal it should stay
  mandatory rather than get skipped as "probably fine" on faster future
  passes.

Everything else — the ports+dependencies+hooks+components+barrel shape, the
fake-double convention for `dependencies.ts`, folding a proven concurrency
hook (auth handshake) into one cohesive `useX` rather than over-fragmenting,
and testing state transitions directly rather than chasing a coverage
percentage — held up cleanly against a genuinely non-trivial 1,573-line
source file. The pattern is ready to scale; the two caveats above are
process reminders for the next session, not blockers.

---

## Section: three reusable hooks — useCoalescedCallback / useStableHandler /
useModalWindowDragGuard (2026-07-17)

Three files verified reusable (by direct reading) in
`integrations/open-design/reference/od-web-src.orig/`:

| Jini file | Origin | What changed |
|---|---|---|
| `src/hooks/useCoalescedCallback.ts` | `hooks/useCoalescedCallback.ts` | Near-verbatim (zero OD imports to begin with). Only the doc comment's specific provenance framing ("absorb chokidar write-then-rename... during an agent rewrite... See #2195") was reworded to describe the coalescing mechanism generically (e.g. absorbing a paired remove+add filesystem-watcher signal into one update) — logic and `CoalesceOptions`/timer semantics unchanged. |
| `src/hooks/useStableHandler.ts` | `lib/use-stable-handler.ts` | Verbatim. This is the hook `source-map.md`'s prior "Deferred, not a rejection" note (see the runtime/providers/state/lib/… sweep section above) flagged as generic but unported because this package had no React dependency wired up at the time — React is now a real dependency (added by the i18n/observability/utils and flat-group sections above), so it ships now with no further change needed. |
| `src/browser/useModalWindowDragGuard.ts` | `hooks/useModalWindowDragGuard.ts` | **Genericized.** The origin hardcoded `MODAL_WINDOW_DRAG_BACKDROP_SELECTOR`, a 13-entry OD-specific CSS selector list (`.new-project-modal-backdrop`, `.automation-modal-backdrop`, etc.), and `useModalWindowDragGuard()` took no arguments. Ported the mechanism only: `eventHitsModalWindowDragStrip(event, backdropSelector)` now takes the selector as a parameter instead of closing over the hardcoded list, and `useModalWindowDragGuard(options)` takes a required `backdropSelector` (string, comma-joinable for multiple classes) plus an optional `enabled` flag — no OD selector list shipped. `MODAL_WINDOW_DRAG_STRIP_HEIGHT` (56px) kept as-is, it's a generic constant, not OD-specific data. Filed in a new `src/browser/` directory (DOM-interaction helper category, alongside `utils/dom-subscriptions.ts`'s browser-event primitives) rather than `src/hooks/`, since it isn't a React-state hook so much as a document-level event-guard effect — consistent with how `dom-subscriptions.ts` already separates framework-free DOM wiring from stateful hooks in this package. |

### Tests

All three got real interaction/behavior tests (not smoke-only):
`useCoalescedCallback.test.ts` (fake timers: burst-coalescing into one
trailing call, quiet-window reset, `maxWait` forcing a mid-burst flush,
cleanup-on-unmount not calling a stale callback, always calling the latest
callback identity); `useStableHandler.test.ts` (stable identity across
re-renders, delegating to the latest committed handler rather than a stale
closure, argument/return-value forwarding); `useModalWindowDragGuard.test.ts`
(jsdom, real dispatched `MouseEvent`s: `eventHitsModalWindowDragStrip`'s
selector/height matching in isolation, a capture-phase `stopPropagation()`
on a drag-strip click on a matching backdrop actually prevents a
document-level bubble listener from firing, no `stopPropagation()` for a
click below the strip or on a non-matching element, `enabled: false`
disabling the guard, and listener cleanup on unmount).

### Neutrality check

`grep -rn "Open Design\|OD_\|od-\|open-design:\|data-od-"` across all three
new source files + their tests: clean, zero matches.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run test`: 391 tests, 56 files, all green (16 new
  tests across the three new files).
- `pnpm --filter @jini/ui run typecheck`: green.
- `pnpm guard` (repo root): `[guard] ok` — unchanged, no boundary violations.
- `pnpm -r run typecheck` (full monorepo): only the same pre-existing,
  unrelated failures in `packages/agent-runtime` and `packages/chat-react`
  (stub packages missing a `tsconfig.json` entirely) already noted by the
  connectors-canary section above — not touched by this task.
