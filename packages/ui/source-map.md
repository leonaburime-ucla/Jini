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

---

## Section: `features/browser-chrome/` — DesignBrowserPanel.tsx partial slice (2026-07-17)

Source: `integrations/open-design/reference/components-original/DesignBrowserPanel.tsx`
(3,654 lines). Per `docs/jini-port/god-components-extraction-plan.md`'s Section B row —
`features/browser-chrome/` (embeddable webview/iframe browser tab) — and r6 §1.12
("PARTIAL, larger yield than expected"): unlike the connectors canary, this is
explicitly **not** a full-file slice. Only the navigation-stack/address/history/
favicon primitives and the viewport switcher ship; the webview/iframe embedding
itself, brand-extraction, comment annotation, the AI browser-use tool catalog, and
the reference-board bookmark content all stay in OD.

### New layout (first feature in this package to use it)

Uses the 2026-07-17 `react/{hooks,components}/` layout decided in
`packages/ui/README.md` — `types.ts`/`constants.ts`/`rules.ts`/`ports.ts`/
`dependencies.ts`/`index.ts` at the feature root, `react/hooks/` and
`react/components/` for anything importing React. `features/connectors/` (the
structural reference this task read) still uses the old flat layout; this is the
first feature to adopt the new one.

### Viewport-controls overlap check (blocking preflight item)

`packages/ui/src/features/viewer-shell/` does not exist in this repo yet (only
`connectors`/`i18n`/`observability` were shipped at the time of this task), so per
the task's own fallback instruction the overlap was checked directly against
`FileViewer.tsx`'s `PreviewViewportControls` instead of a shipped `viewer-shell`
primitive. **Confirmed duplicate**, not just a suspected one: identical 3-preset
model (`desktop` null/null width/height, `tablet` 820×1180, `mobile` 390×844),
identical i18n keys in the origin (`fileViewer.viewport{Desktop,Tablet,Mobile}[Title]`
on both `BrowserViewportControls` and `PreviewViewportControls`), and an identical
dropdown-trigger + listbox interaction (pointerdown-outside/Escape-to-close, a
`role="listbox"`/`role="option"` menu, an active-check indicator). `FileVersionViewportControls`
(also in `FileViewer.tsx`) is a genuinely different UI shape (an inline toggle-button
group, not a dropdown) over the same preset data — not the same component, not folded
in here.

**Decision:** ship `BrowserViewportControls` here (this feature's consolidation-map
row explicitly names it), built generic (plain-English `label`/`title` strings wrapped
in `useT()` at render time, not baked-in `fileViewer.*` i18n keys, and an overridable
`presets` prop). **Whoever does `FileViewer.tsx`'s `PreviewViewportControls` next
should import `BrowserViewportControls` from this feature's barrel instead of building
a second copy** — the component and its `BROWSER_VIEWPORT_PRESETS` constant are
already fully generic and carry no OD-specific naming. If `FileViewer.tsx`'s dropdown
trigger turns out to need markup/behavior this component doesn't have once actually
read in full, that's a real signal to extend this one (add a prop), not to fork it.

### What shipped — `packages/ui/src/features/browser-chrome/`

| File | Contents |
|---|---|
| `types.ts` | `BrowserViewportId`/`BrowserViewportPreset`, `BrowserHistoryEntry`, `BrowserNavigationEntry`/`BrowserNavigationState`, `AddressDisplayParts`, `BrowserTabHandle` (generic bridge-handle shape — see below). |
| `constants.ts` | `EMPTY_URL`, `HISTORY_LIMIT` (80, verbatim), `HISTORY_SAVE_DEBOUNCE_MS` (140ms, verbatim), `DEFAULT_HISTORY_STORAGE_NAMESPACE`, `BROWSER_VIEWPORT_PRESETS` (plain-English labels, not i18n keys — see overlap section above), `DEFAULT_HOME_NAVIGATION_ENTRY`. |
| `rules.ts` | All pure logic, generified where noted below: `normalizeBrowserAddress`, `labelFromUrl`, `formatAddressDisplay(Parts)`, `hostnameFromUrl`, `faviconUrl`, `isHistoryUrl`, `sameUrl`, `isHistoryEntry`, `historyStorageKey`, `parseHistoryPayload`/`serializeHistoryPayload` (the JSON (de)serialization half of `loadHistory`/`saveHistory`, split from the `localStorage` access itself — see `dependencies.ts`), `mergeHistoryEntry` (the pure merge core of `commitHistory`), and the navigation-stack state machine: `initialNavigationState`, `recordNavigation`, `updateCurrentNavigationTitle`, `resolveNavigationHistoryDelta`, `canGoBack`/`canGoForward`. |
| `ports.ts` | `BrowserHistoryStoragePort` (`loadHistory`/`saveHistory`, keyed by a host-supplied scope key), `BrowserBridgeRegistrationPort` (`registerBrowserHandle` — the generic registration *mechanism* the task asked for; see below). |
| `dependencies.ts` | `createBrowserHistoryStorage` — a **real**, SSR-guarded `localStorage`-backed implementation (same reasoning as connectors' browser-only bridges: this only touches generic browser APIs, no backend-specific shape, so it ships real rather than faked). `createNoopBrowserBridgeRegistration` — the default no-op for the bridge-registration port. `createDefaultBrowserChromeDependencies` composes both. |
| `react/hooks/useBrowserHistory.ts` | Loads a scope's history on mount, debounce-persists on change (mirrors the origin's 140ms-debounced save effect verbatim), exposes `commitVisit`/`clearHistory`. |
| `react/hooks/useBrowserNavigationStack.ts` | Owns `navigationStack`/`navigationIndex`/`addressValue` state via the `rules.ts` state machine; exposes `recordNavigation`/`goBack`/`goForward`/`updateCurrentTitle`/`reset`. Fires the host's `onNavigate` port callback whenever the current entry actually changes (deduped against the last-notified entry, not on every render) — this is the "ports for `onNavigate`" piece of the consolidation-map row, implemented as a hook option rather than a `ports.ts` entry since it's a single plain callback, not a transport adapter (same judgment call the i18n feature's port-vs-callback section already documents). |
| `react/hooks/useBrowserBridgeRegistration.ts` | Registers/unregisters a `BrowserTabHandle` with the host's `BrowserBridgeRegistrationPort` keyed by a scope key, mirroring the origin's `registerBrandBrowser` effect's mount/unmount/dependency-change lifecycle exactly — this is the "ports for... brand-bridge registration" piece. |
| `react/components/BrowserViewportControls.tsx` | The viewport-preset switcher — see the overlap section above. |
| `index.ts` | Public barrel. |

### Genericized beyond a mechanical move

- **`registerBrandBrowser` → `BrowserBridgeRegistrationPort`**: the origin hardcodes
  a call to OD's own `registerBrandBrowser(projectId, browserTabId, handle)` (brand-
  extraction bridge). Per the task brief, only the registration *mechanism* is
  in scope — the port lets a host wire in whatever registration callback it wants;
  what a host registers the handle for is entirely its own business. The origin's
  handle shape (`BrandBrowserHandle`: `isDesktopWebview`, `getURL`,
  `executeJavaScript`, `downloadPageSnapshot`) is **not** ported verbatim —
  `downloadPageSnapshot` is OD's page-archive/brief-capture feature (explicitly
  out of scope), so `BrowserTabHandle` here only carries the three genuinely
  generic capabilities (`isEmbeddedSurfaceAvailable`, `getURL`,
  `executeJavaScript`), renamed from `isDesktopWebview` since "desktop webview
  vs. iframe" is an OD-specific distinction — the generic concept is just
  "is a live, script-executable surface available."
- **`normalizeBrowserAddress`'s absolute-path branch**: the origin has a hardcoded
  OD-specific route-prefix check (`/^\/(api|artifacts|frames)(\/|$)/`) that resolves
  matching paths against `window.location.origin` before falling back to a
  `file://` URL for any other absolute path. Both the prefix list and the
  `window.location.origin` read are OD-specific/DOM residue — genericized into an
  optional `{ appRoutePrefixes, appOrigin }` options bag a host supplies; omitted,
  the function always falls back to `file://` for absolute paths (a behavior
  change from the origin only for hosts that don't pass these options — flagged
  explicitly rather than silently dropped, per the task's own instruction on
  undisclosed gaps).
- **`historyStorageKey`**: the origin hardcodes `` `od:design-browser:${projectId}:history:v1` ``
  (an OD-branded prefix). Genericized to `historyStorageKey(namespace, scopeKey)`,
  with `DEFAULT_HISTORY_STORAGE_NAMESPACE = 'jini:browser-chrome:history'` as the
  default namespace and the scope key host-supplied (a project id, a tab id,
  whatever scope makes sense to the host) — this is the "renameable storage-key
  string" the consolidation map's row already called out as the only real residue.
- **Home-tab title**: the origin hardcodes `'Reference Board'` as the home
  navigation entry's title (tied to the out-of-scope `REFERENCE_GROUPS` bookmark
  content). Replaced with a generic, overridable `DEFAULT_HOME_NAVIGATION_ENTRY =
  { title: 'New Tab', url: EMPTY_URL }` (a `homeEntry` option on
  `useBrowserNavigationStack`/`initialNavigationState` lets a host supply its own).

### Explicitly out of scope (per the task brief) — not touched, not ported

- **`registerBrandBrowser`'s actual brand-extraction logic** — only the
  registration mechanism (the port above) ships; what OD does with a registered
  handle (re-reading the rendered DOM to re-extract a brand after an anti-bot
  wall) stays entirely in OD.
- **`BrowserCommentMarkers`/`BrowserCommentComposer`** (board-comment annotation
  overlaid on the live page) — OD-specific, not read in depth beyond confirming
  their line ranges (2646-2799) sit outside every in-scope piece.
- **The AI "browser-use" tool-action catalog** (`BROWSER_USE_CATEGORIES`,
  `BrowserUseMenu`, `browserUsePrompt`, the `PAGE_BRIEF_SCRIPT` page-archive/brief
  capture machinery) — OD's own AI-agent tooling, not touched.
- **`REFERENCE_GROUPS`** — the hardcoded design-inspiration bookmark catalog and
  `DesignBrowserStart`, the component that renders it — OD marketing/curation
  content, not touched.
- **Everything webview/iframe-embedding itself**: `WebviewElement`, the desktop-
  host `<webview>` vs. cross-origin `<iframe>` branching, `loadWebviewUrl`,
  `warmBrowserOrigin`'s `dns-prefetch`/`preconnect` resource hints,
  `canUseNativeHistoryNavigation`, the full `DesignBrowserPanel` orchestrator
  component itself — none of this is generic; a host renders its own webview/
  iframe surface and calls into this feature's hooks/rules to drive its address
  bar, history, and viewport chrome around that surface. The task's title says
  "embeddable webview/iframe browser tab **primitive**" deliberately, not a
  drop-in full browser-tab component — the consolidation-map row's own listed
  contents (nav stack, address normalization, history/favicon utilities, ports,
  the viewport switcher) confirm this narrower scope, and r6 §1.12 explicitly
  recommends "a real vertical slice for the browser-chrome core... not the
  full-file treatment."

### Deferred, not shipped this pass (judgment call, per the task's own "use judgment" instruction)

`BrowserUseMenu` and `BrowserInspectPanel` — the "ALSO NOTE" pair the task flagged
as shape-generic/OD-data (same class as the `byok/*` precedent: a searchable
grouped-action-menu shape and a color-picker/range-slider quick-CSS-editor shape,
both wrapping OD-specific catalog/snapshot data). Not included in this pass:

- `BrowserUseMenu`'s shape is only meaningful bound to *some* action catalog, and
  the one real catalog in the origin (`BROWSER_USE_CATEGORIES`) is the AI
  browser-use tooling explicitly out of scope above — shipping the shape alone
  with no real second consumer to validate the generic-catalog-prop design
  against risks guessing at an abstraction rather than deriving it from a second
  real use.
- `BrowserInspectPanel` is entangled with `BrowserStyleDraft`/`BrowserElementSnapshot`
  (OD's element-snapshot/quick-CSS-edit data model, defined in `FileViewer.tsx`'s
  `../types` and reused across both files) and the page-side `PAGE_BRIEF_SCRIPT`
  DOM-measurement machinery — pulling just the shape out cleanly would need a
  closer read of that cross-file type coupling than this task's primary scope
  (nav/address/history/viewport) budgeted for.

Left here rather than silently dropped: a follow-up task extracting either should
re-read r6 §1.12's full description of both before starting, since this session
did not do the closer read needed to generify them.

### Test/typecheck/guard/purity results

- `pnpm --filter @jini/ui run typecheck`: clean, zero errors.
- `pnpm --filter @jini/ui exec vitest run src/features/browser-chrome`: **73 tests,
  6 files, all green** — `rules.test.ts` (41, pure-function coverage of address
  normalization including the new `appRoutePrefixes`/`appOrigin` options, history
  merge/parse/serialize, and every navigation-stack transition: append, in-place
  update, adjacent back/forward rejoin, forward-history truncation, delta
  resolution at both stack ends), `dependencies.test.ts` (8, including the SSR
  guard with `window` deleted and a `localStorage.setItem` quota-failure
  simulation), `useBrowserHistory.test.ts` (5), `useBrowserNavigationStack.test.ts`
  (8, including the dedup-against-last-notified-entry behavior of the `onNavigate`
  callback), `useBrowserBridgeRegistration.test.ts` (4, register-on-mount/
  unregister-on-unmount/re-register-on-handle-or-scope-change), and
  `BrowserViewportControls.test.tsx` (7, including a French-dictionary
  `I18nProvider` mount proving the i18n wiring actually localizes, per the i18n
  policy).
- Full package suite (`pnpm --filter @jini/ui exec vitest run`): 448 tests, 59
  files, all green (was 375 before this task).
- Full monorepo `pnpm -r --no-bail run typecheck`: `packages/ui` reports `Done`
  (clean). 9 pre-existing, unrelated failures elsewhere (`packages/agent-runtime`,
  `packages/chat-react`, `packages/cli`, `packages/http`, `packages/node-host`,
  `packages/renderers-react`, `packages/sqlite`, `packages/daemon`,
  `packages/deploy`) — all missing a `tsconfig.json` entirely or importing
  `@jini/protocol`/`@jini/core` before those packages have a build output, none
  touched by this task. The connectors canary's own report only surfaced 2 of
  these (its `pnpm -r run typecheck` bailed at the first failure); this task's
  `--no-bail` run is a more complete picture of the same pre-existing gap, not a
  regression introduced here.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation
  during extraction)` — unchanged, no boundary violations introduced.
- Purity grep (`Open Design|OD_|--od-stamp|open-design\.ai|openDesignDesktop|@open-design/`)
  across every new file under `features/browser-chrome/`: clean, zero matches. A
  second, stricter pass for lowercase `od-` class prefixes and the vendored
  reference path cited literally in a comment (the two leaks the connectors
  canary's own retrospective flagged) is also clean.
- DOM-outside-`dependencies.ts` check: one disclosed, deliberate deviation —
  `react/components/BrowserViewportControls.tsx` uses `document.addEventListener`/
  `removeEventListener` directly inside a `useEffect` for outside-pointerdown/
  Escape-to-close. Same standard modal/menu a11y idiom already disclosed for
  `ConnectorDetailDrawer.tsx` in the connectors section above — not business/
  transport logic, not routed through a port.

### Cross-check against r6 §1.12's full description (per the task's explicit instruction)

r6 §1.12 lists, verbatim: "navigation stack, address-bar normalization,
history/favicon utilities (`loadHistory`/`saveHistory`/`normalizeBrowserAddress`/
`faviconUrl`, all pure string/URL/localStorage functions, only residue a
renameable storage-key string)" — all shipped, storage key genericized as
described above. "a responsive viewport-preset switcher (`BrowserViewportControls`)"
— shipped. Everything r6 names as staying OD-specific (brand-extraction bridge
registration's actual logic, `BrowserCommentMarkers`/`BrowserCommentComposer`,
the AI browser-use tool-action catalog, `REFERENCE_GROUPS`) is confirmed not
ported above. No gap between r6's description and what shipped was found on this
cross-check — the two deferred "ALSO NOTE" components are called out explicitly
above as a judgment-call deferral, not a silent drop.

### Post-merge audit pass (2026-07-17): a real bug fix, a dead-code removal, and 100% coverage

A follow-up audit re-diffed every in-scope piece above against the vendored
original function-by-function and found the port faithful — every
generification already listed in this section checked out against the
original's actual behavior. The audit did surface two real issues once
branch-coverage was wired up (`@vitest/coverage-v8`, run via a scoped CLI
include/exclude filter — `--coverage.include='src/features/browser-chrome/**'`
— rather than a shared `vitest.config.ts` change, so the rest of the package's
test config is untouched):

- **Real bug, fixed** — `rules.ts`'s `recordNavigation` hardcoded
  `DEFAULT_HOME_NAVIGATION_ENTRY.title` ("New Tab") for a navigation to
  `EMPTY_URL`, ignoring a caller-supplied `options.homeLabel`. Since
  `useBrowserNavigationStack` passes `homeLabel: homeEntry.title` on every
  call, a host configuring a custom `homeEntry` would see any navigation back
  to the home url silently retitle itself to the generic default instead of
  the host's own label — a regression relative to `initialNavigationState`/
  `labelFromUrl`, which both already honored a custom home label correctly.
  Fixed to `options.homeLabel ?? DEFAULT_HOME_NAVIGATION_ENTRY.title`; covered
  by new `rules.test.ts`/`useBrowserNavigationStack.test.ts` cases.
- **Dead code, removed** — `MergeHistoryEntryOptions.homeLabel` (threaded
  through `mergeHistoryEntry` → `useBrowserHistory`'s `commitVisit`) could
  never actually affect anything: `mergeHistoryEntry` only calls
  `labelFromUrl` after its own `isHistoryUrl(url)` guard has already excluded
  `EMPTY_URL`, and `homeLabel` only changes `labelFromUrl`'s output on the
  `url === EMPTY_URL` branch. Removed the field from `MergeHistoryEntryOptions`
  and `UseBrowserHistoryOptions` rather than leaving a permanently-uncovered,
  inert option in the public API.
- **One line excluded from coverage, not faked** —
  `useBrowserNavigationStack.ts`'s `if (!currentEntry) return;` guard inside
  the `onNavigate`-firing effect was unreachable through the hook's public
  API: every state transition it performs (`initialNavigationState`/
  `recordNavigation`/`resolveNavigationHistoryDelta`/
  `updateCurrentNavigationTitle`, all in `rules.ts`) preserves
  `0 <= navigationIndex < navigationStack.length`, so `currentEntry` is always
  defined in practice — the guard existed only because
  `noUncheckedIndexedAccess` types the array-index read as possibly-undefined.
  **Correction (2026-07-17, per the vendored `fixing-open-design-web` SKILL.md's
  Phase 9.5 classification #4 — "TS-required fallback with no real runtime
  path"):** an initial pass marked this with `/* v8 ignore next */`, which
  that skill's rule explicitly forbids ("never a valid outcome... under any
  classification"). Fixed to the classification's actual prescription: the
  `if` branch is deleted and the index read is a non-null assertion
  (`state.navigationStack[state.navigationIndex]!`) with a one-line comment
  explaining the invariant — no suppression comment anywhere in this feature.
- **`ports.ts`/`types.ts` excluded from coverage** — both are
  `export interface`/`export type` only; verified via the package's own
  esbuild transform that they compile to zero emitted statements, so
  v8/istanbul has no executable line to measure (reports 0/0 as 0%, not N/A).
  Excluded via `--coverage.exclude`, documented inline at the top of each
  file. `index.ts` (the barrel) is NOT excluded — it has real re-export
  statements that execute on import, and nothing else in the suite imported
  the barrel directly, so a small `index.test.ts` smoke test was added instead
  (also catches a typo'd/missing re-export a concrete-module test wouldn't).

Also closed several genuine (non-dead) branch-coverage gaps with targeted
tests rather than exclusions: `recordNavigation`'s adjacent-entry rejoin and
`replacePendingTarget` branches (the back/forward state-machine logic
faithfully ported from the origin, previously untested); `recordNavigation`/
`updateCurrentNavigationTitle` given an out-of-bounds `navigationIndex` (both
are exported pure functions, so a malformed `BrowserNavigationState` is a
legitimately reachable input, not hook-internal dead code); `faviconUrl`'s
catch branch (`https://` with no host); `labelFromUrl`'s empty-hostname
fallback (`file://` urls); `cleanIconUrl`'s `data:image/` branch; the
`onNavigate` dedup-by-content check (a re-recorded identical url+title still
produces a new object reference via `updateEntry`, so the effect re-runs and
must dedupe on content, not just skip via unchanged reference);
`BrowserViewportControls`'s custom-`presets`-with-no-match and empty-`presets`
branches; and `createDefaultBrowserChromeDependencies`'s `historyLimit`-only
option combination.

**Result**: feature-aggregate coverage on the executable-code portion (i.e.
excluding `ports.ts`/`types.ts` per above) is **100% Lines, 100% Branches,
100% Functions, 100% Statements** — up from 99.15% / 87.77% / 97.56% / 99.15%
before this pass. Full suite: 101 tests across 7 files for this feature (up
from 78), 476 tests across 60 files package-wide (up from 453).
`pnpm --filter @jini/ui run typecheck` and `pnpm guard` both remain clean.

### Second follow-up pass (2026-07-17): `useX`/`useWiredX` wiring pairs, toolbox merge

Two retrofits landed on this branch after the audit pass above:

**`useWiredX` wirers.** Per the now-required `useX(port)` / zero-arg
`useWiredX()` pattern (see `apps/web/src/features/memory/hooks/
useMemoryConfig.hooks.ts` on the OD repo's `refactor/web-memory-slice` for
the reference shape), audited every hook in this feature against
`ports.ts`/`dependencies.ts` to see which actually take an injected port:

- `useBrowserHistory` (takes `{ historyStorage: BrowserHistoryStoragePort }`)
  — got `useWiredBrowserHistory(scopeKey, options?)`, binding a module-level
  `createBrowserHistoryStorage()` singleton (the real, SSR-guarded
  `localStorage`-backed implementation — a meaningful production default).
- `useBrowserBridgeRegistration` (takes `{ bridgeRegistration:
  BrowserBridgeRegistrationPort }`) — got `useWiredBrowserBridgeRegistration
  (scopeKey, handle)`, binding `createNoopBrowserBridgeRegistration()`.
  Unlike the history port, there's no generic "real" default here by design
  (see `ports.ts`'s doc comment) — registering a handle only means something
  in the context of a host's own external bridge. A host that wants real
  bridge registration keeps calling `useBrowserBridgeRegistration` directly
  with its own port, same carve-out as a swappable test port, just for a
  real host implementation instead of a fake.
- `useBrowserNavigationStack` — **no wirer added.** Its `options` (`initialUrl`/
  `initialTitle`/`homeEntry`/`onNavigate`) are all plain local config, not a
  `ports.ts` port; the hook owns its state entirely via `rules.ts`'s pure
  functions. Nothing to wire.

Both wirers exported from `index.ts`; no internal call sites needed updating
— this feature has no top-level assembling component (that lives in the
consuming host, out of scope per this feature's own "OUT OF SCOPE" section
above), so `useBrowserHistory`/`useBrowserBridgeRegistration` had zero
in-package callers before or after.

**Toolbox merge.** Merged local branch `feat/ui-browser-toolbox` (commit
`c3e7f21`, not pushed to origin) — a clean merge, no conflicts (it branched
off a commit before `features/browser-chrome/` existed, so it never touched
this feature's files). It adds `packages/ui/src/browser/` (`useDismissOnOutsideOrEscape`,
`useGlobalKeydown`) as a thin wrapper over `utils/dom-subscriptions.ts`'s
`subscribeOutsideClickOrEscape`. `BrowserViewportControls.tsx`'s hand-rolled
`document.addEventListener('pointerdown'/'keydown', ...)` pair (the one
disclosed DOM-outside-`dependencies.ts` deviation noted earlier in this
section) is now `useDismissOnOutsideOrEscape(() => setOpen(false), { enabled:
open, containerRef: menuRef })` — same `pointerdown`-outside-or-Escape
behavior, dead local listener code removed. All of `BrowserViewportControls.test.tsx`'s
existing outside-click/Escape assertions pass unchanged against the shared
hook, confirming no behavior change.

**Result**: still 100% Lines/Branches/Functions/Statements on the
executable-code portion after both retrofits (wirers came with their own
tests; the toolbox swap needed none new since it's a drop-in behind the same
public component API). 103 tests across 7 files for this feature; 494 tests
across 62 files package-wide (the toolbox branch's own `useDismissOnOutsideOrEscape.test.ts`/
`useGlobalKeydown.test.ts` account for the rest of the file-count jump).
`pnpm --filter @jini/ui run typecheck` and `pnpm guard` both remain clean.

---

## Section: `features/sketch-editor/` — SketchEditor.tsx's Excalidraw shim (2026-07-17)

Source: `integrations/open-design/reference/components-original/SketchEditor.tsx`
(1,088 lines) + the two pure helpers it imported (`sketch-model.ts`'s
`sanitizeExcalidrawAppState`/`emptySketchScene`/`sketchSceneHasContent`,
`sketch-colors.ts`'s theme-aware default stroke color). Per
`docs/jini-port/god-components-extraction-plan.md`'s Consolidation map §B row
and `docs/jini-port/recon/r6-god-component-internals.md` §1.22: "near-FULL
SLICE — strongest find among the small files," ~60-70% of the file is a
reusable Excalidraw-integration shim. Target was `packages/ui/src/features/sketch-editor/`
rather than `@jini/renderers-react` — that package's README/source-map didn't
exist yet on `main` when this task read them (its only real content lives in
an unmerged draft PR, #2, `port/annotation-canvas`), so it had no established
natural home to fold into per the map's own fallback rule.

This is the first task in this list to use the **new** `react/` layout
(decided 2026-07-17): `types.ts`/`constants.ts`/`rules.ts`/`dom.ts`/`ports.ts`/
`dependencies.ts`/`index.ts` stay at the feature's top level; `hooks/`/
`components/` move under `react/`. It's also the first `@jini/ui` feature to
take a real third-party UI-library dependency (`@excalidraw/excalidraw@0.18.1`,
matching the version named in this session's own architecture debate
transcripts) rather than binding only to browser/DOM primitives.

### What shipped

| File | Contents |
|---|---|
| `types.ts` | Generic `SketchScene` (elements/appState/files — the OD legacy `SketchItem`/`legacyItems` shape is dropped entirely), `SketchSceneChangeOptions`, `SketchExportImageResult(Result)`, `SketchToastState`, `SketchTooltipLabelKey(s)`, `SketchTooltipTarget`, `SketchDomTextOverrides` (a plain `{ english: translated }` table — the generic mechanism only), `SketchTranslate`. |
| `constants.ts` | `SAVED_VISIBLE_MS`, `EXPORTED_IMAGE_MIME_TYPE`, `SKETCH_CONTEXT_MENU_MARGIN`, `DEFAULT_SKETCH_TOOLTIP_TARGETS` (Excalidraw's own toolbar `data-testid`s), `DEFAULT_CONTEXT_MENU_ACTION_ORDER`/`DEFAULT_CONTEXT_MENU_RECOGNIZED_ACTIONS` (Excalidraw's own action-id vocabulary), `DEFAULT_EXCALIDRAW_LANG_CODES` (locale → the string Excalidraw itself expects for `langCode`), `SKETCH_TEXT_OVERRIDE_ATTRS`, `DEFAULT_SKETCH_LIGHT_TOOL_COLOR`/`DEFAULT_SKETCH_DARK_TOOL_COLOR`. |
| `rules.ts` | Every pure function ported 1:1 or genericized: `sanitizeExcalidrawAppState`/`emptySketchScene`/`sketchSceneHasContent` (ported from `sketch-model.ts` — generic Excalidraw scene helpers that happened to live alongside OD's legacy-format code, not legacy-format code themselves), `buildInitialData`/`sceneFromExcalidraw` (legacy-item conversion dropped), `sceneContentSignature`/`isNonDeletedExcalidrawElement` (the dirty-dedupe engine), `exportedImageFileName`/`exportedImageResultFileName` (genericized: takes an optional `sourceExtension` instead of hardcoding `.sketch.json`), `resolveDefaultSketchToolColor` (ported from `sketch-colors.ts`), `defaultExcalidrawLangCode`, `normalizeTooltipLabel`, `buildSketchTooltipLabels` (the `t()`-wiring point for tooltip text), `translateDomTextValue`/`orderContextMenuActions` (pure halves of the DOM toolkit), `validateSketchEmbeddableUrl`, `isExcalidrawUnableToEmbedToast` (genericized — see "Generification findings" below). |
| `dom.ts` | The DOM-manipulation toolkit, kept separate from `rules.ts` since it touches `document`/`window` directly (by design — see "ADR-0002 DOM boundary" note below): `readExcalidrawTheme`/`readDefaultSketchToolColor`, `applySketchEditorTooltips`, `applySketchContextMenuSimplification`/`clampSketchContextPopover`, `applySketchDomTextOverrides` (generic version of the old i18n-override walker), `rewriteExcalidrawUnableToEmbedToasts`, `enhanceSketchExcalidrawPortals`/`removeSketchMermaidShortcutHints`/`findSketchMermaidInsertButton`/`handleSketchPortalCommandEnter`. |
| `ports.ts` | `SketchEditorEnginePort` — the one real "swap point": `Excalidraw` (the component), `MainMenu` (+ `Item`/`Separator`/`DefaultItems` sub-shape), `exportToBlob`. `convertToExcalidrawElements` was **not** ported into the port — its only call site in the original file was the legacy-item converter, which is dropped entirely, so the generic shim never needs it. |
| `dependencies.ts` | `realSketchEditorEngine`/`defaultSketchEditorDependencies` — binds the real `@excalidraw/excalidraw` package. Zero React import, per convention. |
| `react/dependencies-fake.tsx` | `createFakeSketchEditorEngine`/`createFakeSketchEditorDependencies` — a lightweight non-canvas React stand-in for Excalidraw (matching toolbar `data-testid`s, a menu-trigger, a `renderTopRightUI` slot, and `children`/MainMenu rendering), used by every test in this feature. **Deliberately lives under `react/`, not at the top-level `dependencies.ts`** — the thing being faked is itself a React component, so unlike every other port in this package, its fake unavoidably needs JSX. Documented inline as a disclosed exception to the "dependencies.ts has zero React import" convention. |
| `react/hooks/useSketchTheme.ts` | Theme MutationObserver + `prefers-color-scheme` tracking. |
| `react/hooks/useSketchScene.ts` | Excalidraw imperative-API ref, reset-on-clear instance key, initial-data memoization, and the content-signature-deduped change/save/clear plumbing. |
| `react/hooks/useSketchSaveWorkflow.ts` | Save/export orchestration, the transient "Saved" indicator timer, and the single toast slot (save success, export success+action, export failure). |
| `react/hooks/useSketchDomEnhancements.ts` | Wires the MutationObserver-driven DOM-enhancement effect (tooltips, context-menu simplification, DOM text overrides, toast rewriting, portal/modal enhancement) using `dom.ts`'s pure-ish functions. |
| `react/components/SketchMainMenu.tsx` | Dumb component composing the engine's `MainMenu`/`Item`/`Separator`/`DefaultItems`. |
| `react/components/SketchSaveStateBadge.tsx` | Dumb component for the `renderTopRightUI` save-state indicator. |
| `react/components/SketchEditor.tsx` | The orchestrator — composes the 4 hooks + engine + `Toast`, matching the deps-bag/hook-composition shape already proven by `features/connectors`. |
| `index.ts` | Public barrel. |

### Dropped (OD-specific residue, per the god-components-extraction-plan's own framing for this row)

- **Legacy sketch-item migration** (`convertLegacySketchItemsToExcalidrawElements`, the `SketchItem`/`legacyItems`/`hasPreservedRawItems` props) — the source product's pre-Excalidraw hand-rolled freehand/rect/arrow/text format and its one-time upgrade path. No generic Excalidraw-embedding host needs this; a host still migrating off a legacy format converts before handing this component its initial `SketchScene`.
- **The `.sketch.json` file-naming convention** — `exportedImageFileName` no longer hardcodes stripping `.sketch.json`; it takes an optional `sourceExtension` and otherwise strips whatever single extension is present.
- **The source product's own i18n hook and locale-override tables** (`ZH_CN_SKETCH_TEXT_OVERRIDES`/`ZH_TW_SKETCH_TEXT_OVERRIDES`, ~60 translated Excalidraw-UI-string entries) — real translated copy, not a mechanism. The *mechanism* (a locale-keyed English→translated table applied by walking Excalidraw's own rendered DOM) is kept as `SketchDomTextOverrides`, host-supplied, defaulting to no overrides.
- **`od-*` CSS class names** (`od-tooltip`, `od-sketch-context-menu`, `od-sketch-context-popover`, `od-sketch-modal`, `od-sketch-help-modal`, `od-sketch-dialog-close`, `od-embed-toast-rewritten`) — renamed `jini-tooltip`/`jini-sketch-*`, same rationale as the `Toast`/`TooltipLayer` renames earlier in this file. `jini-tooltip` specifically now drives this package's own shipped `TooltipLayer.tsx` contract (`.jini-tooltip[data-tooltip]`), a real (if incidental) integration rather than just a rename.
- **`sketch-model.ts`'s `OPEN_DESIGN_EXCALIDRAW_SOURCE` marketing-domain string** and the rest of that file's legacy-format types (`SketchDocument`, `SketchItem` union, `parseSketchDocument`/`buildSketchDocument`/`computeSketchBounds`/`isSketchJsonFileName`) — not ported; `SketchEditor.tsx` itself never called these, only the three generic scene helpers noted above.

### Generification findings beyond the plan doc's own notes

Consistent with this list's honesty note above (the plan doc reliably under-specifies what needs generifying once a file is actually read), two things surfaced only on a close read:

1. **`isExcalidrawUnableToEmbedToast`'s detection heuristic was itself coupled to the source product's translations** — the original hardcodes `message.includes('目前不允许嵌入此网址')`/`'目前不允許嵌入此網址'` (the exact Chinese strings from the dropped override tables) as part of *detecting* Excalidraw's own "can't embed this URL" toast, not just displaying it. Since the translated-copy tables are dropped, this detection would have silently stopped recognizing the toast in any non-English locale. Genericized to `isExcalidrawUnableToEmbedToast(message, additionalPhrases?)` — English detection ships by default; a host that has translated the toast via its own `domTextOverrides` passes that same translated phrase back in as `additionalPhrases` so detection stays in sync with whatever it chose to translate.
2. **The Mermaid-dialog "Close" button's label** originally pulled from the same dropped override table (`sketchTextOverrides(locale)?.Close ?? 'Close'`) even though this button is one *this component itself creates and injects* into Excalidraw's portal (not text belonging to Excalidraw's own baked-in UI). Routed through this feature's own `useT()` (`t('Close')`) instead — a real i18n integration via `@jini/ui`'s own mechanism, not a DOM-text-override case at all.

### ADR-0002 DOM boundary — a disclosed, deliberate deviation

Per the vertical-slice discipline, `features/**` files shouldn't touch `document`/`window` outside `dependencies.ts`. This feature is a legitimate, disclosed exception at a different scale than the connectors canary's one inline `document.addEventListener` (a standard modal-a11y idiom): `dom.ts`'s entire ~250-line toolkit *is* direct DOM manipulation of a mounted third-party library's own rendered output — that's this feature's whole purpose (embedding a library with "no hooks for any of this," per r6 §1.22), not business/transport logic smuggled past a boundary meant to keep transport swappable. The one thing that *is* swappable — the Excalidraw engine itself — is properly bound through `ports.ts`/`dependencies.ts`, same as every other feature in this package.

### i18n

Every user-facing string in the shipped component is routed through `useT()`
with the English string as the key (tooltip labels via `buildSketchTooltipLabels`,
the save-state badge, the `MainMenu` items, toast messages, the injected
Mermaid-dialog close button). Verified end-to-end: `SketchEditor.test.tsx`
mounts under `I18nProvider` with a French dictionary and asserts the
`MainMenu`'s Save/Clear-canvas text renders translated, not just that `t()`
calls compile.

### Phase 8.5 audit

Ran the mandated audit across every new file: no inline JSX callback with
real branching/multiple setters (the `renderTopRightUI`/`onSave`/`onExportImage`
arrows are all single-expression); no `useMemo`/`useEffect` body containing
unextracted multi-line derivation (`excalidrawUIOptions` is a static literal;
`tooltipLabels` is a one-line call into `rules.ts`; the DOM-enhancement effect
and the scene/save-workflow hooks' effects are the feature's own intended
DOM-registration/orchestration logic, already delegating their actual pure
computation to `rules.ts`/`dom.ts`); every `useState`/`useRef` across all 4
hooks and the orchestrator enumerated by hand and accounted for (none
orphaned).

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: clean, zero errors.
- `pnpm --filter @jini/ui exec vitest run src/features/sketch-editor`: **109
  tests, 10 files, all green** — `rules.test.ts` (40), `dom.test.ts` (22, DOM-
  fixture tests for every tooltip/context-menu/text-override/toast-rewrite/
  portal function), `dependencies.test.ts` (2, asserting the real engine binds
  correctly), `react/hooks/*.test.ts(x)` (25, incl. the theme observer, the
  scene hook's hydration-skip/dedupe/clear/close-dialog behavior, and the
  save-workflow's save/export/error/toast-action paths), `react/components/*.test.tsx`
  (20, incl. the full orchestrator wired against the fake engine and the
  I18nProvider end-to-end mount).
- Full package `pnpm --filter @jini/ui exec vitest run`: **484 tests, 63
  files, all green** (was 375 before this task).
- `pnpm -r --no-bail --if-present run typecheck`: `packages/ui typecheck: Done`
  (clean); remaining failures are the same pre-existing, unrelated set every
  prior task in this file has reported (`agent-runtime`/`chat-react`/`cli`/
  `http`/`node-host`/`renderers-react`/`sqlite` missing `tsconfig.json`;
  `daemon`/`deploy` needing `@jini/protocol`/`@jini/core` built first) — none
  touched by this task.
- `pnpm guard`: `[guard] ok (skeleton — rules pending implementation during
  extraction)`.
- Purity grep (`Open Design`/`OD_`/`--od-stamp`/`open-design.ai`/
  `openDesignDesktop`/`@open-design/`, plus the stricter lowercase `od-`
  prefix pass and a check for the vendored-reference-path-in-comment mistake):
  **6 hits found and fixed** — all were explanatory doc-comment mentions of
  "Open Design" as provenance context (e.g. "that migration path is a host
  (Open Design) concern"), not runtime strings, but per this file's own
  connectors-canary precedent (a provenance comment citing a vendored path
  literally was treated as a real leak, not a false positive) these were
  reworded to "host-product"/"the source product" instead. Clean after.

### Environment finding worth flagging for future `@excalidraw/excalidraw`-adjacent work

Getting real component tests running against this dependency required two
non-obvious environment fixes, recorded here since they'll recur for any
future task touching `@excalidraw/excalidraw` (e.g. if `@jini/renderers-react`'s
own annotation-canvas work ever needs to render real Excalidraw rather than
its own canvas primitives):

1. **`@excalidraw/excalidraw`'s dev bundle ships extensionless deep imports**
   (`roughjs/bin/rough`, no `.js`) that assume a bundler's resolver. Vitest's
   default SSR path hands externalized deps straight to Node's own loader,
   which requires exact extensions and fails. Fixed via
   `vitest.config.ts`'s `test.server.deps.inline: [/@excalidraw\/excalidraw/, /roughjs/]`,
   routing it through Vite's transform pipeline instead.
2. **The bundle also runs an unconditional module-load-time canvas-capability
   probe** (`"filter" in document.createElement("canvas").getContext("2d")`)
   that throws under jsdom's real (unimplemented) `getContext` — crashing the
   *import* itself, before any test body runs, even for tests that never
   render real Excalidraw. The obvious fix (add the native `canvas` npm
   package so jsdom has real `getContext` support) was attempted and reverted:
   the package installed but its native addon's build script requires system
   Cairo/Pango libraries and a build toolchain not available in this sandbox,
   and pulling in a heavy native addon as a devDependency for one package's
   tests felt like the wrong tradeoff even where it does work (fragile across
   environments, not a "lean engine" fit). Fixed instead with a minimal
   `HTMLCanvasElement.prototype.getContext` stub in `vitest.setup.ts` (a fake
   2D context object, no real drawing) — sufficient because every test in
   this feature always renders the package's own fake engine, never real
   `<Excalidraw>`; the stub exists only so importing the real binding (for
   `dependencies.test.ts`'s shape assertions, and because the orchestrator's
   default-prop import of `dependencies.ts` is eager regardless of which
   `dependencies` a given render actually uses) doesn't crash the module
   graph. Documented inline in `vitest.setup.ts` as a deliberate, narrow shim,
   not a real canvas polyfill.
3. Also confirmed (via `pnpm install`, not a blocker): `@excalidraw/excalidraw@0.18.1`'s
   own `@radix-ui/*` transitive dependencies declare a `react@"^16.8 || ^17.0 || ^18.0"`
   peer range, unmet by this package's `react@^19.2.0` — a peer-dependency
   warning only, install and every test above succeeded regardless, but worth
   flagging for whoever next upgrades React in this package.

---

## Section: `features/asset-grid/` — LibrarySection.tsx redo (2026-07-17)

Source: `integrations/open-design/reference/components-original/LibrarySection.tsx`
(1,401 lines), read in full. Per `docs/jini-port/god-components-extraction-plan.md`'s
Consolidation map (section B, "Own feature"): `features/asset-grid/` (generic
`AssetGrid<TAsset>`) ← `LibrarySection.tsx` — "rubber-band multi-select (the
single cleanest generic core in the whole sweep, per §1.16), facets,
debounced search, SSE live-merge, day-bucketed grouping, kind-dispatch
thumbnails." Per r6 §1.16, this is "the second-strongest candidate after
`ConnectorsBrowser.tsx`."

**This is a from-scratch redo, not a continuation.** A prior attempt at this
target was never merged: its own draft source-map.md said "product actions
(delete/…) were host-owned via callbacks" but then shipped no
`onDeleteSelected` callback prop at all, and it silently dropped the
grid/timeline view-mode toggle without disclosing the gap. Neither of the
prior attempt's files exist in this checkout — there was nothing to diff
against or build on; this section describes a clean-room port.

This is also the first `features/<domain>/` slice built under the **new**
layout decided 2026-07-17 (see `packages/ui/README.md`): `types.ts`/
`constants.ts`/`rules.ts`/`ports.ts`/`dependencies.ts`/`index.ts` at the
feature's top level; `react/hooks/` and `react/components/` hold every file
that imports React. `features/connectors/` (the only other shipped feature
at the time) still uses the old flat layout and was read only for its
internal ports+dependencies+hooks+components+barrel discipline, not its
exact paths. `features/progress-card/`, named as a second structural
reference in this task's own dispatch prompt, **does not exist in this
checkout** — despite `docs/jini-port/god-components-extraction-plan.md` and
`packages/ui/README.md` both describing it as "✅ landed, PR #1." Flagging
this discrepancy rather than silently working around it; `features/connectors/`
alone was sufficient as the structural precedent.

### What shipped — `packages/ui/src/features/asset-grid/`

| File | Contents |
|---|---|
| `types.ts` | Generic `AssetGridItem` (`{id: string}` constraint), `AssetGridFacetOption`, `AssetGridQuery`, `AssetGridViewMode`, `AssetGridSelectors<TAsset>` (the host-injectable field-reader seam: `getKind`/`getSource`/`getTimestamp`/`getDayKey`/`getTitle`/`getSubtitle`/`matchesKindFilter`/`mapKindToQuery`), plus the 100%-generic `CardRect`/`Band`/`AssetGridDayGroup<TAsset>` shapes ported verbatim from the original's own `CardRect`/`Band` interfaces. |
| `constants.ts` | `ASSET_ID_ATTR`/`ASSET_ID_SELECTOR` (the rubber-band hit-tester's DOM attribute, generified from the original's two-attribute `data-asset-card`/`data-asset-id` scheme into one `data-asset-grid-id` attribute that both selects and identifies a card), debounce/coalesce defaults, `ALL_FACET_VALUE`. |
| `rules.ts` | All pure logic, ported 1:1 in behavior: `localDayKey`/`dayKeyFromTimestamp`/`dayHeadingResult`/`dayHeading`/`groupByDay` (day bucketing — `dayHeadingResult` added beyond the original to separate the translatable "Today"/"Yesterday" labels from a locale-formatted date string, which isn't a sensible i18n key); `snapshotCardRects`/`cardIdsInBand` (the rubber-band core, verbatim geometry); `toggleSelection`/`rangeSelection`/`selectAllIds`/`pruneMissingSelection`; `mergeIngestedAssets`/`parseLiveUpdateAssetId` (the SSE merge core, verbatim reconciliation logic, generified id-field name); `buildAssetGridQuery`/`defaultMatchesKindFilter`/`filterByKind` (the query-building + client-side kind-narrowing pair, generified — see the "element vs image" note below); `resolvePreviewClickAction`/`resolveCheckboxClickAction` (new — extracted from what would otherwise be branching inline JSX handlers, per the Phase 8.5 audit); `buildFacetLabelMap`/`resolveFacetLabel` (new — same audit, extracted from an inline `Map` construction in a `useMemo`); `isTypingTarget` (keyboard-shortcut typing-target gate). |
| `ports.ts` | `AssetGridDataPort<TAsset>` (`fetchAssets`/`fetchAssetById`), `AssetGridLiveUpdatesPort` (`subscribe` with ingest/delete/full-reload handlers), `AssetGridDependencies<TAsset>`. Deliberately **no delete method on any port** — see the bulk-delete manifest row (g) below for why. |
| `dependencies.ts` | `createFakeAssetGridDataPort` — an in-memory test/demo double (the data transport is genuinely host-specific, matching the canary's own "ship a fake, not a real transport" precedent). `createBrowserSseLiveUpdatesPort` — a **real**, SSR-guarded `EventSource`-backed implementation, shipped for real (not faked) because `EventSource` is a generic browser API with no backend-specific shape beyond a URL and two event names — same reasoning the connectors canary used to justify shipping real `sessionStorage`/`postMessage` bridges instead of fakes. |
| `react/hooks/useAssetGridData.ts` | Fetch-on-`{active, query}`-change + client-side kind-narrowing pass. Selector functions (`getKind`/`matchesKindFilter`/`mapKindToQuery`) are ref-bridged rather than direct `useCallback` deps, since a host is not guaranteed to pass referentially-stable selectors — an early version of this hook without the ref bridge produced a real "Maximum update depth exceeded" render loop in its own test suite, caught and fixed before this landed (see the hook's own doc comment). |
| `react/hooks/useAssetGridLiveUpdates.ts` | The SSE reconciliation core, ported behavior-for-behavior from the original's coalescing `flush()`/`schedule()` effect: deletes apply for free, filtered views or ids-with-no-cheap-fetch fall back to a full reload, a burst of ingest events is coalesced over one window and resolved via `Promise.all` + `mergeIngestedAssets`. Kept as one cohesive hook (not split further) per the Phase 6 "one natural owning cluster" guidance the connectors canary also followed for its OAuth-handshake hook. |
| `react/hooks/useAssetGridSelection.ts` | `selectedIds` state + shift-range anchor + toggle/range/selectAll/clear + the "prune ids that disappeared after a reload" effect. |
| `react/hooks/useRubberBandDrag.ts` | The rubber-band mouse-drag effect itself (rAF-throttled apply, scroll re-snapshot, empty-click-clears-selection, additive-drag-preserves-base-selection) — wired around the pure `snapshotCardRects`/`cardIdsInBand` core in `rules.ts`. This split (pure geometry in `rules.ts`, DOM/event wiring in its own hook) is what "the cleanest generic core in the whole sweep" (r6 §1.16) actually looks like ported: the core itself needed zero changes beyond a rename, only the wiring around it needed a home. |
| `react/hooks/useAssetGridKeyboardShortcuts.ts` | Cmd/Ctrl+A / Escape / Delete-Backspace, gated by `enabled` (a host-owned modal/menu), `hasAssets`, `hasSelection`, `isPreviewOpen`, and `isTypingTarget`. |
| `react/components/AssetCard.tsx` | The generic card: lazy-mounted thumbnail (via the existing `useInView` hook — a direct reuse of the port this package already shipped, not a new lazy-mount implementation), select checkbox, preview button (meta/ctrl→toggle, shift→range, plain→preview, via `resolvePreviewClickAction`), kind/source badges, title/subtitle, a generic "Remove" button wired to an optional `onDeleteAsset` callback, and a `renderCardExtra` slot for the OD-specific origin-navigation row. |
| `react/components/AssetGridToolbar.tsx` | Search box, kind/source `<select>` facets (hidden entirely when a host supplies no facet options), Grid/Timeline view toggle, a built-in Refresh button (generic — the original's Sync/Upload buttons are OD-specific and left to the `toolbarActions` slot instead). |
| `react/components/AssetGridBody.tsx` | Grid mode (one flat `assets.map`) vs. timeline mode (`groupByDay` sections, each with a heading + count) — both call the same `renderCard` with the same flat `index`, matching the original's "range/box selection stays consistent across both views" invariant exactly. |
| `react/components/SelectionActionBar.tsx` | Selected count, Select-all/Clear, a `renderBulkActions` slot for OD-specific bulk actions, and the generic bulk-delete-request button. |
| `react/components/DeleteConfirmDialog.tsx` | The confirm-UI for bulk delete — count-aware singular/plural copy, Escape-to-close, backdrop-click-to-close, focus-the-confirm-button-on-mount, body-scroll-lock. |
| `react/components/SelectionBand.tsx` | The rubber-band visual rectangle (`position: fixed` inline, since that's structural to the coordinate space `snapshotCardRects` uses — everything else about its look is left to host CSS). |
| `react/components/AssetGrid.tsx` | The orchestrator — composes all 5 hooks + `rules.ts` derivations, wires the bulk-delete confirm flow and the per-card delete callback, defaults `dependencies` to the fake data port. |
| `index.ts` | Public barrel. |

Also added, not asset-grid-specific: `src/hooks/useDebouncedValue.ts` — a
small generic trailing-debounce hook, promoted out of `useAssetGridData` into
the package's shared `src/hooks/` bucket (mirrors `useInView`'s placement)
since debouncing a fast-changing value is not an asset-grid concept.

### The "element vs image" client-side narrowing seam

The original's kind filter has one piece of real OD-specific nuance:
`element` is a *badge* identity (clipper element-pick captures), not a raw
storage kind — those captures are stored as `image` and narrowed out
client-side after a server-side `kind=image` query
(`matchesKindFilter(a, kind)` in the original). This is exactly the kind of
per-asset badge-vs-storage-kind split a generic component can't hardcode, so
it's now two host-injectable seams on `AssetGridSelectors`: `mapKindToQuery`
(what to actually send the server — OD would map `'element' → 'image'`) and
`matchesKindFilter` (the client-side narrowing predicate — OD would check
its own badge-derivation logic). Both default to identity/equality when a
host doesn't need the split.

### Dropped (OD-specific, non-separable — per r6 and this task's own step 6)

- **`LibraryCard`'s "origin" action row** (design-system/project/edit-as-page
  navigation — `originDesignSystemId`/`originProjectId`/`navigate`/
  `onEditAsPage`). Exposed as a `renderCardExtra` slot on `AssetCard`; the
  generic component renders nothing there unless a host supplies it.
- **"Multi-select → add to design system"** (the whole `dsMenu*` cluster:
  `createDesignSystemFromSelection`/`optimizeExistingDesignSystem`/
  `chatToDesignFromSelection`, `fetchDesignSystems`, the design-system
  picker menu). Exposed as a `renderBulkActions` slot on
  `SelectionActionBar`; same "renders nothing unless supplied" default.
- **Kind-aware thumbnail rendering itself** (`MediaThumb`/`Thumb`/
  `LibraryThumb`'s image/video/html/font/color switch) — OD-specific in
  which kinds exist and how each renders, not portable as logic. Exposed as
  a required `renderThumbnail` prop; only the *lazy-mount-on-scroll*
  wrapping (via `useInView`) is generic and built in.
- File upload (`LibraryUploadModal`, the drag-anywhere-to-upload overlay,
  `openUpload`/`onSectionDrop` family) and the preview modal
  (`LibraryPreviewModal`, prev/next navigation) — neither is in the required
  a–i list (see manifest below); both are OD-specific surfaces a host
  builds itself. `AssetGrid` exposes `onPreview(asset)` as a plain callback
  (fired with the same meta/ctrl/shift precedence as the original) and
  otherwise stays out of the preview-modal business entirely.
- The `Sync` button (`runSync`/`syncLibrary`) — an OD-specific daemon
  reconciliation action, left to the `toolbarActions` slot alongside Upload.
- The Composio-style `~90-entry` category label map pattern doesn't apply
  here (this file never had one), but the same host-supplies-its-own-labels
  principle applies to kind/source facet `label`s — the generic component
  only stores/reads `value`s, a host supplies its own display labels via
  `kindFacets`/`sourceFacets`.

### Retained generic behavior manifest (required a–i)

Every item from this task's own required list, with where it landed and what proves it:

**a. Rubber-band multi-select** (`snapshotCardRects`/`cardIdsInBand`) — ported
verbatim into `rules.ts`, unchanged geometry/hit-testing logic. Wired by
`react/hooks/useRubberBandDrag.ts` (rAF-throttled drag, scroll re-snapshot,
additive/plain-click semantics). Proven by `rules.test.ts`'s
`snapshotCardRects`/`cardIdsInBand` suites (jsdom-rect fixtures) and
`useRubberBandDrag.test.ts`'s 4 tests (drag-selects-intersecting-cards,
mousedown-on-a-card-is-ignored, empty-click-clears-selection,
shift-held-drag-keeps-prior-selection-as-base) plus
`AssetGrid.test.tsx`'s end-to-end selection-bar assertions.

**b. Day-bucketed timeline grouping** — `dayHeadingResult`/`dayHeading`/
`groupByDay` in `rules.ts` (newest-day-first, flat-index-preserved, same
Today/Yesterday/formatted-date logic as the original's `dayHeading`).
Rendered by `AssetGridBody.tsx`'s timeline branch. Proven by `rules.test.ts`
(`dayHeading`/`dayHeadingResult`/`groupByDay` suites, including the
non-contiguous-same-day-collapse case) and `AssetGridBody.test.tsx` (groups
by day, newest first, heading + count, flat index preserved) and
`AssetGrid.test.tsx`'s "Grid/Timeline toggle switches rendering mode" test.

**c. Kind/source facet filtering** — `AssetGridToolbar`'s `<select>`s (hidden
entirely when a host supplies no facets, vs. the original's always-present
`KIND_FILTERS`/`SOURCE_FILTERS`), `buildAssetGridQuery`/
`defaultMatchesKindFilter`/`filterByKind` in `rules.ts` for the query +
client-narrowing split. Proven by `rules.test.ts`'s query/filter suites,
`AssetGridToolbar.test.tsx`'s facet-select tests, and `AssetGrid.test.tsx`'s
"filters by the kind facet" end-to-end test.

**d. Debounced search** — `useDebouncedValue` (250ms default, matching the
original's trailing debounce), wired in `AssetGrid.tsx`. Proven by
`useDebouncedValue.test.ts` (2 tests, fake-timer-driven: only the last
rapid-fire value lands) and `AssetGrid.test.tsx`'s "filters by a debounced
search" end-to-end test (real timers, short override).

**e. SSE live-merge reconciliation** — `useAssetGridLiveUpdates.ts`, ported
behavior-for-behavior from the original's coalescing `flush()` (deletes
free, filtered-view/no-cheap-fetch/ambiguous-null-fetch all fall back to a
full reload, a burst coalesces into one flush), `mergeIngestedAssets`/
`parseLiveUpdateAssetId` in `rules.ts` for the actual merge. The real
transport (`createBrowserSseLiveUpdatesPort`, `EventSource`-backed) lives in
`dependencies.ts`. Proven by `rules.test.ts`'s merge/parse suites,
`useAssetGridLiveUpdates.test.ts`'s 9 tests (delete-applies-free,
ingest-resolves-via-fetchAssetById, filters-active-forces-full-reload,
onFullReload-forces-reload, no-fetchAssetById-forces-reload,
null-fetch-forces-reload, burst-coalesces-into-one-flush,
unsubscribe-on-unmount), and `dependencies.test.ts`'s
`createBrowserSseLiveUpdatesPort` suite (routes ingest/delete by resolvable
id, falls back to full-reload for an unparseable payload, closes the
`EventSource` on unsubscribe).

**f. Grid/Timeline view toggle** — a real, distinct UI mode switch, NOT
dropped (this is exactly the gap the prior unmerged attempt left
undisclosed). Confirmed from the original source what each mode actually
renders (line-referenced in this task's own Reference Preflight): grid is
one flat `assets.map`; timeline groups the *same* cards into day-bucketed
`<section>`s, each with a heading + count, sharing the same flat `index`.
Ported as `viewMode` state in `AssetGrid.tsx` + `AssetGridToolbar`'s
Grid/Timeline buttons (`aria-pressed`, `data-active`) + `AssetGridBody`'s
mode switch. Proven by `AssetGridToolbar.test.tsx`'s "view toggle switches
modes and reflects the active one" test and `AssetGrid.test.tsx`'s
"Grid/Timeline toggle switches rendering mode" end-to-end test.

**g. Bulk-delete-with-confirm** — a real `onDeleteSelected` callback prop
(the actual gap the prior attempt left, per this task's own brief) plus a
real confirm-dialog affordance, both present and tested. `AssetGrid.tsx`'s
`requestDeleteSelected`/`confirmDelete` wire `SelectionActionBar`'s Delete
button → `DeleteConfirmDialog` → `onDeleteSelected(ids)` (awaited) → local
removal from `assets` + cleared selection. `onDeleteAsset` is the equivalent
single-card callback wired to `AssetCard`'s generic "Remove" button. Proven
by `DeleteConfirmDialog.test.tsx` (6 tests: singular/plural copy, Cancel,
confirm, Escape, backdrop-click, focus-on-mount + scroll-lock) and
`AssetGrid.test.tsx`'s "bulk delete: request → confirm dialog → confirm
calls onDeleteSelected and removes the items", "bulk delete: cancel closes
the dialog without calling onDeleteSelected", and "per-card Remove calls
onDeleteAsset" end-to-end tests.

**h. Keyboard shortcuts** — Cmd/Ctrl+A / Escape / Delete-Backspace, grepped
directly from the original source (lines 1014–1038 of
`LibrarySection.tsx`), not assumed from memory. Ported as
`useAssetGridKeyboardShortcuts.ts`, gated by `enabled` (a host-owned
modal/menu — mirrors the original's `uploadOpen || confirmDeleteOpen ||
dsMenuOpen` gate, generified since this package doesn't know about a host's
own modals), `hasAssets`, `hasSelection`, `isPreviewOpen`, and
`isTypingTarget` (also ported from the original's inline
`INPUT`/`TEXTAREA`/`SELECT`/`isContentEditable` check). Proven by
`useAssetGridKeyboardShortcuts.test.ts`'s 9 tests and `AssetGrid.test.tsx`'s
"Cmd/Ctrl+A selects all, Escape clears the selection" and "the Delete key
opens the bulk-delete confirm dialog" end-to-end tests.

**i. Kind-aware thumbnail dispatch** — a required `renderThumbnail` prop on
`AssetCard`/`AssetGrid` (the dispatch logic itself — image/video/html/font/
color — is OD-specific in which kinds exist, per r6, so it's host-supplied,
not ported). What IS generic and built in: the lazy-mount-on-scroll wrapper
around whatever the host renders, reusing this package's existing
`useInView` hook rather than reimplementing the original's bespoke
`LAZY_THUMB_KINDS`/`LibraryThumb` gate. Proven by `AssetCard.test.tsx`'s
render/interaction tests (the thumbnail slot renders via `renderThumbnail`,
verified through `useInView`'s existing `IntersectionObserver`-unavailable
fallback, already covered by `useInView.test.ts`) and `AssetGrid.test.tsx`'s
end-to-end tests confirming cards render with host-supplied thumbnails.

### i18n wiring

Every user-facing string in every new component (`AssetCard`,
`AssetGridToolbar`, `SelectionActionBar`, `DeleteConfirmDialog`,
`AssetGridBody`'s Today/Yesterday headings) is routed through `useT()`, English
string as the key — no hardcoded literals, no repeat of the original
connectors-canary mistake of shipping a first pass without the i18n
mechanism. `dayHeadingResult` in `rules.ts` (pure, no React) returns a
`{label, translatable}` pair rather than a bare string specifically so the
component can decide whether to wrap it in `t()` — a locale-formatted date
string (`toLocaleDateString`) is not a sensible translation key (it varies
per bucket), only the fixed "Today"/"Yesterday" labels are, mirroring the
`toolsBadgeTranslation` pattern the connectors canary's independent review
added for the same "don't wrap a value that bakes dynamic content into the
key" reason. Verified end-to-end (not just that `t()` calls compile) by
`AssetCard.test.tsx`'s and `AssetGrid.test.tsx`'s
mount-under-`I18nProvider`-with-a-French-dictionary tests, asserting the
translated text actually renders (`Sélectionner`, `Actualiser`, `Tout
sélectionner`, `Supprimer {count}`, `Supprimer`).

### Phase 8.5 audit — what it caught

Ran the mandated audit (not just the "zero top-level functions" grep)
across every new file, per the same three blind spots the connectors canary's
own audit checked:

1. **Inline JSX callbacks with real branching**: found two, both in
   `AssetCard.tsx` — the preview button's `onClick` (3-way branch on
   meta/ctrl/shift) and the select-checkbox's `onClick` (2-way branch on
   shift, plus `stopPropagation`). Extracted the branching *logic* into pure
   `rules.ts` functions (`resolvePreviewClickAction`/
   `resolveCheckboxClickAction`, now unit-tested in isolation) and wrapped
   each call site in a named `useCallback` (`handlePreviewClick`/
   `handleCheckboxClick`) that just dispatches on the result — matching the
   connectors canary's own "extract the LOGIC, the registration/dispatch can
   stay" resolution for its `ProviderTabBar`/gate `onClick` handlers.
   `DeleteConfirmDialog.tsx`'s backdrop `onMouseDown={(e) => { if
   (e.target === e.currentTarget) onCancel(); }}` was left inline — the same
   single-line "click outside" DOM comparison `ConnectorDetailDrawer.tsx`
   already establishes as acceptable inline, not business logic.
2. **`useMemo` bodies with multi-line/inline-construction derivations**:
   found one — `AssetGrid.tsx`'s `kindFacetLabels`/`sourceFacetLabels`
   memos were building a `Map` inline. Extracted to `rules.ts` as
   `buildFacetLabelMap` (+ `resolveFacetLabel` for the lookup-with-fallback
   read side, itself replacing an inline `?? kindValue`/ternary at the
   `renderCard` call site), both now unit-tested. Every remaining `useMemo`
   in the new files is a one-line call into an already-pure `rules.ts`
   function or a plain default-selection expression, the target end state.
3. **Orphaned `useState`/`useRef`**: enumerated every one across all 21 new
   source files (listed by hand): `AssetGrid.tsx`'s `kind`/`source`/
   `search`/`viewMode`/`confirmDeleteOpen`/`containerRef`,
   `DeleteConfirmDialog.tsx`'s `confirmBtnRef`, `useAssetGridData.ts`'s
   `assets`/`loading` state + 3 selector-bridging refs,
   `useAssetGridLiveUpdates.ts`'s 3 latest-value-bridging refs,
   `useAssetGridSelection.ts`'s `selectedIds`/`anchorRef`,
   `useRubberBandDrag.ts`'s `band`/`dragging`/`dragRef` — every one traced
   to a real read site, none unassigned.

`pnpm --filter @jini/ui run typecheck` was re-run clean after each fix.

### Purity grep — reported explicitly per this task's own instructions

**Product-identity strings** (`Open Design`, `OD_`, `--od-stamp`,
`/tmp/open-design`, `@open-design/`) across every new file under
`features/asset-grid/` plus `src/hooks/useDebouncedValue.ts`: **clean, zero
matches.** A second, stricter self-imposed pass (`od-`/`open-design\.ai`/
`openDesignDesktop`, catching lowercase-prefix and non-regex-exact product
identity) is also clean. Two doc comments cite the bare original filename
`LibrarySection.tsx` by name (in `AssetGrid.tsx` and
`useRubberBandDrag.ts`) — this is provenance, not a vendored-path leak (the
connectors canary's own caught mistake was citing the full
`integrations/open-design/...` path literally; neither of these comments
does that, and citing a bare source filename matches the connectors
package's own shipped precedent, e.g. `rules.ts`'s "Pure logic ported from
OD's `ConnectorsBrowser.tsx`" docblock).

**`window`/`document`/`EventSource`/`localStorage`/`sessionStorage` used
outside `dependencies.ts`**: three files, all disclosed, deliberate
deviations from the strict ADR-0002 "no DOM outside dependencies.ts" rule —
the same class of exception `ConnectorDetailDrawer.tsx` already establishes
as acceptable:
- `DeleteConfirmDialog.tsx` — `document.addEventListener` (Escape-to-close)
  and `document.body.style.overflow` (scroll lock), the same standard modal
  idiom as `ConnectorDetailDrawer.tsx`.
- `useRubberBandDrag.ts` — `window.addEventListener('mousemove'/'mouseup'/
  'scroll')` and `document.body.style.userSelect`, required for the drag
  gesture to track the pointer outside the grid's own DOM node; this is the
  mechanism, not a business-logic smuggle.
- `useAssetGridKeyboardShortcuts.ts` — `window.addEventListener('keydown')`
  and `document.activeElement`, required for a global keyboard-shortcut
  listener (matches the original's own `window.addEventListener('keydown',
  onKey)`).
`dependencies.ts` itself legitimately uses `EventSource` (that's its job).
No other file in the feature touches any of these.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: **green, zero errors.**
- `pnpm --filter @jini/ui exec vitest run src/features/asset-grid src/hooks`:
  **131 tests, 16 files, all green** — `rules.test.ts` (41), `dependencies.test.ts`
  (9), `useAssetGridData.test.ts` (4), `useAssetGridLiveUpdates.test.ts` (9),
  `useAssetGridSelection.test.ts` (4), `useRubberBandDrag.test.ts` (4),
  `useAssetGridKeyboardShortcuts.test.ts` (9), `useDebouncedValue.test.ts`
  (2), `AssetCard.test.tsx` (11), `AssetGridToolbar.test.tsx` (7),
  `AssetGridBody.test.tsx` (3), `SelectionActionBar.test.tsx` (2),
  `SelectionBand.test.tsx` (2), `DeleteConfirmDialog.test.tsx` (6),
  `AssetGrid.test.tsx` (14, end-to-end against the fake dependencies:
  load, empty-state, kind-facet filter, debounced search, preview callback,
  selection bar, bulk-delete confirm/cancel, per-card delete, Cmd+A/Escape/
  Delete shortcuts, view toggle, host-supplied `renderCardExtra`/
  `renderBulkActions` slots, and the i18n end-to-end dictionary test).
- Full package `pnpm --filter @jini/ui exec vitest run`: **502 tests, 68
  files, all green** (no regressions in `features/connectors`,
  `features/i18n`, `features/observability`, `components/`, `utils/`,
  `hooks/`).
- Full monorepo `pnpm -r --no-bail run typecheck`: `packages/ui typecheck:
  Done` (clean). The 9 failures elsewhere are pre-existing and unrelated:
  `agent-runtime`/`chat-react`/`cli`/`http`/`node-host`/`renderers-react`/
  `sqlite` are stub packages genuinely missing a `tsconfig.json` (confirmed
  by directory listing — not touched by this task, same class of
  pre-existing gap the connectors canary's own report already flagged for
  two of these packages); `daemon`/`deploy` fail on unbuilt workspace
  dependencies (`@jini/protocol`/`@jini/core` have no `dist/` yet in this
  fresh checkout) — a build-order issue, not a type error, and also not
  touched by this task.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending
  implementation during extraction)` — unchanged, no boundary violations
  introduced.

### Added devDependency: `@testing-library/jest-dom`

This package had `@testing-library/react` but not `@testing-library/jest-dom`
— every existing test in the package (including the connectors canary) wrote
DOM assertions by hand (`.toBeTruthy()`, manual attribute reads) rather than
using matchers like `toBeInTheDocument()`/`toHaveAttribute()`. This task adds
`@testing-library/jest-dom` as a devDependency and wires it into
`vitest.setup.ts` (`import '@testing-library/jest-dom/vitest'`) rather than
hand-rolling ~40 raw DOM assertions across the new test files. A new
`src/vitest-env.d.ts` ambient-reference file was also needed: `tsc -p
tsconfig.json` only includes `src/` per this package's `tsconfig.json`, so
the type augmentation `vitest.setup.ts` pulls in at runtime (outside `src/`)
was invisible to typecheck without a matching `/// <reference types="@testing-library/jest-dom/vitest" />`
placed inside `src/`. Dev-only; no runtime dependency added.

---

## Section: `features/viewer-shell/` — media-viewer shell extraction (2026-07-17)

Source: a vendored OD file-viewer god-component's media-viewer shell family
(the specific pieces named in `docs/jini-port/god-components-extraction-plan.md`'s
consolidation map row for this target — the file itself stays vendored,
14,275 lines, and is not otherwise touched). Per that doc's own r6-derived
verdict, this is a **PARTIAL** extraction of a **PARTIAL** file: only the
~6-9 named generic pieces, not the file's `HtmlViewer` (~7,110 lines) or
`FileVersionManagerModal` (~1,050 lines), both confirmed OD-specific.

### New layout, not the connectors/progress-card precedent

This is the first `@jini/ui` feature built under the 2026-07-17 layout
decision (`packages/ui/README.md`): `types.ts`/`constants.ts`/`rules.ts`/
`ports.ts`/`dependencies.ts`/`index.ts` at the feature's top level;
everything importing React under `features/viewer-shell/react/{hooks,components}/`.
`features/connectors/` (read as the structural example per this task's
brief) still uses the old flat `hooks/`/`components/` layout — its internal
ports+dependencies+hooks+components+barrel *discipline* was the template,
not its exact paths. Note: `features/progress-card/`, the other file this
task was pointed at as a structural example, does **not exist** in this
branch's checkout (`packages/ui/src/features/` only contains `connectors/`,
`i18n/`, `observability/` before this task) — the extraction-plan doc's "✅
landed" note for it appears to describe work merged on a different branch
than this one was cut from. Not a blocker for this task; flagged as a
discrepancy for whoever reconciles branches next.

### What shipped — `packages/ui/src/features/viewer-shell/`

| File | Contents |
|---|---|
| `types.ts` | `ViewerFileRef` (`{name,size,mtime,mime?}`), `ViewportPreset`, `SegmentedOption<T>`, `ViewerFileActionUrls`, `ViewerCommentAttachment`, `ViewerCommentBase`, `CommentSideDragState`, `MarkdownSplitPaneMode`. |
| `constants.ts` | `DEFAULT_VIEWPORT_PRESETS` (desktop/tablet/mobile convenience default), `COMMENT_SIDE_DRAG_MIME` (renamed from the source's `application/x-open-design-preview-comment`), `COPY_FEEDBACK_RESET_MS`. |
| `rules.ts` | `humanFileSize`; comment-reorder helpers (`dropEdgeForClientY`, `reorderCommentIds`, `appendSavedCommentOrder`, `visibleSelectedCommentIds`); `relativeCommentTimeTranslation` (a `{key,vars}`-returning port of the source's inline `formatCommentTime`, generic — see the i18n note below); the full JSON-precision-safe formatting chain (`formatJsonTextForDisplay`, `hasPrecisionSensitiveJsonNumberText`, `hasUnsafeJsonNumber`, and their private token/decimal helpers) ported verbatim from `TextViewer`'s body, since it's genuinely pure and zero-OD-coupled; `scrollRange`/`scrollRatio`/`scrollTopForRatio` (new, small — the 3 markdown-scroll-sync helpers not already in `src/utils/markdown-scroll-sync.ts`); `computeSplitPaneScrollTarget` (orchestrates the already-ported `buildScrollAnchors`/`mapScrollPosition`/`measureEditorBlockOffsets`/`measurePreviewBlockOffsets`, re-exported from this file for convenience). |
| `ports.ts` / `dependencies.ts` | `ViewerClipboardPort` — the one injectable seam this feature needs (no fetch/transport port: see "What's out of scope" below). Ships a real browser implementation (`createBrowserViewerClipboard`, wrapping the already-ported `src/utils/copy-to-clipboard.ts`) rather than a fake, same reasoning as connectors' SSR-guarded browser adapters — clipboard access is a generic browser API with no backend shape to fake. |
| `react/hooks/useCopyToClipboard.ts` | The "copy, flip a `copied` flag, auto-reset after ~1.5s" pattern independently repeated by the source's plain-text viewer and its markdown viewer's copy button — generalized into one hook. |
| `react/hooks/useCommentReorder.ts` | The comment side-panel's drag/dragover/drop reorder state machine, pulled out of the presentational component per the MemorySection-pattern "feature-local hooks own the fiddly state" discipline. |
| `react/hooks/useMarkdownScrollSync.ts` | The scroll-sync orchestration (rAF scheduling, programmatic-scroll suppression, active-pane tracking) built on top of `rules.ts`'s `computeSplitPaneScrollTarget` and the already-ported block-offset measurers. |
| `react/components/ViewerShell.tsx` | The generic "viewer-toolbar + viewer-body" chrome — the actual highest-value piece per r6, replacing 8 near-duplicate toolbar+body layouts with one shell taking `toolbarLeft`/`toolbarActions`/`children` slots. Also exports the trivial `ViewerEmptyState`. |
| `react/components/ViewerFileActions.tsx` | Generic download/open link pair — the source's `FileActions` with `projectFileUrl(projectId, file.name)` replaced by host-resolved `downloadUrl`/`openUrl` props. |
| `react/components/SegmentedToggle.tsx` | New shared primitive — see "Viewport-controls overlap resolution" below. |
| `react/components/ViewportSwitcher.tsx` | Dropdown/listbox viewport-preset switcher, generalizing `PreviewViewportControls`. |
| `react/components/ViewportToggleGroup.tsx` | Always-visible toggle-button row, generalizing `FileVersionViewportControls`; a thin wrapper over `SegmentedToggle`. |
| `react/components/CodeWithLines.tsx`, `JsonPanel.tsx` | Ported verbatim, per r6. |
| `react/components/ImageViewerBody.tsx`, `VideoViewerBody.tsx`, `AudioViewerBody.tsx` | New, small — trivial presentational bodies (`<img>`, `<video>`, `<audio>`+icon) generalizing `ImageViewer`/`VideoViewer`/`AudioViewer` once the daemon URL-building is stripped (host resolves a final `src`). Not explicitly named as separate deliverables by r6/the plan (which describe one generic shell, not 8 ported viewers), but small enough, and different enough from "8 near-duplicate viewers," to ship as convenience leaves over the shared shell rather than leaving image/video/audio bodies unaddressed. |
| `react/components/SvgSourcePane.tsx` | New — `SvgViewer`'s preview/source body content (its toolbar's mode-toggle and reload/download chrome are composed by the host from `ViewerShell`/`SegmentedToggle`/`ViewerFileActions` instead of being re-baked into this component). |
| `react/components/CommentSidePanel.tsx`, `CommentSideDock.tsx` | Generic over a `TComment extends ViewerCommentBase` type parameter — see the discrepancy writeup below for what else had to become a prop, beyond just the type. |
| `react/components/MarkdownSplitPane.tsx` | The split source/preview pane + mode tabs + scroll-sync, with the artifact-status gate, autosave pipeline, image upload, and shiki highlighting all dropped — see below. |
| `index.ts` | Public barrel. |

### Viewport-controls overlap — resolved per Step 1.1

Three viewport-preset switchers exist across the sweep: the source file's
`PreviewViewportControls` (main preview toolbar) and `FileVersionViewportControls`
(version-manager toolbar), plus `DesignBrowserPanel.tsx`'s `BrowserViewportControls`
(not yet extracted — a different, not-yet-touched god-file).

Read side by side:
- **`PreviewViewportControls` and `BrowserViewportControls` are the same
  shape.** Both are a trigger button showing the active preset that opens a
  `role="listbox"` dropdown menu of the other presets, with identical
  outside-pointerdown/Escape-to-close wiring (`document.addEventListener`
  in a `useEffect` gated on `open`) and an identical per-item shape (icon +
  label + a checkmark on the selected one). They differ only cosmetically:
  `BrowserViewportControls` wraps its trigger in OD's `IconTooltipButton`
  and supports a `disabled` prop the other lacks; class-name prefixes differ
  (`viewer-viewport-*` vs. `db-viewport-*`). **Resolution: ship ONE shared
  primitive** — `ViewportSwitcher` — generalizing `PreviewViewportControls`.
  When `DesignBrowserPanel.tsx` is eventually extracted, it should bind to
  this component rather than re-implement `BrowserViewportControls` as a
  second competing dropdown switcher; `ViewportSwitcher`'s doc comment says
  so explicitly.
- **`FileVersionViewportControls` is a genuinely different shape**, not a
  third instance of the same dropdown: it's an always-visible `role="group"`
  row of toggle buttons (`aria-pressed`, no open/closed state, no menu) —
  used in the version manager's tighter toolbar where a dropdown didn't fit.
  Ported as `ViewportToggleGroup`, itself a thin wrapper over a new shared
  primitive, `SegmentedToggle<T>`.
- **One disclosed simplification while building `SegmentedToggle`**: the
  source's `FileVersionViewportControls` used `role="group"`/`aria-pressed`
  buttons, while its *other* two "toggle a few options" call sites in the
  same file (`SvgViewer`'s preview/source tabs, `MarkdownViewer`'s
  edit/split/preview tabs) used a `role="tablist"`/`aria-selected` tab
  pattern instead — a real, if minor, ARIA difference. Rather than ship a
  third near-identical primitive just for that distinction,
  `MarkdownSplitPane` reuses `SegmentedToggle` (group/pressed semantics) for
  its mode tabs too. This is a deliberate, disclosed simplification, not an
  oversight — flagging it here per the task's audit requirement rather than
  letting it pass as a silent behavioral gap.

### The `CommentSidePanel` generic-type gap the recon doc didn't call out

`docs/jini-port/god-components-extraction-plan.md` (quoting r6 §1.1)
describes `CommentSidePanel`/`CommentSideDock` as "already prop-abstracted
... only `PreviewComment`'s type is OD-specific — textbook generic-shape-OD-
type-parameter." Reading the full component surfaced two more real gaps a
type parameter alone can't close:

1. **`commentDisplayLabel(comment, t)`** derives a comment's one-line label
   by regex-matching HTML tag names out of `elementId`/`label`/`htmlHint`
   fields (a board-annotation-specific heuristic: "does this look like an
   image, a button, a heading, a link, a page comment?"). This is *logic*,
   not just a type — it can't be ported generically. `CommentSidePanelProps`
   makes it a required `getCommentLabel(comment, index)` callback instead.
2. **`projectRawUrl(projectId, attachment.path)`** (attachment thumbnail
   URLs) is a daemon-route builder, not portable. Replaced with an optional
   `resolveAttachmentUrl` callback; attachments render only when a host
   supplies one.
3. `commentActivityAt`/`formatCommentTime` (timestamp derivation + relative-
   time formatting) *are* genuinely generic — ported as
   `relativeCommentTimeTranslation` in `rules.ts`, with an overridable
   `formatTimestamp` prop for a host that wants different phrasing.

None of this is a silent drop — `CommentSidePanelProps`' doc comments call
out exactly why `getCommentLabel`/`getCommentTimestamp`/`getCommentBody`/
`resolveAttachmentUrl` exist as host-supplied functions instead of being
derived internally.

### `MarkdownSplitPane` — narrower than the plan's one-line description

The plan doc says: *"MarkdownViewer's split source/preview pane with
scroll-sync — generic; only the artifact-status gate around it ties it to
OD (drop the gate, keep the split-pane/scroll-sync mechanism)."* Reading the
full ~680-line `MarkdownViewer` function shows this undersells the coupling
by a wide margin — a second instance (after this same plan's `ExportDiagnosticsButton`/
`enterpriseUrl.ts` and `ConnectorLogo`'s CDN-slug finding) of the plan's own
documented pattern: reading a file in full surfaces more product coupling
than the recon pass's one-line note implies. Beyond the artifact-status gate
(`isStreaming`/`isError`), the following are **also** genuinely OD/product-
specific and were **not ported**:

- The autosave pipeline (`saveMarkdownText`, its 700ms debounce, in-flight/
  pending-save merge logic, `writeProjectTextFile` daemon calls, the
  auto-save-status indicator UI).
- Image paste/drop upload (`insertImageFiles`, `uploadProjectFiles`,
  markdown-image-snippet insertion).
- The markdown-to-HTML rendering pipeline itself (`MarkdownRenderer`/
  `renderMarkdownToSafeHtml`, project-relative image-src rewriting) and its
  shiki-based code-block syntax highlighting + inject-a-copy-button-into-
  the-DOM mechanism.
- The export-as-.md download menu and `OPEN_DESIGN_GITHUB_REPO_URL`-adjacent
  social-share wiring (not shown in the snippet quoted in r6, found on the
  full read).

What's left, and what `MarkdownSplitPane` actually ships, is the genuinely
generic core: the source/split/preview mode toggle and the two-pane layout
whose scroll positions stay aligned via block-anchored interpolation
(`useMarkdownScrollSync`, built on the already-ported
`extractMarkdownBlockLines`/`measureEditorBlockOffsets`/
`measurePreviewBlockOffsets`/`buildScrollAnchors`/`mapScrollPosition` in
`src/utils/markdown-scroll-sync.ts`). A host renders its own markdown-to-
HTML pipeline and passes the resulting string as `previewHtml`; the
component's `toolbarActions`/`toolbarLeftExtra` slots are where a host
plugs in its own save-status indicator, copy/download buttons, and
streaming/error labels.

### What's out of scope (confirmed OD-specific, not touched)

- **`HtmlViewer`** (~7,110 lines) — deploy-provider selection, live-artifact
  daemon streaming, board/pod annotation, manual-edit CSS bridge
  (`InspectPanel` and its `rgbToHex`/`pxToNumber` helpers, read far enough
  to confirm the boundary, live here).
- **`FileVersionManagerModal`** (~1,050 lines) — version history UI
  saturated with OD analytics/deploy/export calls.
- **No fetch/transport port beyond the clipboard.** Every other piece in
  this feature is either pure logic or presentational-only; the actual
  file-content loading (`fetchProjectFileText`/`fetchProjectFilePreview`),
  saving, and rendering pipelines are host responsibilities by design, not
  a gap — see the `MarkdownSplitPane` writeup above for why that's a
  deliberate scope boundary, not an oversight.
- **No `Button`/`Input`/`Select` primitives.** The source's
  `CommentSidePanel`/`InspectPanel` import these from `@open-design/components`
  (OD's own component library, not vendored here, and not yet ported into
  `@jini/ui`). `CommentSidePanel` uses plain `<button>` elements instead,
  matching the existing `Toast.tsx`/`CustomSelect.tsx` precedent of not
  depending on an unavailable external UI kit.

### i18n

Every user-facing string in the new `react/components/` files is wired
through `useT()` with the English string itself as the key (`t('Download')`,
not `t('fileViewer.download')`), per the plan's i18n policy. `rules.ts`'s
`relativeCommentTimeTranslation` stays hook-free (pure, returns a
`{key,vars}` pair); callers wrap it in `t()` at the call site
(`CommentSidePanel`), matching the same pattern already used for
`features/connectors/`'s `statusLabel()`/`toolsBadgeTranslation()`. Verified
end-to-end, not just compiled: `ViewerFileActions.test.tsx`,
`CommentSidePanel.test.tsx`, and `MarkdownSplitPane.test.tsx` each mount
under `I18nProvider` with a translated (French) dictionary and assert the
translated text actually renders.

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|@open-design/"`
across `packages/ui/src/features/viewer-shell/`: clean, zero matches.
A second, stricter pass for the literal vendored reference path
(`grep -rn "components-original\|integrations/open-design"`) is also clean
— every doc comment in this feature describes provenance as "the source
component" rather than citing the vendored file path literally, per the
connectors addendum's warning about exactly this leak.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: clean.
- `pnpm --filter @jini/ui exec vitest run`: **495 tests, 72 files, all
  green** (120 new tests across 19 new files for this feature: 36 in
  `rules.test.ts`, the rest split across the hook and component tests
  listed above).
- `pnpm -r --filter='!@jini/agent-runtime' --filter='!@jini/chat-react' --filter='!@jini/cli' run typecheck`:
  clean for every real package. `@jini/agent-runtime`/`@jini/chat-react`/
  `@jini/cli` fail with `tsc: path does not exist: 'tsconfig.json'` — these
  are stub packages with no `tsconfig.json` at all yet (per `AGENTS.md`'s
  package list: only `protocol, core, platform, sidecar, chat-core, deploy`
  have real implementations), unrelated to and pre-dating this task; the
  connectors canary's own source-map section hit and documented the same
  two pre-existing failures.
- `pnpm guard`: `[guard] ok (skeleton — rules pending implementation during
  extraction)` — unchanged, no boundary violations introduced.

### Phase 8.5 audit

Ran the mandated audit across every new file:

1. **Inline JSX callbacks with real branching/multi-statement bodies**: found
   one — `CommentSidePanel`'s per-comment "select" checkbox button combines
   `event.stopPropagation()` + delegating to `onToggleSelect(comment.id)`.
   Left inline (single call site, trivial DOM-bookkeeping + a one-line
   delegate call, no branching) — the same disposition the connectors
   canary's own audit gave a materially identical backdrop-click pattern.
   No other multi-statement inline callback found.
2. **`useMemo`/`useEffect` bodies with real derivations**: `useMarkdownScrollSync`'s
   `blockLines` `useMemo` is already a one-line call to the ported
   `extractMarkdownBlockLines` (matches the audit's target end-state).
   `CommentSidePanel`'s one `useEffect` (restoring focus to whichever toggle
   button triggered a collapse/expand) is DOM-only and tightly bound to this
   component's own three refs — not extracted to a shared `providers/dom.ts`
   helper, since it isn't a reusable DOM utility, just this component's own
   ref-juggling; flagged here rather than silently decided.
3. **Orphaned `useState`/`useRef`**: enumerated every one across all new
   files by hand — every state value and ref is read somewhere (render,
   an effect, or a callback); none found unassigned.

`pnpm --filter @jini/ui run typecheck` re-run clean after this pass (no
changes were needed as a result of it, beyond the two callouts above).

### New devDependency

`@testing-library/jest-dom` (`^6.6.3`) — added so component tests could use
idiomatic DOM matchers (`toBeInTheDocument`, `toHaveAttribute`, `toHaveClass`,
`toBeDisabled`, etc.). No prior `@jini/ui` test used these (the connectors
suite asserts against raw DOM/text-content instead), so this is a new
addition, registered in `vitest.setup.ts` for runtime and re-exported via a
new `src/vitest-jest-dom.d.ts` ambient-import shim so `tsc -p tsconfig.json`
(whose `include` is `["src"]`, not the package root) also picks up the
matcher-type augmentation.

---

## Section: `features/settings-dialog/` shell + 6 tabs — `SettingsDialog.tsx` (2026-07-17)

Source: `integrations/open-design/reference/components-original/SettingsDialog.tsx`
(8,538 lines) — item 5 in `docs/jini-port/god-components-extraction-plan.md`'s
priority list, resolving the exact Consolidation-map row: `features/settings-dialog/`
(shell) + `features/settings-dialog/tabs/{appearance,notifications,language,
instructions,integrations}`. Per r6 §1.3: 8 of the file's 17 real tabs were
*already* separate files the origin merely mounted — proof the dialog shell has
no hidden dependency on any one tab's content. This is the first feature in this
package built from scratch under the NEW `react/{hooks,components}` layout
(decided 2026-07-17, see `packages/ui/README.md`) rather than the old flat
`hooks/`/`components/` layout `features/connectors/` and `features/progress-card/`
still use.

### What shipped

**Shell — `packages/ui/src/features/settings-dialog/`**

| File | Contents |
|---|---|
| `types.ts` | `SettingsDialogTabMeta<TId>` (id/label/navHint/title/subtitle — no `panel`/`icon`, those are React-shaped and live on the `react/`-layer `SettingsDialogTab` prop type instead), `SettingsDialogChromeLabels`. |
| `rules.ts` | `resolveInitialActiveTabId` (id-or-first-tab-or-null), `findActiveTab` — pulled out of the origin's inline `useState` initializer / `sectionHeader[activeSection]` lookup so both are unit-testable without mounting React. |
| `react/hooks/useSettingsDialogShell.ts` | Owns activeTabId (controlled or uncontrolled), sidebarCollapsed, fullscreen, the content-pane scroll-reset-on-tab-change effect, and global-Escape-closes-the-dialog (a disclosed direct `document` use — no ports.ts exists for this feature at all, so there's no DI seam to route it through; same disclosed-deviation precedent as `features/connectors`' `ConnectorDetailDrawer`). |
| `react/components/SettingsDialogShell.tsx` | The orchestrator: backdrop + `role="dialog"` chrome + fullscreen/close buttons + welcome-vs-per-tab header + collapsible sidebar nav (generic over a host-supplied `tabs: SettingsDialogTab[]` array, each `{id, label, navHint?, title?, subtitle?, icon?, panel}`) + content pane. |
| `index.ts` | Public barrel. |

Dropped (per the plan's own instruction to leave shared shell state that's genuinely OD-bound behind): the AMR-card scroll/highlight coachmark, the autosave-status pill + autosave polling/retry timers, agent-scan/AMR-wallet state, telemetry/privacy-prop reconciliation on `initial` changes, and `settingsSectionToTracking`-keyed analytics. The chrome strip has an optional `chromeExtra?: ReactNode` slot a host can use to reintroduce its own autosave indicator without this package needing to know what one looks like.

**Tabs — `packages/ui/src/features/settings-dialog/tabs/<name>/`**

| Tab | r6 verdict | Ports? | Notes |
|---|---|---|---|
| `appearance` | GENERIC | No | Theme segmented control + accent swatches + custom picker. Reuses `src/utils/appearance.ts` (`applyAppearanceToDocument`/`ACCENT_SWATCHES`/`DEFAULT_ACCENT_COLOR`/`normalizeAccentColor`/`resolveAccentColor`, already shipped 2026-07-16) rather than re-deriving it — origin's `AppearanceSection` already called the same shape of function. `livePreview` prop (default `true`) reproduces the origin's live-document-preview-before-save behavior. |
| `notifications` | GENERIC | No | Sound toggle/picker + browser Notification-permission flow. Reuses `src/utils/notifications.ts` in full (`SUCCESS_SOUNDS`/`FAILURE_SOUNDS`/`notificationPermission`/`requestNotificationPermission`/`showCompletionNotification`/`playSound`, already shipped 2026-07-16) — zero new browser-API code needed. |
| `language` | GENERIC | No | Locale radio-tile grid. Reuses the `LocaleOption` type already shipped for `components/LanguageMenu.tsx` (`{code, label}`) instead of declaring a near-duplicate. OD's own fixed 19-locale `LOCALES`/`LOCALE_LABEL` tables are product content, not ported — a host supplies its own `LocaleOption[]`. |
| `instructions` | GENERIC | No | The simplest tab in the whole sweep: a controlled `<textarea>` bound to one string, `rows`/`maxLength` overridable (defaults 5/5000, matching the origin). |
| `privacy` | **First full verification** (r6 flagged "likely generic, not fully verified") | No | Telemetry consent card (share/decline + two per-category toggles) + installation-id generate/rotate ("Delete my data") flow. Verified generic: the only OD coupling in `PrivacySection.tsx` was the `AppConfig`/`TelemetryConfig` type import (replaced by local `PrivacyConsentState`/`TelemetryPreferences` in `types.ts`) and the analytics tracking calls (dropped, same as every other tab). All state transitions (`nextStateForTelemetryPatch`/`nextStateForShareAll`/`nextStateForDeclineAll`/`nextStateForDeleteMyData`) extracted as pure, unit-tested `rules.ts` functions taking an injectable `newInstallationId`/`now` — the component just calls them. `generateInstallationId` reuses `src/utils/uuid.ts`'s `randomUUID()` (already shipped, has its own secure/non-secure/Math.random 3-tier fallback) instead of re-deriving the origin's simpler `crypto.randomUUID()`-with-string-fallback. **Judgment call**: shipped rather than skipped — small, clean, and the only real risk (the analytics/type coupling) was shallow once read in full. |
| `integrations` | Generic mechanism, 100% branded content | **Yes** (`ports.ts`/`dependencies.ts`) | The multi-client "install me as an MCP server" snippet generator (Claude Code/Codex/Cursor/VS Code/Antigravity/Zed/Windsurf). The origin hardcoded the literal MCP server name `'open-design'` in every snippet builder (`claude mcp add-json --scope user open-design ...`, `[mcp_servers.open-design]`, `"mcpServers": {"open-design": ...}}`, the Cursor deeplink's `name=open-design` query param, etc.) — every builder in `rules.ts` now takes `serverName: string` as an explicit parameter instead. The origin also called OD's own daemon endpoints directly (`fetch('/api/mcp/install-info')`, `fetch('/api/mcp/install/codex/status')`, `fetch('/api/mcp/install/codex', {method})`) — routed through an injected `McpIntegrationsPort` (`fetchInstallInfo` + optional `fetchCodexInstallStatus`/`installCodexMcp`/`uninstallCodexMcp`) instead, with `dependencies.ts` shipping only an in-memory fake (`createFakeMcpIntegrationsPort`), same convention as `features/connectors`. |

`integrations`' full file breakdown:
- `types.ts` — `McpClientId`, `McpInstallInfo`, `McpStdioServerConfig`, `McpSnippetLanguage`, `McpClientDescriptor`, `McpClientSnippet` (snippet + language + a *templated* instruction string with `{path}`/`{shortcut}` placeholders + resolved vars, so the component can wrap it in `t()` — same i18n convention as every other tab, not baked-in English), `CodexInstallStatus`.
- `constants.ts` — `MCP_CLIENTS` (7 client descriptors), `DEFAULT_MCP_CLIENT_ID`, `DEFAULT_MCP_SERVER_NAME` (a generic `'mcp-server'` placeholder default — a real host is expected to pass its own `serverName`).
- `rules.ts` — every snippet builder ported 1:1 from the origin's inline `IntegrationsSection` (`homeConfigPath`/`commandPaletteShortcut`/`settingsShortcut`/`utf8Btoa`/`buildMcpStdioServerConfig`/`buildCodexEnvToml`/`buildSharedMcpJson`/per-client builders), all now `serverName`-parameterized, plus `snippetForClient` (the per-client dispatch the origin did via an array of closures capturing `t`, now a plain switch returning data instead).
- `ports.ts` / `dependencies.ts` — as described above.
- `react/hooks/useMcpInstallInfo.ts` / `useCodexInstallToggle.ts` — origin's inline `useEffect(() => fetch(...))` and the origin's standalone `CodexInstallToggle()` function, both now hook-shaped and port-driven.
- `react/components/ClientPicker.tsx` (the origin's inline `ds-picker` dropdown), `SnippetBlock.tsx` (the origin's inline `<pre>`+copy-button, now using the package's existing `utils/copy-to-clipboard.ts` instead of a bespoke `navigator.clipboard.writeText` try/catch), `CodexInstallToggleButton.tsx` (wires `useCodexInstallToggle`), `IntegrationsTab.tsx` (orchestrator, takes `serverName` as a prop — no default that reintroduces a product name beyond the generic placeholder).

### Dropped (OD-specific, per the plan's own scope)

`execution` (AMR/Vela wallet + local-CLI agent chrome), `memory` (pre-extracted `MemorySection`, separate task), `media` (per-provider credential cards, duplicates the byok pattern), `mcpClient` (pre-extracted `McpClientSection`, belongs to the separate `features/source-config-list/` cluster per the Consolidation map, not this task), `composio` (Composio key mgmt + embeds `ConnectorsBrowser`), `critiqueTheater` (OD's design-review feature flag), `pet`/`designSystems`/`projectLocations`/`routines` (own files, OD-specific), `about` (OD/Electron version-updater UI), `orbit` (~800 lines, OD's autonomous agent-run automation). Also dropped: the shell's `library` token (a dead-letter `SettingsSection` value routed elsewhere by OD's `EntryShell`, not a real tab) and every `settingsSectionToTracking`/`trackSettings*` analytics call throughout (same convention as every prior tab-porting task in this file).

### i18n

Every user-facing string in every new component routes through `useT()`, English string as key (`t('Close')`, not `t('settings.close')`), per this plan's i18n policy. Pure `rules.ts` functions stay hook-free — `integrations`' `snippetForClient` returns an untranslated `{instructionTemplate, instructionVars}` pair; the component wraps it (`t(resolved.instructionTemplate, resolved.instructionVars)`). Every feature/tab has a real test mounting under `I18nProvider` with a translated dictionary and asserting the translated text actually renders (not just that `t()` compiles), per the policy's own explicit warning about the connectors canary's first-pass mistake.

### Phase 8.5 audit

Ran across every new file: no orphaned `useState`/`useRef` found (`IntegrationsTab`'s `clientId` state and `NotificationsTab`'s `permission`/`testStatus` state are each single-owner, directly bound to their own component, same judgment call the connectors canary made for its `filter`/`selectedProvider`). No inline JSX callback with real multi-statement branching was found — every `onClick`/`onChange` is either a one-line call or a named handler already extracted to the component body. No `useMemo`/`useEffect` body contains unextracted multi-line derivation — `IntegrationsTab`'s only `useMemo` (`resolvedPort`) is a one-line `port ?? createFakeMcpIntegrationsPort()`.

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|open-design\.ai\|openDesignDesktop\|@open-design/"` across every new file under `features/settings-dialog/`: **clean, zero matches.** A stricter self-imposed pass for the literal substring `open-design` (case-insensitive, no word-boundary) found it only inside test assertions proving it is *not* emitted (`rules.test.ts`'s "no builder ever emits the literal open-design" test, `IntegrationsTab.test.tsx`'s `queryByText('open-design')` negative assertion) and inside doc comments describing what the origin hardcoded and this port removed — never in a runtime string literal. Also checked the `od-`-class-prefix convention from the flat-group porting task: every new CSS class in this feature uses the `jini-` prefix (e.g. `jini-settings-section`, `jini-seg-control`), none use `od-`.

### Deviations from a strict read of the task brief

- **Added `@testing-library/jest-dom` as a devDependency** (+ `packages/ui/vitest.setup.ts` import, + `"types": ["@testing-library/jest-dom"]` in `packages/ui/tsconfig.json`) — every prior test file in this package (e.g. `features/connectors`) asserts against plain DOM/element properties (`.disabled`, `toBeNull()`) rather than jest-dom matchers, so this is new tooling, not just new tests. Chosen over rewriting ~20 new test files to avoid matchers because `toBeInTheDocument`/`toHaveAttribute`/`toBeDisabled`/`toHaveValue`/`toHaveTextContent` read significantly clearer for this feature's assertion-heavy tests, and the addition is a pure devDependency with zero runtime/bundle impact — it augments `expect` globally, so every existing test file in the package keeps working unchanged (verified: full package test run stayed at 100% green after adding it).
- **`privacy` shipped**, not left for a "follow-up pass" as the plan doc's item 5 says — see the tab table above for why (first full verification done here, judged small/clean enough to include rather than defer).
- **`SettingsDialogTab`'s `panel`/`icon` fields live in the `react/`-layer prop type, not `types.ts`** — a deliberate reading of the React-layout policy: `types.ts` should have zero *runtime* React import, but a tab descriptor's `panel: ReactNode` is meaningless outside the React layer, so splitting it (`SettingsDialogTabMeta` in `types.ts`, extended by `SettingsDialogTab` in the component file) keeps the pure layer honestly free of React-shaped fields rather than just free of a literal `import react`.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: green (zero errors) — required two `exactOptionalPropertyTypes` fixes (optional destructured hook/prop params need `| undefined` added explicitly to their interface field types, not just `?`) and reusing the existing `LocaleOption` type from `components/LanguageMenu.tsx` instead of declaring a colliding duplicate (the package barrel does `export *` from every feature, so two same-named exports is a real compile error, not just a lint nit).
- `pnpm --filter @jini/ui exec vitest run`: **495 tests, 70 files, all green** (package-wide, including every pre-existing test) — this feature alone contributes 152 new tests across 22 new test files (shell: 15 hook + 14 component; appearance: 6; notifications: 9; language: 4; instructions: 5; privacy: 12 rules + 8 component; integrations: 16 rules + 5 dependencies + 2+5 hooks + 5+5+3+6 components).
- Full monorepo `pnpm -r run typecheck`: fails at `packages/agent-runtime` and `packages/chat-react` (both missing a `tsconfig.json` entirely) — pre-existing, unrelated to this task; the same two packages the connectors canary section above already documented as broken. Verified every other real (non-stub) package individually: `protocol`/`core`/`platform`/`sidecar`/`chat-core`/`ui`/`deploy`(*) all typecheck clean in isolation — `daemon` and `deploy` fail only on cross-package `@jini/protocol`/`@jini/core` resolution because those packages' `dist/` isn't built in this checkout (pre-existing, needs `pnpm -r run build` first, not a regression from this task).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.

---

## Section: `features/source-config-list/` — generic `SourceConfigList<TSource>` (2026-07-18)

Per `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map §A row
`features/source-config-list/`, and r6 §3's cross-cutting pattern table: "URL/OAuth source
add + trust/status + list + per-item test/refresh/remove" is the single most-repeated shape
in the entire 23-file god-component sweep — appears in at least 6 places. This task ships the
4 in scope per the plan's own row (not `ConnectorsBrowser.tsx`, already shipped separately as
`features/connectors/` — confirmed a genuinely different shape, OAuth-catalog-*browse* rather
than add-by-URL/key; not Memory slice's connector reducers either, a rules-level-only future
reuse, flagged below, not this task's UI).

Sources, read in FULL from `/tmp/od-source` (public OD fork, `main` branch, commit
`0b88ef56144b5a42dc427c1292ae22676d698a34`, 2026-07-02 — the same commit already pinned below for
`features/resource-dashboard/`), not the vendored snapshot. This SHA was not recorded when this
section was first written (it cited only the now-gone `/tmp/od-source` checkout with no commit
pin, an unreproducible provenance gap flagged by a 2026-07-18 audit). Re-verified directly against
the real fork clone (`https://github.com/leonaburime-ucla/open-design.git`) via `git show
0b88ef56144b5a42dc427c1292ae22676d698a34:<path>`: `McpClientSection.tsx` is exactly 1,471 lines,
`PluginsView.tsx`'s `SourcesPanel` function starts at exactly line 1402, `EntryShell.tsx`'s
`OnboardingByokSetupPanel` function starts at exactly line 2904, and all 6
`apps/web/src/components/byok/*` files listed below are present at that commit — every cited
location matches exactly, confirming this SHA (not merely a plausible candidate) as the actual
extraction revision:

1. `apps/web/src/components/McpClientSection.tsx` (1,471 lines) — the strongest reference: an
   add-server picker (template categories + custom-blank), a draft-rows-with-bulk-Save-button
   list, per-row expand-to-edit, and a per-row `McpOAuthControl` (OAuth postMessage/focus/
   visibility handshake + fallback polling).
2. `apps/web/src/components/byok/*` (6 files) — `ByokProviderPicker`, `ByokConnectionTestControl`,
   `ByokModelField`, `ByokProviderBaseUrl`, `ByokKeyField`, `validation.ts`: a single-item
   (not list) form for one BYOK provider config — protocol picker, masked API-key field with
   show/hide + cleaned-whitespace notice, base-URL field with default/customize toggle, model
   field with a searchable-select + custom-model fallback, and a connection-test status/button
   control.
3. `apps/web/src/components/PluginsView.tsx`'s `SourcesPanel` (line ~1402) — r6 §1.11 calls this
   the near-exact structural twin of `McpClientSection.tsx`: add-a-marketplace-by-URL form with
   a trust-level `<select>` (`restricted`/`trusted`/`official`), a list of marketplace cards each
   with its own trust `<select>` + Refresh + Remove buttons, no per-item test.
4. `apps/web/src/components/EntryShell.tsx`'s `OnboardingByokSetupPanel` (line ~2904) — r6 §1.7:
   reinforces, does not newly discover, the byok pattern above, inside OD's onboarding flow: a
   protocol-tab strip, a provider quick-fill dropdown, API-key/base-URL/model fields, and both a
   "Fetch models" and a "Test" mini-button with inline running/success/error status text.

Per r6 §3, comparing (1) and (3) side-by-side first (as the task brief required) confirmed they
really are near-identical in shape (add-by-URL form + trust-or-mode select + list + per-item
refresh/remove), which is what let this primitive generalize confidently rather than guessing
from one source and hoping the rest fit.

### What shipped — `packages/ui/src/features/source-config-list/`

Uses the **new** `react/{hooks,components}/` layout end-to-end (per `god-components-extraction-plan.md`'s React-layout policy) — every file with zero React import stays at the feature's top level, everything importing React lives under `react/`.

| File | Contents |
|---|---|
| `types.ts` | Generic `SourceFieldKind`/`SourceFieldSpec`/`SourceFieldValues` (the host-supplied field-config seam), `SourceTrustOption` (host-supplied trust vocabulary — never baked in), `SourceConnectionStatus`/`SourceTestResult`, `SourceConfigItem` (`id`/`label?`/`trust?`/`enabled?`/`fields`/`status?`/`statusMessage?`), `SourceActionKind`, `SourceDraftIssue`/`SourceDraftValidation`, `AddSourceInput`/`AddSourceResult<TSource>`. |
| `constants.ts` | `MASK_CHAR`, `MASKED_VALUE_VISIBLE_SUFFIX_LENGTH`, `MASKED_VALUE_MIN_MASK_LENGTH` — the password-field masking convention (ported in spirit from `ByokKeyField.tsx`'s show/hide, generalized to a "always mask by default, show trailing 4 chars" rule not present verbatim in any one origin file). |
| `rules.ts` | `emptySourceDraft`, `validateSourceDraft` (required-field + `url`-kind http(s) format check, ported from the shared rule underlying both `McpClientSection.tsx`'s `validateRow` and `PluginsView.tsx`'s URL-add flow), `issueForField`, `pendingActionKey`/`isActionPending`/`withPendingAction`/`withoutPendingAction` (per-`(id,kind)` independent in-flight tracking, generalizing the `` `refresh:${marketplace.id}` `` string-key convention `PluginsView.tsx`'s `pendingAction` state already used ad hoc), `upsertSourceById`/`removeSourceById`/`updateSourceById`, `maskFieldValue`, `sourceDisplayLabel`. |
| `ports.ts` | `SourceConfigPort<TSource>` — `fetchSources`/`addSource`/`removeSource` required; `refreshSource`/`setTrust`/`testSource` **optional**, so the React layer derives which per-item actions to render from which methods a host's port actually implements rather than a separate set of boolean flags to keep in sync. `SourceConfigDependencies<TSource>` wraps it. |
| `dependencies.ts` | `createFakeSourceConfigPort`/`createFakeSourceConfigDependencies` — an in-memory fake requiring a host-supplied `createSource` callback (unlike `features/asset-grid/`'s read-only fake, this feature's `addSource` inherently needs to synthesize a `TSource` from an arbitrary host's `AddSourceInput`, so there's no zero-config default — see the file's own header comment). `supportsRefresh`/`supportsTrust`/`supportsTest` let a test/demo scope the fake to exactly the capabilities one origin shape actually has. |
| `react/hooks/useSourceConfigList.ts` | Loads the list, exposes `remove`/`refresh`/`setTrust`/`test` (each independently pending-tracked), `addSourceToList` (local upsert after a successful add, no reload), and `capabilities` (`canRefresh`/`canSetTrust`/`canTest`, derived from which optional port methods exist). Plus `useWiredSourceConfigList` (binds a required `dependencies` — see below for why this one isn't optional-defaulting). |
| `react/hooks/useSourceConfigAddForm.ts` | Owns the add-form draft (values + optional trust), live validation, and submit-through-the-port. Deliberately **not** i18n-aware (per the i18n policy: hooks stay `t`-free; the component wraps `validation.issues[i].message` in `t()` at render time) and deliberately not a `McpClientSection.tsx`-style bulk-dirty-tracked draft-rows-with-Save — see "Dropped" below. Plus `useWiredSourceConfigAddForm`. |
| `react/components/SourceConfigField.tsx` | One field per `SourceFieldSpec`: `text`/`url`/`password`(with show/hide, small local disclosure state)/`select`/`textarea`. |
| `react/components/SourceConfigTestControl.tsx` | Generic per-item status-line + Test/Retry button — simplified descendant of `ByokConnectionTestControl.tsx`'s status/button shape and `McpOAuthControl`'s status/action shape (OAuth-handshake specifics dropped, see below). |
| `react/components/SourceConfigAddForm.tsx` | Renders `fieldSpecs.map(SourceConfigField)` + an optional trust `<select>` (only when `trustOptions` is given) + submit button. Errors only render once a submit has been attempted (ported UX judgment from the byok/onboarding sources' "don't yell before submit" convention). |
| `react/components/SourceConfigItemCard.tsx` | Collapsed summary (label + trust badge) that expands (ported from `McpClientSection.tsx`'s `McpRow` expand-to-edit) to show every field (masked) + capability-gated Refresh/Remove/trust-`<select>`/Test. |
| `react/components/SourceConfigListView.tsx` | Pure composition (props in, JSX out): title/subtitle head, the add form, loading/error/empty states, the item-card list. |
| `react/components/SourceConfigList.tsx` | The orchestrator: composes `useWiredSourceConfigList` + `useWiredSourceConfigAddForm` + `SourceConfigListView`. Also re-exports the two feature hooks so a caller/test can compose them directly without a separate `../hooks/*` import. |
| `index.ts` | Public barrel. |

### Dropped — per source, never silently

**`McpClientSection.tsx`:**
- The categorized template **picker** (`PickerPanel`/`PickerCard`, `CATEGORY_ORDER`, collapsible `<details>` groups, inline search-filter-by-category) — this is a curated-catalog-of-presets UX specific to "which MCP servers does OD recommend," not a generic "add a source" concern. A host wanting a picker composes one itself and calls `addSource` with the chosen preset's field values.
- The **draft-rows-with-a-separate-bulk-Save-button** pattern (`rows`/`savedSig`/`dirty` signature-diff, a single `save()` that validates and PUTs the whole list at once, `useImperativeHandle`'s `save`/`hasDirty` surfaced to a dialog footer). The generic primitive instead adds/removes/updates **immediately per action** — the shape 3 of the 4 origin sources (byok, PluginsView, onboarding) actually use, and the one that composes cleanly with independent per-item pending state. A host that truly wants McpClientSection's specific batch-save UX needs its own wrapper; this primitive doesn't attempt to generalize batch-dirty-tracking.
- `McpOAuthControl`'s OAuth-specific concurrency handshake: `postMessage`/`BroadcastChannel` listening, a 2-second fallback poll with a 5-minute timeout, `window.open` with Electron-`shell.openExternal`-aware null-return handling, and a manual "I've approved — Refresh" fallback button. `SourceConfigTestControl`'s generic `onTest` callback can be *bound* to an OAuth-kicking-off port method, but none of this handshake machinery is generic primitive code — a host with an OAuth-backed source shape re-implements (or reuses `features/connectors/`'s already-shipped `useConnectorAuthorization` handshake logic, a more direct fit for that specific need).
- `McpAgentSupportBanner` (which installed CLI agents receive external MCP servers) — pure OD-runtime-catalog display, no generic analog.
- Row reordering (`moveRow`, ↑/↓ buttons) — no other of the 4 sources has an ordering concept; omitted rather than forced onto shapes that don't need it.
- The env/headers `KEY=VALUE`-per-line textarea convention (`mapToText`/`textToMap`) and the inline "Need help? Map your MCP JSON config" collapsible example panel — MCP-transport-specific, not generic form-field material. A host with a similar need models it as its own `textarea`-kind field and does its own text↔map parsing outside this primitive.

**`byok/*`:**
- `validation.ts`'s **protocol-specific API-key shape validation** — `sk-ant-`/`sk-`/`AIza`/`AQ.` prefix detection, first-party-base-URL-aware "this looks like an OpenAI key, not an Anthropic key" cross-protocol mismatch errors, and `cleanByokApiKey`'s zero-width-character/newline stripping. `rules.ts`'s `validateSourceDraft` only does host-agnostic required/URL-format checks — a host with real per-provider key-shape rules must run its own extra validation before calling `addSource` (the port's `AddSourceResult.message` is the seam for surfacing that failure back to the form).
- `normalizeByokBaseUrl`'s provider-specific URL normalization (auto-adding `https://`, inserting OpenAI's `/v1` path for `api.openai.com`, trimming trailing slashes with protocol-specific exceptions) — not ported; a `url`-kind field only gets a plain http(s)-format check.
- `resolveByokModelPreference`'s explicit/account/provider-default/empty precedence resolution, and `ByokModelField`'s searchable-combobox-with-custom-model-sentinel UX (`SearchableModelSelect`, `CUSTOM_MODEL_SENTINEL`) — model selection here is generalized only as far as `select`/`text`-kind fields go; the "suggested models" hint, the "loaded from account" success message, and the Azure-specific model-fetch hint are all origin-source-specific copy/state this primitive doesn't model.
- `apiKeyConsoleLink`'s per-provider "get an API key" external link — a host with per-provider help links renders its own `SourceConfigField` variant or wraps the primitive; not a generic concept (which provider, which URL).

**`PluginsView.tsx`'s `SourcesPanel`:**
- The **specific trust vocabulary** `restricted`/`trusted`/`official` — never hardcoded in this primitive; a host supplies its own `SourceTrustOption[]` (`trustOptions` prop), which is exactly how the MCP-shaped test scenario below uses a *different* two-value vocabulary (`restricted`/`trusted`) than any origin source used verbatim.
- Marketplace-specific summary metadata: plugin count (`` `${n} plugins` ``), catalog `version` display, and the manifest-`name`-vs-raw-URL title fallback logic tied to `PluginMarketplace.manifest`. Generalized only as far as `sourceDisplayLabel`'s generic "explicit label, else first field value, else id" rule — a host wanting richer per-item metadata composes its own summary line via `SourceConfigItemCard`'s field list (expanded state) rather than a dedicated metadata row.
- `sourceUrlTrackedRef`'s one-time analytics-on-first-focus tracking hook — analytics is host-owned; not part of this primitive at all.

**`EntryShell.tsx`'s `OnboardingByokSetupPanel`:**
- The onboarding-flow-specific **framing**: the protocol-tab strip copy (`API_PROTOCOL_TABS`), the "Quick-fill provider" dropdown pre-filling a whole provider preset (base URL + suggested model) in one click, and the mini-button-with-inline-status-text visual treatment (`onboarding-view__mini-button is-loading`). This primitive's `SourceConfigAddForm`/`SourceConfigTestControl` are deliberately plainer — a host embedding this primitive inside its own onboarding flow supplies its own surrounding chrome/copy.
- The **separate "Fetch models" action** (`onFetchModels`/`modelsState`/`ProviderModelsResponse`, `mergeOnboardingProviderModelOptions`) alongside "Test" — this primitive generalizes only the single "test this source" concept (`testSource`); a host wanting a second independent async action (fetch available models, in this case) composes its own control alongside `SourceConfigItemCard`, there's no second generic port method for it.
- `onboardingProviderModelLabel`/`renderOnboardingProviderTestMessage`/`onboardingTestVariant`'s origin-specific message-formatting logic (embeds the tested model name, latency, and a sample response into localized copy) — `SourceConfigTestResult.message` is a plain host-supplied string; formatting it richly is the host's job via its `testSource` port implementation, not this primitive's.

### Design choices flagged for reviewers

- **`dependencies` is a required prop/param, not optional-defaulting-to-a-fake** (on `SourceConfigList`, `useWiredSourceConfigList`, `useWiredSourceConfigAddForm`) — a deliberate difference from `features/asset-grid/`'s `useWiredAssetGridData`, which can supply a zero-config fake because its port is read-only. This primitive's `addSource` inherently needs a host-specific `createSource: (input) => TSource` to synthesize a new item for an arbitrary generic `TSource`, so there is no generic default that could exist. `createFakeSourceConfigPort`/`createFakeSourceConfigDependencies` are still shipped, per the mandated pattern, for tests and demos — they just require that one callback.
- **A real bug was caught while writing tests, not by inspection**: `rules.ts`'s `sourceDisplayLabel` originally fell back to the *raw, unmasked* first-field value when a source had no explicit `label` — meaning a labelless BYOK-key-shaped source with only an `apiKey` field would leak the full secret into the always-visible card summary row. Fixed to mask the fallback value through the same `maskFieldValue` rule used everywhere else (see `rules.ts`'s doc comment and `rules.test.ts`'s dedicated regression test).
- **Two dead `?? []` fallbacks were refactored away, not tested around**, per Phase 9.5 point 2: `SourceConfigAddForm.tsx` and `SourceConfigItemCard.tsx` each originally computed a separate boolean (`hasTrustOptions`/`showTrustSelect`) to decide whether to render a trust `<select>`, then separately null-coalesced `trustOptions` again inside the JSX — but TypeScript can't narrow through an intermediate boolean, so the `?? []` branch could never actually fire once the boolean was already true. Refactored to narrow `trustOptions` directly in the JSX condition (`trustOptions && trustOptions.length > 0 ? trustOptions.map(...) : null`), which both satisfies the type checker without a fallback and removes the genuinely-unreachable branch instead of writing a test that could never hit it.
- **A real, if minor, UX bug surfaced by the same loop**: neither trust `<select>` (add-form or item-card) had a placeholder `<option>` for "no trust chosen yet" — so with a controlled `value=""` and no matching `<option value="">`, the DOM silently displayed the *first* trust option as selected even though no explicit choice had been made. Added a disabled/hidden placeholder option to both, gated on `!trust`/`!source.trust`.

### BYOK "test before save" fix (2026-07-18 audit)

A 2026-07-18 audit found that `ports.ts`'s own `testSource(id, draft?)` doc comment already promised
support for testing an unsaved draft (the `draft` param), but the shipped implementation contradicted
that promise: the add form had no test control at all, and `SourceConfigList.tsx`'s orchestrator only
ever called `list.test(id)` for an already-persisted item — an unsaved draft has no id, so this flow
was genuinely unrepresentable, not just unwired. Real OD `ByokConnectionTestControl.tsx` (lines 36-42,
75-105) and `EntryShell.tsx`'s `testProviderInline` (lines 2120-2144) confirm the actual origin shape:
the test call is made with the CURRENT FORM FIELD VALUES directly (`testApiProvider({ protocol,
baseUrl, apiKey, model, ... })`), never an item id — there is no id to have yet.

Fixed for real (not narrowed/disclosed-as-dropped), matching the port's own already-stated contract:

- `ports.ts`'s `testSource` signature widened from `testSource(id: string, draft?)` to
  `testSource(id: string | undefined, draft?)` — `id === undefined` is the real "no persisted item
  yet" case; a host implementation branches on it (test the draft directly) vs. a defined `id`
  (test an existing item, optionally with unsaved edits to it).
- `useSourceConfigList.ts`'s `test(id, draft?)` now accepts `id: string | undefined` and keys its
  pending/result tracking (`pendingKeys`/`testResults`) by `id ?? DRAFT_TEST_SCOPE` (a new
  `constants.ts` pseudo-id, `'__draft__'`) — the same "give a not-yet-real id a stable pseudo-key"
  pattern `features/resource-dashboard`'s `BULK_DELETE_SCOPE` already established for its own
  not-scoped-to-one-item bulk-delete tracking.
- `SourceConfigAddForm.tsx` gained an optional test-before-save control (reusing the existing
  `SourceConfigTestControl` presentational component — no new UI primitive needed), rendered only
  when the host's port implements `testSource` at all (`canTest`, mirroring `capabilities.canTest`)
  and disabled while the current draft fails required-field/URL validation (mirroring the origin's
  own `canTestProvider`/`baseUrlValid` gate — testing an incomplete draft isn't meaningful).
- `SourceConfigList.tsx` wires it: `onTest={() => void list.test(undefined, addForm.values)}`,
  `testing={list.isPending(DRAFT_TEST_SCOPE, 'test')}`, `testResult={list.testResults[DRAFT_TEST_SCOPE]}`.
- `createFakeSourceConfigPort`'s `testSource`/`onTest` fake also widened to accept `id: string |
  undefined` (resolving `source` to `undefined` when `id` is `undefined`, since there is nothing
  persisted to look up yet).

Verified with real tests, not just re-reading the source: `useSourceConfigList.test.ts` gained a
regression proving a draft test (`id === undefined`) is forwarded to the port verbatim and its
result is stored under `DRAFT_TEST_SCOPE` — NOT mixed into any real source id's `testResults` entry
— plus a pending-state-isolation regression. `SourceConfigAddForm.test.tsx` gained a `describe`
block covering: the control is absent when `canTest` is false or `onTest` is omitted, it renders and
calls `onTest` when the draft is valid, it stays disabled while the draft is invalid (even before a
submit attempt — deliberately NOT gated on `submitAttempted` like field errors are, since testing
never "yells" the way a submit-validation error does), and it shows running/result state.
`SourceConfigList.test.tsx` gained a full end-to-end regression: render the real add form, type BYOK
draft values, click its own "Test" button BEFORE any submit, and assert the injected port's
`testSource` was called with `(undefined, { apiKey: ..., model: ... })` and the result renders — with
no item card ever created (nothing was persisted). Full package after this fix: 171 source-config-list
tests, all green (up from 162 after the i18n fix, 152 at the pinned audit head).

### MCP enable/edit fix (2026-07-18 audit)

A 2026-07-18 audit found that `types.ts` already declared `SourceConfigItem.enabled`, but nothing in
the shipped port or UI ever rendered or mutated it, and the expanded item card was an entirely
read-only `<dl>` — no way to edit a source's `label`/fields after creation at all. Real OD
`McpClientSection.tsx`'s `McpRow` (lines 779-794, 908-960) supports both: an always-visible
enable/disable checkbox in the collapsed summary row (`onChange({ enabled: e.target.checked })`,
never gated behind expanding the row), and, once expanded, an editable label input plus editable
transport/config fields. The audit also found the existing "MCP-server-shaped source" test describe
block actually proved a *BYOK/marketplace-style trust* interaction (`MCP_TRUST_OPTIONS`), not MCP's
own real shape — `ports.ts`'s own `SourceTrustOption` doc comment states "the origin MCP-server shape
has none" (no trust concept at all), so that test, however useful as the two-shape ABSTRACTION proof
(see below), was never actually representative MCP behavior on its own.

Fixed for real (not narrowed/disclosed-as-dropped):

- `types.ts` gained `SourceUpdateInput` (`{ label?; enabled?; fields? }`) and added `'update'` to
  `SourceActionKind`.
- `ports.ts` gained an optional `updateSource?(id, patch: SourceUpdateInput): Promise<TSource | null>`
  — ONE generic partial-patch method rather than one method per editable property (`setEnabled`,
  `setLabel`, `setFields`, ...), matching the primitive's existing "one capability = one optional
  port method" convention (`refreshSource`/`setTrust`/`testSource`). A host with nothing editable
  after creation simply omits it, same as any other optional capability here.
- `useSourceConfigList.ts` gained `update(id, patch)` (pending-tracked under the new `'update'` kind,
  mirroring `setTrust`) and `capabilities.canUpdate` (derived from `Boolean(port.updateSource)`).
- `SourceConfigItemCard.tsx`: an always-visible enable/disable checkbox in the summary row (rendered
  whenever `source.enabled !== undefined && capabilities.canUpdate` — never gated behind expanding,
  matching the origin exactly), and, once expanded, an "Edit" toggle that swaps the read-only field
  list for editable `SourceConfigField`s (reusing the SAME component the add form uses) plus an
  editable label input, with Save/Cancel committing or discarding the local draft. Deliberately
  immediate-commit-on-Save per source (NOT the cross-row batch-save-with-dirty-signature pattern
  `source-map.md` already documents as dropped from `McpClientSection.tsx` — that pattern tracks
  dirty state across an entire LIST of rows behind one shared Save button; a single card's own
  Save/Cancel is a different, smaller, already-namespaced-as-generic concern).
- `SourceConfigField.tsx` gained an `idPrefix` prop (defaulting to the unchanged
  `'source-config-field'`) — a real bug was caught while writing the end-to-end test for this fix:
  the add form and an item card's new expand-to-edit fields render the SAME `fieldSpecs`
  simultaneously once a card is in edit mode, and the component's DOM id was derived from `spec.key`
  alone with no scoping, producing duplicate ids (and `getByLabelText` ambiguity — an accessibility
  bug, not just a test artifact) whenever both were mounted at once. `SourceConfigItemCard.tsx` now
  passes a per-source `idPrefix` when rendering its edit-mode fields.
- `createFakeSourceConfigPort` gained a `updateSource`/`onUpdate` fake option (defaulting to a plain
  shallow merge — `fields` merged key-by-key, `label`/`enabled` replaced when present in the patch).

Verified with real tests, not just re-reading the source: `useSourceConfigList.test.ts` gained an
`update` describe block (no-op with no port method, patches and persists on success, leaves the
source in place when the port returns `null`, pending-state isolation). `SourceConfigItemCard.test.tsx`
gained two describe blocks: enable/disable (checkbox presence tied to BOTH `source.enabled !==
undefined` AND `capabilities.canUpdate`, calls `onUpdate({ enabled })` without needing to expand
first, disabled while updating) and expand-to-edit (read-only-by-default, Edit reveals editable
inputs seeded with CURRENT values, Save calls `onUpdate` with the edited patch and closes edit mode,
Cancel discards without calling `onUpdate`, Save/Cancel disabled while updating).
`SourceConfigField.test.tsx` gained a regression proving two instances for the same field key never
collide when given different `idPrefix`es. `SourceConfigList.test.tsx` gained a full end-to-end
regression against a real MCP-shaped source with `enabled: true`: click the real always-visible
checkbox (asserts the persisted source's `enabled` actually flipped via a `fetchSources()` round
trip), then expand, click the real "Edit" button, change the label and the URL field, click "Save",
and assert BOTH persisted via another `fetchSources()` call — not just that a callback fired. This is
the "representative MCP interaction proof" the audit asked for, alongside (not replacing) the
existing trust-vocabulary two-shape abstraction test, which is left in place and re-labeled nowhere
— it remains a real, useful proof of the generic trust capability, it is simply not itself proof of
MCP-specific behavior; the new enable/edit test now supplies that. Full package after this fix: 186
source-config-list tests, all green.

### i18n

**Correction (2026-07-18 audit + fix-up):** this section previously claimed "every user-facing
string in every component is wrapped in `t()`" and that `<SourceConfigField error={issue.message}>`
was evidence of that. Both claims were false. `rules.ts`'s `validateSourceDraft` built pre-baked
English sentences (`` `${spec.label} is required.` ``) that rendered straight through, unwrapped;
`SourceConfigField.tsx` rendered host-supplied `spec.label`/`spec.placeholder`/`option.label` raw
(never passed through `t()`); `SourceConfigItemCard.tsx` rendered the trust badge/select
`option.label` and expanded-field `spec.label` raw; `SourceConfigListView.tsx` rendered custom
`title`/`subtitle`/`emptyMessage`/`loadError` raw when a host supplied them. The dedicated i18n
test's dictionary translated only `Add source`/the empty-state string, plus an *identity*
`URL -> URL` entry that could never distinguish "translated" from "never wrapped" — and the suite
never submitted an invalid form, so the raw validation-message path was never exercised at all.

Fixed for real, verified with actual failing-then-passing tests (not just re-reading the source):

- `rules.ts`'s `validateSourceDraft` now returns an i18n-ready TEMPLATE (`'{label} is required.'`,
  `'{label} must be a valid http:// or https:// URL.'`) instead of a baked English sentence —
  `rules.ts` stays hook-free per policy; the render boundary (`SourceConfigAddForm.tsx`) wraps it
  via `t(issue.message, { label: t(spec.label) })`, translating both the template AND the
  interpolated field label.
- `SourceConfigField.tsx` now wraps `spec.label`, `spec.placeholder` (input/textarea/select
  fallback), and every `option.label` in `t()`.
- `SourceConfigItemCard.tsx` now wraps the trust badge (`trustOption?.label ?? source.trust`),
  every trust-`<select>` `option.label`, and each expanded field's `spec.label` in `t()`.
- `SourceConfigListView.tsx` now wraps custom `title`/`subtitle`/`emptyMessage`/`loadError` in
  `t()` (falling back to the existing built-in `t('No sources configured yet.')` etc. when a host
  doesn't override them).
- `SourceConfigAddForm.tsx` also now wraps `addLabel` and `submitError` (a host-suppliable
  `AddSourceResult.message` or the hook's own `'Failed to add source.'` fallback) in `t()`.
- Masking (`maskFieldValue`) and label-derivation (`sourceDisplayLabel`) stay pure with no i18n
  wrapping — they operate on arbitrary host DATA (a source's own field values, an id), not
  translatable vocabulary, matching how `ResourceBoard.tsx`'s item titles are handled elsewhere in
  this package.

Real-provider regression tests were added specifically to close the gap the audit's own citation
described (not just re-running the existing happy-path smoke test): `SourceConfigList.test.tsx`'s
i18n block now includes a real INVALID submission under a dictionary translating both `URL` and
the `'{label} is required.'` template, asserting the fully-translated sentence
(`'Adresse URL est requis.'`) renders — not just the field label alone — plus a second test
translating a host-supplied `select`-kind field's placeholder/option label. `SourceConfigField.test.tsx`,
`SourceConfigItemCard.test.tsx`, and `SourceConfigListView.test.tsx` each gained their own `describe('i18n — ...')`
blocks mounting under a real `I18nProvider` with a non-identity French dictionary and asserting the
translated string actually renders, covering: field label/placeholder/select-option translation,
trust badge/trust-select-option/expanded-field-label translation, and custom title/subtitle/
emptyMessage/loadError translation respectively. All pre-existing tests (162 total after these
additions, up from 152) still pass unmodified in default/passthrough locale.

### Two-shape proof (the actual abstraction test, per the task's own instruction)

`SourceConfigList.test.tsx` exercises the **same** `SourceConfigList<TSource>` component against two
deliberately different injected shapes:

- An **MCP-server-shaped** source (`{ fields: { url: string }, trust?: string }`) with a
  `restricted`/`trusted` trust vocabulary, `refreshSource`+`setTrust` enabled, `testSource`
  disabled (matching the real origin `McpClientSection.tsx` shape, which has no per-item test
  concept in this primitive's sense).
- A **BYOK-key-shaped** source (`{ fields: { apiKey: string, model: string } }`) with **no**
  trust concept at all (`trustOptions` omitted, `setTrust` disabled), `refreshSource` disabled,
  `testSource` enabled with a host-supplied `onTest` returning a custom message.

Both load existing items, add a new item through the generic add form, and — the MCP shape only
— change trust and refresh; the BYOK shape proves the trust `<select>` never renders at all
(`queryByRole('combobox')` is null) and that its labelless summary masks the API key, while the
MCP shape proves its Test button never renders (`queryByRole('button', {name:'Test'})` is null).
Same component, same `rules.ts`, two different `dependencies`/`fieldSpecs`/`trustOptions` —
this is the abstraction actually holding, not two presentational smoke tests.

### Phase 9.5 coverage-driven loop

Quoting the header this task was required to quote: **"Phase 9.5 — Coverage-driven refactor loop
(repeat until ≥99% on all 4 metrics, 100% is the goal)"**, and the coverage-bar changelog's point 1:
**"Coverage bar raised from the original's ≥98% to ≥99% on all 4 metrics, with 100% as the actual
goal (see Phase 9.5) — after 6 extractions landed against the original's 98% floor, one shipped
with a genuine bug and needed a real coverage-driven bug hunt after the fact."**

Ran the classify-then-fix loop once (`json-summary`/`json` reporters, per Phase 9.5's own
instruction that the v8 text table drops rows): every initially-uncovered branch was genuinely
reachable-but-untested (documented above with the tests that now cover them) except the two dead
`?? []` fallbacks, which were refactored away rather than tested around, per Phase 9.5 point 2 —
no `/* v8 ignore */` or any coverage-suppression comment was used anywhere, per Phase 9.5 point 3.
`types.ts`/`ports.ts` (verified interface-only via `grep -nE '^(export )?(const|function|class|let|var) '`
finding no runtime declarations) were added to `vitest.config.ts`'s existing documented
zero-executable-statement carve-out, the same pattern already used for `settings-dialog`'s
`types.ts` files.

**Final coverage (json-summary, 2026-07-18) — 100% on all 4 metrics, every file, no exclusions
needed beyond the two documented interface-only files:**

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `constants.ts` | 100 | 100 | 100 | 100 |
| `dependencies.ts` | 100 | 100 | 100 | 100 |
| `index.ts` | 100 | 100 | 100 | 100 |
| `rules.ts` | 100 | 100 | 100 | 100 |
| `react/hooks/useSourceConfigList.ts` | 100 | 100 | 100 | 100 |
| `react/hooks/useSourceConfigAddForm.ts` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigField.tsx` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigTestControl.tsx` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigAddForm.tsx` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigItemCard.tsx` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigListView.tsx` | 100 | 100 | 100 | 100 |
| `react/components/SourceConfigList.tsx` | 100 | 100 | 100 | 100 |

### Purity grep

`grep -rniE "open design|OD_|--od-stamp|open-design\.ai|openDesignDesktop|@open-design/" packages/ui/src/features/source-config-list/`: **clean, zero matches.**

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: green (zero errors). Needed the same `exactOptionalPropertyTypes`-driven fix the settings-dialog/connectors sections above already document: an optional prop whose value can be explicitly `undefined` at the call site (`SourceConfigAddFormProps.trust`/`submitError`) needs `| undefined` added to its declared type, not just a `?`.
- `pnpm --filter @jini/ui exec vitest run src/features/source-config-list`: **152 tests, 11 files, all green** — `rules.test.ts` (33), `dependencies.test.ts` (17), `useSourceConfigList.test.ts` (16), `useSourceConfigAddForm.test.ts` (10), `SourceConfigField.test.tsx` (11), `SourceConfigTestControl.test.tsx` (8), `SourceConfigAddForm.test.tsx` (11), `SourceConfigItemCard.test.tsx` (21), `SourceConfigListView.test.tsx` (12), `SourceConfigList.test.tsx` (8, including the two-shape proof and the i18n end-to-end test), `index.test.ts` (5, barrel smoke test).
- Full package `pnpm --filter @jini/ui exec vitest run`: **151 files, 1361 tests, all green** — 11 of those 151 files are this feature's new test files (152 of the 1361 tests).
- Full monorepo `pnpm -r run typecheck`: fails only at `packages/agent-runtime` and `packages/chat-react` (both missing a `tsconfig.json` entirely) — the same two pre-existing, unrelated stub-package failures every prior section in this doc has already documented; not touched by this task.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.

### Flag for future work

`features/connectors/`'s `ConnectorsBrowser.tsx` canary and Memory slice's connector-reconciliation
reducers (`mergeMemoryConnector`/`applyMemoryConnectorStatus(es)`/`connectorWithPendingAuthorization`/
`connectorStatusesChanged`, per r6 §2 and this doc's `features/connectors/` section) both independently
manage "a list of connected things, reconcile live status onto it" state — structurally adjacent to
this primitive's `rules.ts` (`upsertSourceById`/`updateSourceById`/`removeSourceById`/
`isActionPending`/pending-key tracking), even though their UI stays separate (OAuth-catalog-browse
vs. add-by-URL/key are genuinely different interaction shapes, confirmed by the consolidation map).
When Memory slice work happens, or when `ConnectorsBrowser.tsx`'s own reducers get revisited, check
whether either can adopt this primitive's `rules.ts` directly (or extract a shared "keyed-list
reconciliation" module both `rules.ts` files import) instead of maintaining three independently-evolving
implementations of essentially the same upsert/status-reconcile logic. Not resolved here — flagged
per the task's own instruction, a rules-level opportunity only, never a UI-level one.

## Section: `features/resource-dashboard/` — DesignsTab.tsx + TasksView.tsx "resource-dashboard shell, twice" (2026-07-18)

Part B of a two-part scheduled task (Part A shipped `features/source-config-list/`, section
above). Per `docs/jini-port/god-components-extraction-plan.md`'s "5 more overlaps" section:

> **Resource-dashboard shell, twice, both directly Run-vocabulary-relevant**: `DesignsTab.tsx`'s
> dashboard shell (§1.17 — sub-tabs, search, bulk-actions, a **config-driven status-kanban** whose
> vocabulary `not_started/running/awaiting_input/succeeded/failed/canceled` "reads like a generic
> agent-run/job lifecycle") and `TasksView.tsx`'s list shells (§1.20 — hero+metric-tile header,
> tabbed template gallery, **row-list-with-expandable-run-history**, "a recognizable generic
> scheduled-job list CRUD shape"). ... evaluate together, likely as one `features/resource-dashboard/`
> (or a name that doesn't presuppose "design" — this is the single most core-engine-relevant cluster
> in the whole sweep and deserves care over speed).

### Provenance

Both sources read in FULL from `/tmp/od-source` (public OD fork, `main` branch, commit
`0b88ef56144b5a42dc427c1292ae22676d698a34`, 2026-07-02), not the vendored snapshot:

1. `apps/web/src/components/DesignsTab.tsx` (1,404 lines).
2. `apps/web/src/components/TasksView.tsx` (1,135 lines).

### The shared-vs-separate verdict: TWO distinct composition shapes, ONE shared low-level primitive

The orchestrator's own pre-read notes hypothesized a "PARTIAL overlap, not a clean single shape and
not two fully unrelated shapes" and explicitly asked for independent verification rather than
presuming either answer. A full read of both files confirms: **genuinely two distinct top-level
composition shapes**, sharing only a thin, genuinely-common layer (a status vocabulary + a
status-badge presentational primitive + a "group items by status" pure rule) — not a shared
dashboard shell. Evidence, quoted with line ranges:

**1. Kanban/status-grouping exists in exactly one of the two files, not both.**
`DesignsTab.tsx` lines 1012–1095 build a real grouped-by-status board:
```
const filtered = filtered.map(...)... // search+sub-sort applied first
{STATUS_ORDER.map((status) => {
  const colProjects = filteredProjects.filter(
    (item) => normalizeStatus(item.project.status?.value ?? "not_started") === status,
  );
  return (<div key={status} className="design-kanban-col">...
```
`STATUS_ORDER` (lines 48–55) is a fixed 6-value array (`not_started`/`running`/`awaiting_input`/
`succeeded`/`failed`/`canceled`), and this is a real column-per-status board, toggle-able against a
card grid via `view: "grid" | "kanban"` state (line 33, persisted to `localStorage` at line
45/277-281). `TasksView.tsx` has **no equivalent anywhere** — grep for `STATUS_ORDER`,
`.filter(.*status`, or any per-status grouping construct across its 1,135 lines returns nothing. Its
only status-vocabulary usage (`statusLabel()`, lines 203-209, and `StatusPill`, lines 211-213) renders
a single row's OR a single run's status as an inline badge — never as a grouping/column key. This
directly falsifies "both express the same shape, just differently" — one origin has a literal kanban
board; the other has never grouped anything by status at any nesting depth, including inside its own
nested run-history sublist (`AutomationRunHistory`, lines 1029–1135, which is itself a flat
chronological list of runs, not grouped/bucketed by status).

**2. The header/toolbar shapes are structurally unrelated.**
`DesignsTab.tsx`'s toolbar (lines 509-693): a sub-tab-pill sort selector (`recent`/`yours` —
confirmed a SORT, not a filter, by reading the `filtered` `useMemo` at lines 343-388, which always
returns every item, just re-ordered), a search input, a select-mode toggle + bulk-delete bar (lines
614-651, only in grid view), and the grid/kanban view toggle. `TasksView.tsx`'s header (lines
636-667): an `<header className="automations-hero">` with an eyebrow/title/lede block and 3 metric
tiles (`Metric` component, lines 1020-1027) plus a single primary CTA button. Zero structural overlap
— no sort selector, no search input, no select-mode, no bulk-delete anywhere in `TasksView.tsx`'s
"your automations" list (the only filtering/tabs in the whole file are in the template gallery
section, lines 909-988, which is create-flow content, not a filter over existing items).

**3. Per-item chrome is a kebab menu in one, always-visible inline buttons in the other.**
`DesignsTab.tsx`'s card kebab menu (lines 842-940): rename/duplicate/delete behind a
`design-card-more` button + popover, with outside-click/Escape dismiss
(`menuContainerRef`/`menuOpenId`, lines 130, 245-261, 844). `TasksView.tsx`'s row actions (lines
756-819): run/history/edit/pause-resume/delete are ALL always-visible inline buttons
(`automation-row__btn`), never collapsed into an overflow menu. This is a real interaction-pattern
difference, not just a visual one — DesignsTab's kanban-card variant (lines 1052-1064) drops the
kebab menu entirely in favor of a single always-visible delete button, closer to TasksView's
always-visible-buttons style, which is itself evidence the kebab-vs-inline choice tracks the SURROUNDING
shell's density (grid card vs. list row), not a fixed universal pattern either file
independently discovered.

**4. The row/item's OWN data shape differs at the type level, not just presentationally.**
DesignsTab's top-level items (`Project`) ARE themselves status-bearing resources — `p.status?.value`
(line 799) is a first-class field driving both the grid card's badge and the kanban column placement.
TasksView's top-level items (`Routine`) are NOT themselves status-bearing in the same sense — a
routine has `enabled`/`schedule`/`nextRunAt`; its `lastRun` (optional, lines 732-753) and its
`runs` (lines 1044-1062, lazy-fetched only on expand) are what actually carry a `RoutineRun['status']`
value. This is why TasksView never groups by status: the thing being listed at the top level isn't a
status-bearing resource at all, just a schedule that OWNS a collection of status-bearing sub-resources
one level down.

**5. Non-overlapping content confirmed present in only one file each**, closing the loop on the
orchestrator's own pre-read hypothesis: DesignsTab's card-grid/cover-thumbnail resolution (lines
942-974, OD-specific html/image/video/logo/brand kind dispatch), select-mode+bulk-delete+kebab-menu,
and `localStorage` view-toggle have no TasksView analog anywhere. TasksView's hero+metrics header,
template gallery (lines 909-988, a curated catalog of automation presets — create-flow content, not
a resource list concern), proposals-review section (lines 837-907, apply/reject an
automation-evolution workflow — no status-bearing-resource-list concept at all), and
inline-expandable-nested-run-history (lines 820-829, 1029-1135) have no DesignsTab analog.

**What IS genuinely shared**, confirmed by direct comparison: `statusLabel()` (DesignsTab lines
1185-1190) and `statusLabel()` (TasksView lines 203-209) are structurally identical functions — a
status-value-to-translated-string lookup, called at a leaf render site to build a small badge/pill.
This is the ONE real shared shape, and it is exactly as small as it looks: a status vocabulary + a
`StatusPill` presentational primitive + a pure "given items and a status order, bucket them into
columns" rule (a generalization of DesignsTab's `STATUS_ORDER.map` + `normalizeStatus`, usable by
ANY future consumer that wants kanban grouping, not just this one).

**Resulting design**: ship ONE feature folder, `packages/ui/src/features/resource-dashboard/`,
containing the shared low-level layer (`StatusPill`, `ResourceMetrics`, `groupItemsByStatus`,
`statusToneFor`, the pending-action-tracking pattern) PLUS two genuinely separate composed
orchestrators built on top of it: `ResourceBoard` (the DesignsTab shape: search/sort/select-mode/
bulk-delete/kebab-menu/grid-kanban-toggle) and `ResourceRowList` (the TasksView shape: hero+metrics+
CTA/flat-row-list/inline-actions/expandable-lazy-loaded-run-history). This is the outcome the task
brief flagged as plausible ("a shared 'status-badged list item + StatusPill' primitive doesn't
necessarily mean the surrounding dashboard shells are one shape") and the evidence above confirms it
directly — forcing both shapes through one composed shell would mean bolting kanban-grouping onto a
shape that never uses it (TasksView), or bolting expandable nested run-history onto a shape that
never had it (DesignsTab).

### What shipped — `packages/ui/src/features/resource-dashboard/`

Uses the `react/{hooks,components}/` layout throughout (zero-React files at the feature top level).

| File | Contents |
|---|---|
| `types.ts` | Shared: `ResourceStatusOption`, `ResourceStatusTone`/`ResourceStatusToneMap`. Board-shape: `ResourceBoardViewMode`, `ResourceSortOption`, `ResourceMenuActionSpec`, `ResourceBoardItem<TBody>` (generic `body` render-slot, `sortValues` keyed-by-sort-option map, `menuActions`). Row-list-shape: `ResourceMetric`, `ResourceRowAction`, `ResourceRowItem`, `ResourceRunHistoryItem`. |
| `constants.ts` | `DEFAULT_STATUS_TONE`, `UNMATCHED_STATUS_BUCKET`, `DEFAULT_BOARD_VIEW_MODE`. |
| `rules.ts` | Shared: `statusToneFor`, `pendingActionKey`/`isActionPending`/`withPendingAction`/`withoutPendingAction` (re-derived fresh, NOT imported from `source-config-list` despite identical shape — see "Design choices" below). Board-shape: `groupItemsByStatus` (generalizes `STATUS_ORDER.map`, with an `UNMATCHED_STATUS_BUCKET` catch-all so an unrecognized status is never silently dropped — DesignsTab itself has no such case since every `Project` defaults to `not_started`, but a generic primitive can't assume that), `filterBoardItemsByQuery`, `sortBoardItems` (generic over a host-supplied `sortValues` map, since DesignsTab's `recent`/`yours` sort by two different `Project` timestamp fields), `toggleSelectedId`, `pruneSelectedIds`. |
| `ports.ts` | `ResourceBoardPort<TItem>` (`fetchItems`/`deleteItem` required, `renameItem`/`duplicateItem` optional — no "add" method at all, since both origins delegate creation entirely to host UI), `ResourceViewModeStoragePort` (scoped by a host-supplied `scopeKey`, never DesignsTab's literal `"od:designs:view"`), `ResourceRowListPort<TRow>` (`fetchRows` required, `fetchRowHistory` optional — everything else TasksView's rows can DO is host-dispatched, not a port method, see below). |
| `dependencies.ts` | `createFakeResourceBoardPort`/`createFakeResourceRowListPort` — both can ship genuinely useful zero-config defaults (unlike `source-config-list`'s fake, which needs a required `createSource` callback) precisely because neither port has an "add" concept. `createLocalStorageViewModeStorage` — real, SSR-guarded `localStorage`-backed default (same "browser-only generic behavior ships as a real implementation, not a fake" reasoning as `features/browser-chrome`'s history storage). |
| `react/components/StatusPill.tsx` | The one genuinely shared UI primitive (see verdict above). |
| `react/components/ResourceMetrics.tsx` | Generalizes TasksView's `Metric` tile row over an arbitrary host-supplied list. |
| `react/components/ResourceCard.tsx` | DesignsTab's `design-card`: click-to-open/toggle-select, select-mode checkbox XOR kebab menu, status pill, host `renderBody` slot (cover-thumbnail resolution stays host-owned). |
| `react/components/ResourceKanbanBoard.tsx` | The status-grouped board — a deliberately LIGHTER card than `ResourceCard` (no select-mode, no kebab menu, no visible status pill — status conveyed by column + a CSS class only, matching the origin's own `design-kanban-card` exactly, confirmed by reading that branch specifically rather than assuming symmetry with the grid card). |
| `react/components/ResourceBoardToolbar.tsx` | Sort pills + search + select-mode/bulk-delete bar (grid-view-only) + view toggle + optional create button. |
| `react/components/ResourceBoardView.tsx` | Pure composition: toolbar + loading/error/two-distinct-empty-states (no-items-at-all vs. search-matched-nothing, DesignsTab's own distinction) + grid-or-kanban. |
| `react/hooks/useResourceBoard.ts` + `useWiredResourceBoard` | Owns search/sort/view-mode-persistence/select-mode/bulk-delete/the single-open-at-a-time kebab menu (with a REAL outside-click/Escape dismiss bug found and fixed while writing tests — see below)/kanban-column derivation. |
| `react/components/ResourceBoard.tsx` | Orchestrator. `rename`/`duplicate`/`delete` menu-action kinds are natively understood (mapped to the matching port method or, for `rename`, bubbled to `onRenameRequest` since it needs a text input this primitive doesn't collect — no `Dialog` is ported, see Dropped); any other kind bubbles to `onCustomItemAction`. |
| `react/components/ResourceRunHistoryList.tsx` | TasksView's `AutomationRunHistory` sublist: loading/empty states, a `StatusPill` + timing per run, an optional error/summary message, host-defined actions. |
| `react/components/ResourceRowListItem.tsx` | One row: title/meta/detail lines, last-run `StatusPill`, ALWAYS-VISIBLE inline action buttons (never a kebab — see verdict point 3), an optional history-expand toggle, the expanded sublist. |
| `react/components/ResourceRowListView.tsx` | Pure composition: hero header (eyebrow/title/lede) + metrics + CTA + a clickable empty state (TasksView's own empty state IS the create button) OR the row list. |
| `react/hooks/useResourceRowList.ts` + `useWiredResourceRowList` | Owns row loading, a generic `dispatchRowAction` (busy-tracks + reloads + refreshes the expanded row's history on success — mirrors TasksView's own `runNow` bumping `historyTick`), and expand/collapse with re-fetch-on-every-expand (not cached, matching the origin). |
| `react/components/ResourceRowList.tsx` | Orchestrator. `onRowAction` is REQUIRED and bubbles for every action kind (unlike `ResourceBoard`, nothing is natively understood here — see ports.ts). |
| `index.ts` | Public barrel — `isActionPending`/`pendingActionKey`/`withPendingAction`/`withoutPendingAction` deliberately NOT re-exported (see Design choices). |

### Dropped — per source, never silently

**`DesignsTab.tsx`:**
- Cover-thumbnail resolution across html/image/video/logo/brand kinds (lines 1240-1352,
  `projectCover`/`ProjectBrandCover`/`brandHostname`) — entirely OD-specific file-kind dispatch and
  brand-logo-fallback-chain logic. `ResourceBoardItem.body` + `ResourceCard`'s `renderBody` slot is the
  seam a host uses instead.
- Rename/delete/bulk-delete confirmation dialogs (`Dialog`/`DialogFooter` from `@open-design/components`,
  lines 1097-1163) — a third-party product component library, not ported. `ResourceBoard`'s `rename`/
  `duplicate`/`delete` methods perform the mutation directly with no confirm step; a host wanting
  confirmation wraps its own dialog around the call (same "host-owned modal chrome" pattern already
  established — no feature in this package has ported a generic `Dialog` primitive).
- Analytics tracking calls threaded through nearly every handler (`trackProjectsListClick`,
  `trackProjectsListControlsClick`, `trackProjectsMorePopoverClick`, `trackPageView`) — host-owned,
  analytics is cross-cutting concern territory per this package's existing convention (see
  `features/connectors`'/`features/asset-grid`'s own "analytics is host-owned" notes).
- The manual-refresh button and 15-second auto-refresh polling (`refreshProjectsList`,
  `PROJECTS_AUTO_REFRESH_MS`, lines 46, 287-341) — not ported; a host wanting this composes it around
  the hook's exposed `reload()`.
- `Toast`-based success/error notifications after bulk-delete (lines 1164-1174) — host-owned; the
  hook's `bulkDelete()` return value (`{ deleted, failed }`) is the seam.
- Live-artifact-specific card variant (`liveArtifactCardTitle`/`liveArtifactCardMetaLead`/
  `artifactStatusLabel`, lines 1204-1237, and the whole `item.type === "live-artifact"` branch) —
  a second, OD-specific item shape layered onto the same grid, not generalized (a host with a
  similarly dual-shaped list composes two `ResourceBoardItem[]` arrays itself).

**`TasksView.tsx`:**
- The entire template-gallery section (lines 909-988, plus `buildAutomationTemplates`/
  `filterTemplates`/`templateFilters`/the 6 hardcoded `buildStaticTemplates` presets, lines 58-331) —
  a curated create-flow catalog, a fundamentally different concern from listing existing resources
  (confirmed by the shared-vs-separate analysis above: this section has no DesignsTab analog at all).
- The proposals-review section (lines 837-907, `AutomationEvolutionProposal` apply/reject workflow,
  `proposalTargetLabel`/`proposalActionLabel`) — OD's automation-evolution-specific feature, no
  generic resource-list analog.
- The `crystallize` action (lines 564-595, 1097-1111) — a specific OD workflow (turn a successful
  run into review-able proposals). `ResourceRunHistoryItem.actions` generalizes only the OTHER kept
  action ("open"/"view progress"); crystallize's own semantics (and its dedicated `crystallizingRunId`
  busy-state, separate from the generic row-busy tracking) are not ported.
- `NewAutomationModal` (the create/edit form + REST wiring) — entirely host-owned; `onCreate`/
  `onRowAction`'s `'edit'` kind are the seams a host wires its own modal through.
- `scheduleStatusLabel`/`nextRunLabel`/`formatAutomationTimestamp`/`formatRunDuration` (lines
  172-201) — OD's `Routine`/`RoutineRun`-specific formatting logic. `ResourceRowItem.metaLine`/
  `detailLine` and `ResourceRunHistoryItem.startedAtLabel`/`durationLabel` are pre-formatted
  host-supplied strings; this primitive never re-derives them.
- Analytics (`fireClick`/`trackAutomationsClick`/`trackPageView`) — host-owned, same as DesignsTab.
- `window.confirm` before delete (line 618) — a bare browser confirm, itself a UX choice; not baked
  into this primitive's `dispatchRowAction`, same "host wraps its own confirmation" reasoning as
  DesignsTab's dropped `Dialog`.

### Mutation error handling and run-history race/failure fix (2026-07-18 audit)

A 2026-07-18 audit found two real, undisclosed behavior regressions (distinct from the
deliberately-disclosed "Dropped" list above, which covers intentional simplifications, not bugs):

1. **Resource mutations lost visible failure handling.** `useResourceBoard.ts`'s `remove`/
   `duplicate` let a rejected `port.deleteItem`/`duplicateItem` propagate uncaught;
   `ResourceBoard.tsx`'s `handleItemAction`/`onKanbanDelete` called them with a bare `void`, which
   discards a promise's return value WITHOUT attaching a rejection handler — both an unhandled
   rejection and, because nothing ever surfaced a message, a delete/duplicate could silently fail
   with the item still shown and no explanation. Real OD `DesignsTab.tsx`'s own
   `handleDuplicateProject` (lines 440-449) catches exactly this into a toast. Fixed by adding an
   `actionError: string | null` field to `ResourceBoardController`, set (and cleared at the start
   of the next call) inside `remove`/`duplicate`'s own `catch`, so both hook methods now always
   resolve (never reject) while still surfacing a visible message. `ResourceBoardView.tsx` renders
   it as its own `actionError`/`actionErrorLabel` banner ALONGSIDE the still-visible item list
   (deliberately NOT reusing `error`/`errorLabel`, which is the LOAD failure and hides the whole
   list — a mutation failure must not hide items that already loaded fine).
   `useResourceRowList.ts`'s `dispatchRowAction` has an explicit, tested contract ("a rejection
   propagates to the caller and does NOT reload") that a fix must not break; instead of catching
   silently, it now records the same kind of `actionError` in its own `catch` and then RE-THROWS,
   preserving that contract for a caller that awaits/catches directly while giving a
   fire-and-forget caller (`ResourceRowList.tsx`'s `onRowAction`) a real value to render.
   `ResourceRowList.tsx` was also changed to attach `.catch(() => {})` to the now-still-rethrown
   promise — `void` alone does not prevent an unhandled rejection, it only discards the resolved
   value. `ResourceRowListView.tsx` gained the matching `actionError`/`actionErrorLabel` banner.
2. **Run-history loading lost real OD's cancellation and failure semantics.**
   `useResourceRowList.ts`'s `fetchHistoryFor` had no `catch` at all — a rejected
   `port.fetchRowHistory` was an unhandled rejection AND left `historyByRowId[id]` `undefined`
   forever, which `ResourceRunHistoryList.tsx` renders as a permanent "Loading…" (its
   `items === undefined` check). Separately, collapsing then re-expanding the SAME row before its
   first fetch settled started a second, overlapping fetch for that id with no protection against
   the OLDER one resolving after the newer one and overwriting fresh history with stale data. Exact
   OD `TasksView.tsx` (lines ~1044-1062) catches a failure to an empty result and effectively
   ignores stale responses. Fixed with a per-row request-generation counter
   (`historyRequestSeqRef`): each `fetchHistoryFor(id)` call captures its own sequence number at
   start, and both the success and failure branches (plus the loading-flag clear in `finally`) check
   whether they're still the most recent request for that id before committing anything — a stale
   response is silently discarded rather than applied. A genuine failure now commits an empty array
   (matching OD) instead of leaving history stuck at `undefined`.

Both fixes are covered by new mounted/hook tests, not just re-reading the source: `useResourceBoard.test.ts`
gained `remove`/`duplicate` rejection regressions (`actionError` set, cleared on retry, item never
optimistically removed on a rejected delete) and `ResourceBoard.test.tsx` gained end-to-end
regressions clicking the real kebab-menu delete/duplicate actions against a rejecting fake port and
asserting the translated banner renders while the existing items stay on screen.
`useResourceRowList.test.ts` gained a rejected-`fetchRowHistory`-commits-empty-array regression, a
genuine overlapping-same-row race regression (older response resolves after the newer one; asserts
the newer data survives), and `dispatchRowAction` `actionError` regressions; `ResourceRowList.test.tsx`
gained an end-to-end regression clicking a real row action against a rejecting `onRowAction` and
asserting the translated banner renders without hiding the row. `ResourceBoardView.test.tsx`/
`ResourceRowListView.test.tsx` gained direct prop-level tests for the new `actionError`/
`actionErrorLabel` props (present, absent, falls back to raw string, renders alongside — not instead
of — the list).

### Design choices flagged for reviewers

- **`isActionPending`/`pendingActionKey`/`withPendingAction`/`withoutPendingAction` are re-derived
  fresh in this feature's `rules.ts`, not imported from `features/source-config-list`**, even though
  they are byte-for-byte the same pattern (confirmed while writing this feature — both independently
  generalize "track an in-flight action per `(id, kind)` key" from their respective origin's ad hoc
  string-key convention). Per this package's own "share only what correctness forces" rule (no
  shared/app-level layer), and per the **fixing-open-design-web** skill's hooks discipline
  ("duplication across slices is welcome; share only what *correctness* forces"), this is the correct
  call — but it does mean the SAME helper now exists twice in the package under the same names. To
  keep the package's own public barrel unambiguous, this feature deliberately does NOT re-export
  these four names from its `index.ts` (they stay internal, used only by this feature's own hooks) —
  `features/source-config-list` already publishes them at the package barrel; a host needing this
  exact utility uses that one. A real `TS2308` ambiguous-export compiler error at `src/index.ts` is
  what caught this during `pnpm --filter @jini/ui run typecheck`, not a design review — flagged here
  as a genuine, if narrow, argument for eventually promoting this pattern to a shared
  non-feature-owned module (a `src/utils/` helper, e.g.) rather than letting a third independent
  copy appear the next time this shape recurs (r6 §3's cross-cutting pattern table already lists
  "Progress bar + status icon + step/todo list" as a related, not-yet-extracted third instance in
  `DesignSystemFlow.tsx`). Not resolved here — flagged for a future consolidation pass, same spirit
  as the `features/connectors`/`features/source-config-list` rules-level reuse flag already recorded
  above in this document.
- **`ResourceRowList`'s `onRowAction` bubbles EVERY action kind, unlike `ResourceBoard`'s native
  rename/duplicate/delete handling.** This asymmetry is intentional, not an inconsistency: DesignsTab's
  kebab menu has a small, fixed, cross-source-stable vocabulary (rename/duplicate/delete — the exact
  3 methods `ResourceBoardPort` already needs), whereas TasksView's row actions (run/edit/
  pause-resume/delete) have no such fixed, generalizable semantics — "pause/resume" alone requires
  toggling arbitrary host state with no universal shape, and "edit" always opens host UI. Rather than
  invent 1-2 native port methods and leave the rest host-dispatched (an arbitrary, hard-to-predict
  split), `ResourceRowList` dispatches ALL of them uniformly, letting the host's single `onRowAction`
  implementation branch on `kind` itself.
- **A real bug was caught while writing `ResourceBoard`'s own orchestrator tests, not by inspection**:
  the kebab menu's outside-click dismiss effect (`useResourceBoard.ts`) closed on ANY `window`
  `mousedown`, including a mousedown on the menu's OWN items — so clicking Rename/Duplicate/Delete
  inside an already-open menu closed the menu (via the native `mousedown` bubbling to `window`,
  BEFORE React's synthetic `click` handler could fire) before the click could ever register. Every
  "dispatch a native menu action" test failed cleanly, catching this immediately rather than shipping
  a silently-broken menu. Fixed with a `menuContainerRef` containment check — DesignsTab's OWN
  pattern (`menuContainerRef`/`el.contains(e.target)`, lines 130, 247-249), which this port had
  initially simplified away and shouldn't have. Threaded through `useResourceBoard` ->
  `ResourceBoardView` -> `ResourceCard`, with a dedicated regression test in
  `useResourceBoard.test.ts` (`stays open on a mousedown INSIDE menuContainerRef`) so this exact
  regression can't silently reappear.
- **Two Phase 9.5 dead-branch refactors, not tested around** (see the coverage section below for the
  full loop): `ResourceBoard.tsx`'s `kanbanColumns` lookup and rename-target lookup both originally
  had a defensive `??`/`?.` fallback that can never actually fire given this component's own call
  contract; `useResourceRowList.ts`'s `fetchHistoryFor` had a dead `port.fetchRowHistory` existence
  guard for the same reason (every call site already guarantees it). All three replaced with a
  non-null assertion plus an explanatory comment, per the skill's Phase 9.5 point 1's
  "TS-required fallback with no real runtime path" classification.

### `RunState` vocabulary-reconciliation note (flagged, NOT resolved — out of scope for this task)

Per the task brief, this UI primitive's status vocabulary is close to, but not identical with,
`@jini/protocol`'s own `RunState`:

- `@jini/protocol`'s `RunState` (`packages/protocol/src/run.ts`): `['queued', 'starting', 'running',
  'succeeded', 'failed', 'cancelled']` — 6 values, spelled `cancelled`.
- DesignsTab's `STATUS_ORDER`: `['not_started', 'running', 'awaiting_input', 'succeeded', 'failed',
  'canceled']` — 6 values, spelled `canceled`; has `not_started`/`awaiting_input` with no `RunState`
  analog; has no `queued`/`starting` analog (its own `normalizeStatus` actually MAPS `queued` onto
  `running` for display purposes — DesignsTab's `ProjectDisplayStatus` type is a superset that
  includes `queued` as a raw value even though `STATUS_ORDER`/the kanban board never surfaces it as
  its own column).
- TasksView's `RoutineRun['status']` (`statusLabel()`, lines 203-209): `succeeded`/`failed`/`running`/
  `queued`/`canceled` — 5 values, spelled `canceled`; no `starting`/`not_started`/`awaiting_input`
  analog at all — the narrowest of the three vocabularies.

This feature's own `ResourceStatusOption[]`/`ResourceStatusToneMap` types (`types.ts`) are
DELIBERATELY generic string-keyed maps with no hardcoded vocabulary at all — neither DesignsTab's nor
TasksView's status values are baked into this primitive anywhere; a host supplies whichever
vocabulary its own domain needs (see `ResourceBoard.test.tsx`/`ResourceRowList.test.tsx`, which each
use their own literal `STATUS_OPTIONS` array, not an imported constant). This means when a future
Jini `RunsView`/job-dashboard consumer wires this primitive to `@jini/protocol`'s real `RunState`,
that consumer supplies `statusOptions: [{value: 'queued', label: 'Queued'}, ...]` matching
`RUN_STATES` verbatim (spelled `cancelled`, no `not_started`/`awaiting_input`) — no code in this
primitive needs to change for that to work, since the vocabulary is a runtime prop, not a compile-time
union. The THREE-WAY spelling/vocabulary mismatch (`cancelled` vs. `canceled` vs. `canceled`, and the
`not_started`/`awaiting_input`/`starting` non-overlaps) is real and will need a decision when that
wiring actually happens (does a future `RunsView` normalize `RunState` into a DesignsTab-shaped
6-value display vocabulary with synthetic `not_started`/`awaiting_input` states derived from
elsewhere, or does it accept a narrower kanban with only `RunState`'s own 6 values and no
`awaiting_input` column?) — flagged here per the task's explicit instruction, deliberately NOT
resolved, since resolving it requires knowing how a real `RunsView` consumer wants to present
`awaiting_input`-shaped states (which don't exist in the engine's `RunState` at all — that would be
an application-level concept layered on top, e.g. a paused-for-input tool-call).

### i18n

Every user-facing string in every component (`StatusPill`, `ResourceMetrics`, `ResourceCard`,
`ResourceKanbanBoard`, `ResourceBoardToolbar`, `ResourceBoardView`, `ResourceRunHistoryList`,
`ResourceRowListItem`, `ResourceRowListView`) is either passed in pre-translated (leaf/pure-composition
components take `statusLabel`/`errorLabel`/etc. as already-resolved strings, never call `t()`
themselves) or wrapped via `useT()` at the two orchestrators (`ResourceBoard`/`ResourceRowList`),
which is where every literal English string this primitive owns (`'Search…'`, `'Select'`, `'Delete
selected'`, `'New'`, `'History'`, `'No items yet.'`, etc.) is wrapped in `t()`, following this
package's "the English string itself is the key" convention. `rules.ts` stays hook-free (pure);
`statusToneFor` and `groupItemsByStatus` never produce user-facing text, only tone/grouping keys.
`ResourceBoard.test.tsx` and `ResourceRowList.test.tsx` each have a dedicated i18n end-to-end test
mounting the full orchestrator under `I18nProvider` with a real dictionary and asserting the
translated strings actually render (not just the unconfigured passthrough case) — e.g.
`ResourceRowList.test.tsx`'s test asserts `'No items yet.'` (unconfigured) resolves to the French-ish
`'Rien pour le moment'` string via a mounted dictionary.

### Phase 9.5 coverage-driven loop

Quoting the header this task was required to quote: **"Phase 9.5 — Coverage-driven refactor loop
(repeat until ≥99% on all 4 metrics, 100% is the goal)"**, and the coverage-bar changelog's point 1:
**"Coverage bar raised from the original's ≥98% to ≥99% on all 4 metrics, with 100% as the actual
goal (see Phase 9.5) — after 6 extractions landed against the original's 98% floor, one shipped
with a genuine bug and needed a real coverage-driven bug hunt after the fact."**

Ran the classify-then-fix loop once (`json-summary`/`json` reporters, per Phase 9.5's own
instruction that the v8 text table drops rows). Every initially-uncovered branch/line was classified
per Phase 9.5 point 1:
- **Genuinely reachable, just untested** (the large majority): a `toneMap`-threading branch left
  untested in four components (`ResourceBoard`/`ResourceRowList`/`ResourceRowListItem`/
  `ResourceRowListView`), an `eyebrow`/`lede` branch and an unmatched-status label-fallback branch in
  `ResourceRowList.tsx`, the grid-view-mode toggle button (only kanban had been clicked in existing
  tests), and a message-without-`isError` branch in `ResourceRunHistoryList.tsx` — all closed with
  real, behavior-asserting tests, not padding.
- **A genuine race-condition branch, not previously exercised**: `useResourceRowList.ts`'s
  `historyLoadingRowId` clear-on-settle logic (`current === id ? null : current`) guards against an
  OLDER, slower history fetch for row A finally resolving AFTER the user has already switched the
  expanded row to B (and B's own fetch already cleared/set the loading flag) — closed with a
  dedicated test using a manually-controlled deferred Promise to force that exact interleaving,
  documented in the test as a real (if narrow) behavior this primitive protects, not a padding test.
- **Dead branches, refactored away rather than tested around** (Phase 9.5 point 1, "Dead branch"
  classification): `ResourceBoard.tsx`'s `kanbanColumns` lookup (`board.kanbanColumns.get(...) ?? []`)
  and rename-target lookup (`current?.title ?? ''`), plus `useResourceRowList.ts`'s
  `fetchHistoryFor`'s `if (!port.fetchRowHistory) return;` guard — all three provably unreachable
  given this component/hook's own internal call contract (documented per-site above in "Design
  choices"), replaced with a non-null assertion and an explanatory comment each, per Phase 9.5 point
  1's "TS-required fallback with no real runtime path" classification.
- No `/* v8 ignore */` or any coverage-suppression comment was used anywhere, per Phase 9.5 point 3.

`types.ts`/`ports.ts` (verified interface-only via `grep -nE '^(export )?(const|function|class|let|var) '`
finding no runtime declarations in either) were added to `vitest.config.ts`'s existing documented
zero-executable-statement carve-out, the same pattern already used for `settings-dialog`'s and
`source-config-list`'s `types.ts`/`ports.ts` files.

**Final coverage (json-summary, 2026-07-18) — 100% on all 4 metrics, aggregate AND every individual
file, no exclusions needed beyond the two documented interface-only files:**

Aggregate: **1204/1204 statements (100%), 488/488 branches (100%), 73/73 functions (100%), 1204/1204
lines (100%).**

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `constants.ts` | 100 | 100 | 100 | 100 |
| `dependencies.ts` | 100 | 100 | 100 | 100 |
| `index.ts` | 100 | 100 | 100 | 100 |
| `rules.ts` | 100 | 100 | 100 | 100 |
| `react/components/StatusPill.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceMetrics.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceCard.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceKanbanBoard.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceBoardToolbar.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceBoardView.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceBoard.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceRunHistoryList.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceRowListItem.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceRowListView.tsx` | 100 | 100 | 100 | 100 |
| `react/components/ResourceRowList.tsx` | 100 | 100 | 100 | 100 |
| `react/hooks/useResourceBoard.ts` | 100 | 100 | 100 | 100 |
| `react/hooks/useResourceRowList.ts` | 100 | 100 | 100 | 100 |

(`types.ts`/`ports.ts` excluded per the documented zero-executable-statement carve-out — both
interface-only, no runtime declarations.)

### Purity grep

`grep -rniE "open design|OD_|--od-stamp|open-design\.ai|openDesignDesktop|@open-design/" packages/ui/src/features/resource-dashboard/`: **clean, zero matches** (exit code 1).

### Test/typecheck/guard results

- `pnpm --filter @jini/ui run typecheck`: green (zero errors).
- `pnpm --filter @jini/ui exec vitest run src/features/resource-dashboard`: **253 tests, 16 files, all
  green** — `rules.test.ts` (27), `dependencies.test.ts` (25), `index.test.ts` (6),
  `useResourceBoard.test.ts` (35), `useResourceRowList.test.ts` (18), `StatusPill.test.tsx` (5),
  `ResourceMetrics.test.tsx` (2), `ResourceCard.test.tsx` (17), `ResourceKanbanBoard.test.tsx` (11),
  `ResourceBoardToolbar.test.tsx` (18), `ResourceBoardView.test.tsx` (17), `ResourceBoard.test.tsx`
  (19, including the two-orchestrator native-action-dispatch tests and the i18n end-to-end test),
  `ResourceRunHistoryList.test.tsx` (12), `ResourceRowListItem.test.tsx` (11),
  `ResourceRowListView.test.tsx` (16), `ResourceRowList.test.tsx` (15, including the i18n end-to-end
  test).
- Full package `pnpm --filter @jini/ui exec vitest run`: **167 files, 1614 tests, all green** — 16 of
  those 167 files are this feature's new test files (253 of the 1614 tests).
- Full monorepo `pnpm -r run typecheck`: `packages/ui typecheck: Done` (clean). Failures exist
  elsewhere in the monorepo (`packages/agent-runtime`, `packages/chat-react`, `packages/cli`,
  `packages/http`, `packages/node-host`, `packages/renderers-react`, `packages/sqlite` — all missing
  a `tsconfig.json` entirely; `packages/daemon`/`packages/deploy` — unresolved `@jini/protocol`/
  `@jini/core` module references, apparently missing built `dist` output in this session) — **all
  pre-existing, entirely unrelated to this task** (this task touched only `packages/ui`); a strictly
  larger failing-package set than the two (`agent-runtime`/`chat-react`) the prior
  `source-config-list` section documented, most plausibly because this session never ran a full
  `pnpm install`/build across the workspace before starting, not because of anything this task
  changed — flagged for the record, not fixed (out of scope for a `packages/ui`-only task).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)`
  — unchanged, no boundary violations introduced.
