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

## Section: flat atoms — `scrollWorkspaceTabsWithWheel` + `DesignSystemFlow` color math (2026-07-18)

Scope: two small, independent bucket-A atoms from `docs/jini-port/god-components-extraction-plan.md`'s
Consolidation map §C ("Flat `components/`/`hooks/`/`utils/`"), dispatched narrower than the task's
original scope — `FileViewer.tsx`'s `CodeWithLines`/`JsonPanel` were pulled out to a future
`FileViewer.tsx` full-read session (per `todo.md`) rather than done here.

Source: fresh clone of `leonaburime-ucla/open-design` at commit `0b88ef56144b5a42dc427c1292ae22676d698a34`
(2026-07-02), not the vendored `integrations/open-design/reference/` snapshot. Both source files
(`apps/web/src/components/FileWorkspace.tsx`, 5,709 lines; `apps/web/src/components/DesignSystemFlow.tsx`,
5,439 lines) were read in full around their target regions, not sampled, to confirm the exact
generic/OD-specific boundary before extracting.

### `src/utils/scroll-tabs-with-wheel.ts` ← `FileWorkspace.tsx`'s `scrollWorkspaceTabsWithWheel`

Ported near-verbatim (logic unchanged) from `FileWorkspace.tsx:5536-5558` (`scrollWorkspaceTabsWithWheel`
+ its private `wheelDeltaToPixels` helper). Already fully generic in the origin — it took only
`Pick<HTMLDivElement, ...>`/`Pick<WheelEvent, ...>` shapes, zero OD types, zero product strings.
Renamed `scrollWorkspaceTabsWithWheel` → `scrollTabsWithWheel`: "Workspace" named OD's specific
`FileWorkspace` tab strip, not a generic concept — the function itself works for any horizontal,
overflowing tab strip (this is also the shape `docs/jini-port/god-components-extraction-plan.md`'s
still-open `features/tab-strip/` consolidation target would want, per the Consolidation map §A). Shipped
as a plain exported function in `src/utils/` (matching `dom-subscriptions.ts`'s precedent for DOM-event
utilities that aren't themselves React hooks), not `src/hooks/` — despite the plan doc's own §C listing
it under "Hooks," it calls no React hook internally and the origin only ever invoked it manually inside a
caller's own `useEffect`/`addEventListener`, so a `src/hooks/useX` shape would be a fabricated wrapper
around a function that is already correctly hook-free.

No i18n: zero user-facing strings (pure DOM-math event handler).

### `src/utils/color-math.ts` ← `DesignSystemFlow.tsx`'s hex/luminance/mix helpers

Ported `normalizePreviewHex`/`previewRgb`/`previewLuminance`/`mixPreviewHex`/`toHexByte`/`readableTextColor`
(`DesignSystemFlow.tsx:4547-4616`) → `normalizeHex`/`hexToRgb`/`luminance`/`mixHex`/`toHexByte`/
`readableTextColor`. Logic verbatim; only the `preview`-prefixed names were dropped (that prefix named
the file's specific "design-markdown preview" call site, not anything about the math itself).

**Deliberately NOT ported** (per the plan's own note — this atom is scoped to "the math," not the
higher-level color-selection heuristic that consumes it): `findPreviewColor`/`firstNonNeutralColor`
and the enclosing `buildDesignMdPreviewModel` (`DesignSystemFlow.tsx:4476-4545`). Both take
`DesignMdPreviewColor[]` (a type shaped by OD's own design-markdown color-extraction parser) and encode
OD-specific product judgment ("search a parsed design system's colors for one whose label/role/usage text
matches `/background|canvas|page|paper/i` and treat it as light/dark background") — that's domain logic
riding on top of the generic math, not the math itself, and the plan doc's own phrasing ("travels with
whichever token-chip feature ends up consuming it") anticipated exactly this split. No token-chip feature
exists in this repo yet, so per the task brief this ships as a standalone `src/utils/` module (pure
functions, zero feature coupling) rather than being pre-homed under a speculative `features/token-chip/`
— flagged here so it's not missed: **this module may want to move under a future token-chip/design-tokens
feature folder once a real consumer exists**, the same way `appearance.ts` and `visual-stability.ts`
already sit in `src/utils/` as pre-consumer-agnostic primitives.

One naming clarification beyond a literal rename: `previewLuminance` → `luminance`, documented explicitly
as the ITU-R BT.709 luma formula (weights applied directly to gamma-encoded sRGB channels) and NOT true
WCAG 2.x relative luminance (which requires linearizing each channel through the sRGB gamma curve first).
The origin's implementation was already this luma approximation, not the WCAG formula — preserved exactly
as ported (behavior-preserving), with the doc comment added so a future reader doesn't assume WCAG
contrast-ratio compliance that was never actually there.

No i18n: zero user-facing strings (pure color math).

### Purity grep

`grep -rnE "Open Design|OD_|--od-stamp|/tmp/open-design|@open-design/|open-design\.ai|openDesignDesktop"`
across both new source files and both new test files: **clean, zero matches.**

### Test/typecheck/guard results

- `pnpm --filter @jini/ui typecheck`: green, zero errors.
- `npx vitest run --coverage` (package-wide, `json-summary`+`json`+`text` reporters per this repo's
  `vitest.config.ts`): **142 test files, 1,249 tests, all green.** Both new files hit **100% on all 4
  metrics** (statements/branches/functions/lines) per `coverage/coverage-summary.json`:
  `src/utils/scroll-tabs-with-wheel.ts` — 19/19 statements, 14/14 branches, 2/2 functions, 19/19 lines;
  `src/utils/color-math.ts` — 41/41 statements, 21/21 branches, 6/6 functions, 41/41 lines. Real edge-case
  tests, not just happy-path: `scroll-tabs-with-wheel.test.ts` covers ctrlKey pinch-zoom, horizontal-swipe
  dominance (including the exact-tie boundary), non-overflowing strips, all three `deltaMode` values
  (pixel/line/page) plus an unrecognized-mode fallback, and the at-scroll-boundary no-op-preventDefault
  case (via a clamping `scrollLeft` setter double); `color-math.test.ts` covers 3/6/8-digit hex parsing
  (including alpha-channel drop and an embedded-substring match), an invalid-length-4 rejection, decode
  failure fallbacks on both sides of `mixHex`, out-of-range weight clamping in both directions,
  `toHexByte`'s negative/overflow clamping, and the `readableTextColor` threshold boundary on both sides
  of 0.56 luminance.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` —
  unchanged, no boundary violations introduced.
## Section: bucket-A flat atoms — NewProjectPanel / PluginsView / EntryShell (2026-07-18)

Scope: `docs/jini-port/god-components-extraction-plan.md` Section C's flat-atom
row for three god-files' small presentational components (not the files'
larger stateful bodies, which stay OD-specific). Cloud-dispatch preflight:
source repo `leonaburime-ucla/open-design`, commit `0b88ef56144b5a42dc427c1292ae22676d698a34`
(cloned fresh to `/tmp/od-source`, not the vendored `integrations/open-design/reference/`
snapshot); destination `packages/ui/src/components/`; task branch
`feature/jini-ui-flat-atoms-onboarding-plugins`; validation commands
`pnpm --filter @jini/ui typecheck`, `pnpm --filter @jini/ui exec vitest run --coverage`,
a product-identity purity grep, and `pnpm guard` from the repo root.

Each source file was read in full (not sampled) via `/tmp/od-source`. All ten
components below are single-file-local in the origin — a fan-out grep for
each name across `apps/web/src` (both quote styles) turned up no cross-file
importer other than the origin file itself, so there was no orchestrator to
re-wire and no external caller contract to preserve; this is a pure "lift the
function into a new file" port for each one, not a vertical-slice refactor.

### Choice-card overlap check (required by this task's dispatch prompt)

r6 (`docs/jini-port/recon/r6-god-component-internals.md` line ~136) flags a
"choice-card shape, maybe three times" concern between `EntryShell.tsx`'s
`OnboardingChoiceCard` and `NewProjectPanel.tsx`'s `OptionCards<T>`/
`FidelityCard`. Before shipping `OptionCards<T>`, searched this repo
(`packages/ui/src/`) for `OnboardingChoiceCard`/`ChoiceCard`/`RadioCard`/
`OptionCard` and for any existing choice-card-shaped component in
`packages/ui/src/features/sketch-editor/` (the only place r6 hinted at a
possible prior landing) — **no match**. `OnboardingChoiceCard` has not been
extracted into `@jini/ui` yet (it isn't in this task's scope; it belongs to
a future EntryShell dispatch), so there is no already-shipped duplicate to
reconcile against.

Read `OnboardingChoiceCard` in full anyway (`EntryShell.tsx` line 3570) to
judge whether `OptionCards<T>` should be designed as its base primitive
now, to avoid a near-duplicate later. Verdict: **not the same shape,
ship both independently.** `OptionCards<T>` is `{ value, title, hint? }` —
a plain labeled-radio-card grid. `OnboardingChoiceCard` is substantially
richer: `icon` (enum) or `agentIconId`, `benefits`/`upcomingBenefits` lists
with a separate `benefitPlacement` ('copy' | 'aside') layout mode, a
`modelSlot`/`statusSlot`/`actionLabel` render-prop-shaped set of slots, a
`badge`, `featured`, and an `amr` `variant`. Forcing it through
`OptionCards<T>`'s shape would mean bolting most of the richer props onto
the "simple" component anyway, defeating the point of having a compact one.
**Recorded for whoever extracts `OnboardingChoiceCard` next**: don't
independently re-derive a plain radio-card grid inside it — if a stripped-
down non-featured, non-benefit card face is ever needed standalone, reuse
this `OptionCards<T>`/`FidelityCard` pair rather than writing a third
variant. `FidelityCard` itself (also named in the same Section C row,
alongside `OptionCards<T>`/`CompactToggle`/`ToggleRow`) was **not** shipped
in this batch — the task's dispatch prompt named only `OptionCards<T>` and
`CompactToggle`/`ToggleRow` for `NewProjectPanel.tsx`; `FidelityCard` (plus
its two inline `WireframeArt`/`HighFidelityArt` SVG illustrations) stays
un-ported for now, tracked by the plan doc's existing Section C row — not a
silent drop, just out of this dispatch's named scope.

### Shipped

| Jini file | Origin (`apps/web/src/components/…`) | What changed |
|---|---|---|
| `src/components/OptionCards.tsx` | `NewProjectPanel.tsx`'s `OptionCards<T>` | Verbatim structural port. Zero OD coupling in the origin (label/options/value/onChange all caller-supplied) — no i18n needed since there's no component-owned copy. Added an optional `className` passthrough (this package's existing flat-component convention; the origin had none because it only had one caller). |
| `src/components/CompactToggle.tsx` | `NewProjectPanel.tsx`'s `CompactToggle` | Verbatim structural port, same reasoning as `OptionCards` (no copy owned by the component itself). Added `className` passthrough. |
| `src/components/ToggleRow.tsx` | `NewProjectPanel.tsx`'s `ToggleRow` | Verbatim structural port, same reasoning. Note: `PrivacySection.tsx` (a different OD file, not in this task's scope) has its own independent `ToggleRow` — not touched, not consolidated; out of scope for this dispatch. Added `className` passthrough. |
| `src/components/StatCard.tsx` | `PluginsView.tsx`'s `StatCard` | Verbatim structural port — `{ label, value }` only, no OD coupling. Added `className` passthrough. |
| `src/components/Notice.tsx` | `PluginsView.tsx`'s `Notice` | Genericized `outcome`'s type from OD's `PluginInstallOutcome` (a plugin-install wire DTO imported from `@open-design/contracts`) to a new local `NoticeOutcome` interface carrying the same three fields the component actually reads (`ok`, `message`, `warnings?`, `log?`) — any "ran an operation, got a result + warnings + a log" flow can supply this, not just plugin installs. Wrapped the two previously-hardcoded strings ("Install log", the "N warning(s)" pluralization) in `useT()` per the i18n policy; added an optional `logLabel` override prop since a host may want different copy for its own log-bearing operation. |
| `src/components/ImportChoice.tsx` | `PluginsView.tsx`'s `ImportChoice` | Verbatim structural port — `active`/`icon`/`title`/`body`/`onClick` all caller-supplied, no component-owned copy. `icon`'s type narrowed from the origin's inline `'github' \| 'upload' \| 'folder'` union to this package's existing `IconName` (all three values already exist in `Icon.tsx`'s union). |
| `src/components/FileImportPanel.tsx` | `PluginsView.tsx`'s `FileImportPanel` | Genericized the `webkitdirectory`/`directory` non-standard DOM attributes using the same `as Record<string, string>` cast pattern already used elsewhere in OD's own codebase (`DesignSystemFlow.tsx`) rather than reaching for a new type hack. Wrapped the previously-hardcoded `"Import"`/`"Importing…"` button copy (title/body/fileLabel were already props) in `useT()`. |
| `src/components/OnboardingPanelHeader.tsx` | `EntryShell.tsx`'s `OnboardingPanelHeader` | Verbatim structural port — `title`/`body` caller-supplied, no component-owned copy. |
| `src/components/OnboardingChipField.tsx` | `EntryShell.tsx`'s `OnboardingChipField` | Verbatim structural port — `label`/`options[].label` caller-supplied, no component-owned copy. The discriminated-union `multiple`/`value`/`onChange` prop shape (single vs. array) is unchanged. |
| `src/components/OnboardingDropdown.tsx` | `EntryShell.tsx`'s `OnboardingDropdown` | Two genericizations beyond a structural port: (1) the single-open-at-a-time peer-coordination mechanism dispatched a `window` `CustomEvent` named literally `'open-design:onboarding-dropdown-open'` — a product-identity string forbidden by this package's hard boundary rule — renamed to `'jini-ui:onboarding-dropdown-open'`; (2) the two empty-state strings were OD's own i18n dictionary keys (`t('homeHero.footer.noMatches')`, `t('settings.fetchModelsEmpty')`), routed through this package's own `useT()` as plain English instead: `t('No matches')` for the searchable/query-no-hits case (its actual English string, per `content.en`-equivalent locale files, was already generic — "No matches" — so ported as-is), and a new `t('No options available')` for the non-searchable/zero-options case — the origin's real fallback text there ("No compatible text models were returned.") was leftover wording from the one settings call site it happened to serve, not a generic empty-dropdown message, so this is a genuine simplification rather than a verbatim string carry-over. Removed one dead defensive `if (!root) return` null-check on a ref that is always attached by the time the gating effect runs (surfaced by the Phase 9.5 coverage loop; see below). |

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|open-design\.ai\|open-design:\|@open-design/"` across all ten new files: **clean, zero matches** (the one pre-existing `open-design:` occurrence — the peer-coordination event name — was the exact string replaced above, not left behind). CSS class names were left as the origin's verbatim strings (`newproj-*`, `plugins-view__*`, `plugins-import-modal__*`, `onboarding-view__*`, `onboarding-chip-field*`, `compact-toggle*`, `toggle-row*`) per the precedent already set for `Loading.tsx`'s `design-card`/`skeleton-block` classes — these read as feature-shaped names, not product-identity strings, and none use the `od-` prefix that would trigger the `jini-` rename convention used elsewhere in this file.

### Coverage

All ten files at 100% statements/branches/functions/lines (`json-summary`+`json`
reporters, per-file). Two Phase 9.5 loop iterations were needed:
`FileImportPanel.tsx`'s `event.currentTarget.files ?? []` fallback (files is
typed `FileList | null` but a real `<input type="file">` never actually
returns null) was classified reachable-in-principle and given a real test
that forces `files` to `null` via `Object.defineProperty`, rather than
deleted or ignored. `OnboardingDropdown.tsx`'s `if (!root) return` inside its
placement-measurement effect was classified genuinely dead (the ref's owning
div is unconditionally rendered, so the ref is always set by the time the
`open`-gated effect runs) and removed per the loop's "refactor away the dead
branch" rule rather than padded with a contrived test; its
`window.innerHeight || document.documentElement.clientHeight || 720`
fallback chain, by contrast, was classified genuinely reachable (a real
embed/iframe timing edge case) and given two tests that force each fallback
step. No `/* v8 ignore */` or other coverage-suppression comment was used
anywhere in this batch.
---

## Section: flat atoms — `DesignKitView.tsx` + `home-hero/EdgeAutoScroll.tsx` (2026-07-18)

Scope: `docs/jini-port/god-components-extraction-plan.md`'s Section C (bucket-A
flat atoms, not `features/` folders) for the two items listed for this batch:
`DesignKitView.tsx`'s `BrandLogo`/`HeaderActionsMenu`/`useBrandFonts`/
`designMd*` utilities, and `HomeHero.tsx`'s already-isolated
`home-hero/EdgeAutoScroll.tsx`. Source: a fresh clone of the real
`leonaburime-ucla/open-design` fork (commit `0b88ef56144b5a42dc427c1292ae22676d698a34`,
`main`, 2026-07-02), per the cloud-dispatch preflight — not the vendored
`integrations/open-design/reference/` snapshot. Both source files were read
in full before extracting anything, per the batch instruction.

### What shipped

| Jini file | Origin | Contents |
|---|---|---|
| `src/components/BrandLogo.tsx` | `DesignKitView.tsx`'s `BrandLogo` (exported as `KitLogoProps`/`BrandLogo`) | The 4-stage logo fallback chain: brand-service image → explicit `logoSrc` → favicon lookup → monogram-letter fallback, advancing on each stage's `onError`. |
| `src/components/HeaderActionsMenu.tsx` | `DesignKitView.tsx`'s `HeaderActionsMenu` + its co-located `HeaderMenuAction` type | The sticky-header "More" overflow menu: grouped popover, outside-click/Escape-to-close, checkbox-semantics for toggle items. |
| `src/hooks/useBrandFonts.ts` | `DesignKitView.tsx`'s `useBrandFonts` | Google Fonts `<link>` injection + self-hosted `@font-face` injection from a project's font manifest. |
| `src/utils/design-md.ts` | `DesignKitView.tsx`'s module-private `designMdModuleSlice`/`replaceDesignMdModule`/`designMdHeadings`/`designMdHeadingMatches`/`designMdDefaultModuleText`/`normalizeDesignMdModuleDraft` | Pure markdown-heading-slice/replace helpers for pulling a single "module" section out of (and back into) a DESIGN.md-shaped document. |
| `src/hooks/useEdgeAutoScroll.ts` | `home-hero/EdgeAutoScroll.tsx`'s `useEdgeAutoScroll` | Edge hover/click auto-scroll controller for a horizontally-overflowing rail (rAF-driven glide, click-to-nudge, `ResizeObserver`-refreshed reachable-edge state). |
| `src/components/EdgeScrollZones.tsx` | `home-hero/EdgeAutoScroll.tsx`'s `EdgeScrollZones` | The paired left/right overlay zones that drive the hook above. |

All six are re-exported from `src/index.ts`.

### Genericized / what changed

- **`BrandLogo`**: the origin hardcoded an OD API endpoint
  (`` `/api/brands/${bid}/logo` ``) for the brand-service stage. Replaced with
  an injected `resolveBrandLogoUrl?: (brandId: string) => string` — omitting
  it skips the brand-service stage entirely (falls through to `logoSrc` /
  favicon / letter) rather than ever constructing an OD-specific URL. The
  Google-favicon-service call (`https://www.google.com/s2/favicons?...`) was
  kept as the default (a genuinely generic third-party API, not OD-specific —
  same reasoning `useBrandFonts`'s Google Fonts `<link>` injection already
  uses) but is now also overridable via `resolveFaviconUrl`. Dropped the
  origin's legacy `id?: string` alias for `brandId` (an OD call-site quirk —
  "Brands list rows pass `id`" — not a generic concern for a standalone
  component).
- **`useBrandFonts`**: the origin's self-hosted-font-manifest fetch called
  `projectRawUrl(projectId, path)`, an OD-specific import from
  `../providers/registry`. Replaced with an injected
  `options.resolveProjectAssetUrl?: (projectId, path) => string` — per the
  batch instruction, omitting it skips the manifest fetch entirely rather
  than hardcoding any font-service URL. The Google Fonts `<link>`-injection
  half needed no change (already generic).
- **`HeaderActionsMenu`**: no OD coupling beyond a `styles.*` CSS-module
  import (`./BrandPreviewCard.module.css`) — this package has no
  CSS-module build step (same situation every prior flat-group component
  hit, e.g. `KitErrorBoundary`/`WorkingDirPicker`), so class names were
  flattened to plain `jini-header-actions-menu*` names. The
  `data-testid="design-kit-more-actions"` (naming the menu after its one
  origin call site) was renamed to `header-actions-menu-trigger` since this
  is now a standalone, non-"design-kit"-specific component.
- **`design-md.ts`**: `DesignMdModuleSpec`'s original `id` field was a fixed
  6-value OD union (`'identity' | 'typography' | 'palette' | 'voice' |
  'imageryLayout' | 'designSystem'`, the brand-kit's own module list) and
  `label` was a translated UI-display string — neither is read by the pure
  slice/replace/heading-match logic itself (only `heading`/`keywords`/
  `includePreamble` are). Both fields were dropped from the ported
  `DesignMdModule` type; a host building a real module picker UI supplies
  its own id/label alongside a `DesignMdModule` when calling into this
  utility, rather than this pure-logic file carrying UI-display fields it
  never reads.
- **`EdgeScrollZones`**: only OD-specific artifact was the `home-hero__rail-edge*`
  CSS class family (named after the one OD component that used it). Renamed
  to `jini-edge-scroll-zone*`. Logic is otherwise byte-identical to the
  origin — r6's "already isolated, ship as-is" verdict held up on a full
  read; the only change was the class-name neutrality pass.

### i18n

None of the six atoms render a hardcoded user-facing string that needed
`useT()` wrapping: `HeaderActionsMenu` takes every label (`label`, each
`HeaderMenuAction.label`) as a caller-supplied prop with no default value
(the "translatable for free" pattern already holds without any wrapping —
there is nothing in this component's own source to translate); `BrandLogo`
renders no text beyond a derived monogram initial and an intentionally-empty
`alt=""`; `EdgeScrollZones` is `aria-hidden` on both zones with no visible
text or `aria-label` (decorative overlays, matching the origin exactly —
verified this wasn't an accessibility gap introduced by porting, it was
already `aria-hidden` in the origin); `useBrandFonts`/`useEdgeAutoScroll`
render nothing; `design-md.ts` is pure logic with no React import (exempt
per the i18n policy) and its `heading`/markdown output is document content
written by the module, not UI chrome to translate. Flagged explicitly per
the policy's own "no silent gaps" instruction rather than left unstated.

### Coverage

Ran the Phase 9.5 classify-then-fix loop once per atom; every uncovered
branch on the first pass classified as either "genuinely reachable, just
untested" (all `BrandLogo` fallback-chain permutations; `useBrandFonts`'s
resolver-present/absent × projectId-present/absent × fetch-ok/fetch-fail/
fetch-throw/manifest-empty/unmount-mid-fetch matrix; every `useEdgeAutoScroll`
glide/nudge/stop/restart/ResizeObserver-present-or-absent/ref-unattached
path) or "TS-required fallback with no real runtime path" (two `??`
fallbacks in `design-md.ts`'s `designMdHeadings` — `match.index`/`match[1]`
are typed possibly-`undefined` by the JS regex API even though this
pattern's mandatory capture group and `matchAll` result always define them;
converted to non-null assertions with an explaining comment, not tested
around) or a genuine **dead branch** refactored away rather than tested
around: `design-md.ts`'s `designMdModuleSlice`/`replaceDesignMdModule` both
defensively wrote `body ?? ''` for a parameter already typed `string` (not
optional) — the `??` fallback was unreachable under the function's own type
contract, so it was deleted (using `body` directly) instead of adding a
type-defeating cast just to hit it; `HeaderActionsMenu`'s
`Fragment key={group[0]?.id ?? groupIndex}` — `group` is always drawn from
`visibleGroups = groups.filter((g) => g.length > 0)`, so `group[0]` is
always defined at that call site and the `?.`/`??` fallback could never
fire — replaced with `group[0]!.id` plus a one-line comment recording the
invariant. No `/* v8 ignore */` or other suppression was used anywhere.
Final numbers, all six atoms, statements/branches/functions/lines:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `BrandLogo.tsx` | 100 | 100 | 100 | 100 |
| `HeaderActionsMenu.tsx` | 100 | 100 | 100 | 100 |
| `EdgeScrollZones.tsx` | 100 | 100 | 100 | 100 |
| `useBrandFonts.ts` | 100 | 100 | 100 | 100 |
| `useEdgeAutoScroll.ts` | 100 | 100 | 100 | 100 |
| `design-md.ts` | 100 | 100 | 100 | 100 |

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|@open-design/"` and
the stricter `grep -rn "od-\|open-design\.ai\|openDesignDesktop"` pass, both
run across every new/changed file in this batch (the six source files, their
six test files, and the `src/index.ts` barrel diff): **clean, zero matches**
in both passes.

### Test/typecheck/guard results

- `pnpm --filter @jini/ui typecheck`: green (zero errors).
- New atom tests in isolation: **94 tests across 6 files, all green**, 100%
  statements/branches/functions/lines on all six atoms (table above).
- `pnpm --filter @jini/ui exec vitest run` (full package): **1306 tests,
  146 files, all green** — no regression in any pre-existing test.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending
  implementation during extraction)` — no boundary violations introduced.
## Section: `features/schedule-picker/` (`RecurringSchedulePicker`) + `features/mention-autocomplete/` (`MentionAutocomplete`) — `NewAutomationModal.tsx` (2026-07-18)

Source: `apps/web/src/components/NewAutomationModal.tsx` (1,165 lines in the
real clone at `leonaburime-ucla/open-design`, commit at dispatch time —
**not** `integrations/open-design/reference/`'s frozen snapshot, per this
task's mandate to clone the real fork), per
`docs/jini-port/god-components-extraction-plan.md`'s Consolidation map
Section B rows for `features/schedule-picker/` and
`features/mention-autocomplete/`, and recon `r6-god-component-internals.md`
§1.19. Two separate `features/<domain>/` slices, both under the NEW
`react/{hooks,components}/` layout, per this repo's React-layout policy.

### `features/schedule-picker/` — what shipped

| File | Contents |
|---|---|
| `types.ts` | `Weekday`, `ScheduleKind`, `ScheduleValue` (tagged union — the generic replacement for the origin's `RoutineSchedule` contract type), `ScheduleKindOption`, `WeekdayOption`, `ScheduleEditorState` (carries every kind's fields simultaneously, mirroring the origin's `FormState` schedule fields so switching kind tabs doesn't lose in-progress edits), `ScheduleSummaryParts`. |
| `constants.ts` | `DEFAULT_SCHEDULE_KINDS`, `DEFAULT_WEEKDAYS` (Sunday-first), `DEFAULT_SCHEDULE_TIME`/`WEEKDAY`/`MINUTE`. |
| `rules.ts` | `clampMinute`, `formatTime12h`, `decomposeSchedule`/`describeScheduleSummary` (ported from the origin's identically-named functions, generalized off `RoutineSchedule`), `defaultScheduleEditorState`, `scheduleEditorStateFromValue` (the origin's `formFromRoutine`, generalized), `buildScheduleValue` (the origin's `buildSchedule`, generalized), `showsWeekdayGrid`/`showsTimeFields`. Hook-free by design. |
| `react/hooks/useRecurringSchedulePicker.ts` | Owns popover open/closed, the editor working-state, and outside-click/Escape dismissal via the shared `useDismissOnOutsideOrEscape` hook (`packages/ui/src/browser/`) rather than hand-rolling a second listener pair — this task is the second consumer of that shared hook after `browser-chrome`'s `BrowserViewportControls`. Re-syncs the editor state from the latest committed `value` each time the popover re-opens (so a discarded in-progress edit doesn't leak into the next open). No `ports.ts`/`dependencies.ts` — this feature has no transport dependency; timezone data comes from the flat `utils/timezone.ts` and there's no persistence port to inject (matches the `settings-dialog` tabs' "no ports" precedent for pure-client-state features). |
| `react/components/ScheduleKindTabs.tsx`, `WeekdayGrid.tsx`, `ScheduleFields.tsx` (kind-dependent minute-field vs. time+timezone-row), `ScheduleSummary.tsx` (+ `translatedScheduleSummaryLabel` — a translated-string sibling of the JSX summary, used for the trigger pill's `aria-label`; needed because `rules.ts`'s `describeScheduleSummary` is hook-free and therefore can't itself produce translated output), `RecurringSchedulePicker.tsx` (orchestrator — trigger `PillButton` + popover assembling the above + a Done action that commits the edit). |
| `index.ts` | Public barrel. |

### `features/mention-autocomplete/` — what shipped

| File | Contents |
|---|---|
| `types.ts` | `MentionItem<TIcon = unknown>` (the generic `{id, label, category, meta?, icon?}` shape the task brief specified, replacing the origin's `SkillSummary`/`InstalledPluginRecord`/`McpServerConfig`/`ConnectorDetail` union), `MentionCategory`, `MentionCategoryFilter`, `MentionTriggerMatch`, `MentionInsertResult`. `icon` is generic over `TIcon` (not `ReactNode` directly) specifically so this file has zero *runtime* React import per the React-layout policy — the `react/` layer binds `TIcon = ReactNode` itself (see `MentionResultItem`'s `T extends MentionItem<ReactNode>` constraint), the same kind of split `settings-dialog`'s `SettingsDialogTabMeta`/`SettingsDialogTab` used for the same reason. |
| `constants.ts` | `ALL_CATEGORY_FILTER`, `DEFAULT_TRIGGER_CHAR` (`'@'`), `DEFAULT_MAX_RESULTS_PER_CATEGORY` (10, matching the origin's per-kind `.slice(0, 10)`). |
| `rules.ts` | `readMentionTrigger` (the origin's `readContextMention`, generalized: trigger character is now a parameter, not hardcoded `@`), `buildMentionToken` (the origin's `inlineMentionToken` from `utils/inlineMentions.ts` — **only this one trivial function was ported from that file**, see the "3-way overlap" note below for why the rest of it wasn't), `insertMentionToken` (the text-splicing half of the origin's `replaceMentionWithLabel`, with the DOM focus/cursor-restore half kept in the hook), `filterMentionItems`, `groupItemsByCategory` (per-category-capped, matching the origin's independent per-kind `.slice(0,10)` rather than one shared cap across every category combined — a subtlety that needed a second pass to get right, see the coverage-loop notes below), `isCategoryVisible` (the origin's `showSkills`/`showPlugins`/`showMcp`/`showConnectors` booleans, generalized to one predicate), `mentionSelectionKey` (a new `category:id` composite-key helper — needed because two different categories may reuse the same raw id, which the origin never had to handle since it tracked `selectedSkillIds`/`selectedPluginIds`/etc. as four separate arrays), `hasAnyResults`. |
| `react/hooks/useMentionAutocomplete.ts` | Owns the live-textarea trigger detection, the active category tab, filtered/grouped results, and — a deliberate design decision beyond a literal port — the **selected-items set itself** (`selectedItems: T[]`, add-on-pick/remove-on-chip-click), rather than requiring the host to own that state externally. The origin owned `selectedSkillIds`/`selectedPluginIds`/`selectedMcpIds`/`selectedConnectorIds` in the *modal's* own state (OD-specific, per the "form/REST wiring stays behind" rule) — but the underlying *mechanism* ("track what's picked, render removable chips, allow removal") is exactly what r6 §1.19 named as part of the generic picker shape ("removable chips"), so this port makes the widget fully self-contained rather than pushing that mechanism back onto every future host. A host that wants to observe the selection gets `onSelectionChange`. Also owns a real, disclosed bug fix (see below). |
| `react/components/MentionCategoryTabs.tsx`, `MentionResultItem.tsx`, `MentionResultsList.tsx`, `SelectedMentionChips.tsx`, `MentionAutocomplete.tsx` (orchestrator: renders its own `<textarea>` + tabbed popover + chips row — a self-contained "mention-enabled textarea" widget, not just the popover in isolation, since that's what makes it directly drop-in reusable). All four inner components generic over `T extends MentionItem<ReactNode>`. |
| `index.ts` | Public barrel. |

### A real bug found and fixed, not silently ported

The origin wires `onKeyDown={handlePromptKeyDown}` (Escape closes the mention) and `onKeyUp={refreshMentionFromPrompt}` (re-derives the mention from the live textarea) on the same `<textarea>`. Since Escape doesn't change the textarea's value or cursor, the `keyup` that always follows the `keydown` re-reads the still-live `@token` and **immediately reopens the mention Escape just closed** — a real, reproducible defect in the origin (confirmed by porting it faithfully first, per Phase 0's behavior-preserving instinct, and watching a new test fail). Per this task's own instructions ("no OD tilt," building a *good* generic primitive, not a byte-identical clone) this was fixed rather than reproduced: `onTextareaKeyUp` now skips the refresh specifically when `event.key === 'Escape'`, with a code comment and a dedicated test (`onTextareaKeyUp skips the refresh for an Escape key`) proving the fix. Flagged here explicitly rather than left as a silent behavior change.

### Popover chrome primitives + timezone utils (r6 §1.19 items 4c/4d)

- **`PillButton`/`PopoverMenu`/`PopoverItem`** shipped as flat `packages/ui/src/components/*.tsx` (per the task's own instruction to ship flat if "truly standalone/reusable outside this file," using judgment). `RecurringSchedulePicker` is a **real consumer** of `PillButton` (its trigger). `PopoverMenu`/`PopoverItem` are **not** consumed by either shipped feature — the origin used them for the *project-target picker* popover (`New project each run` / existing-projects list), which is explicitly OD-specific form/target-selection wiring this task does not port (see "What stayed behind" below). They're shipped anyway because r6 classified them as "generic, no OD types" independent of that one call site, and a future project/target-picker-shaped extraction can reuse them without re-deriving the same simple check-mark-list-item shape — but this is flagged here explicitly as the honest state, not silently implied to be wired into either new feature.
- **`detectLocalTimezone`/`listSupportedTimezones`/`tzCityLabel`** shipped as flat `packages/ui/src/utils/timezone.ts` (pure `Intl` wrappers, exactly as r6 described them). `useRecurringSchedulePicker` is the real consumer.

### Cross-check against r6 §1.19's full description (nothing dropped silently)

- "kind-tabs + weekday-grid + time/timezone-select" — all three shipped (`ScheduleKindTabs`/`WeekdayGrid`/`ScheduleFields`).
- "only the `RoutineSchedule` type is OD-specific" — confirmed; replaced by `ScheduleValue`, no other OD coupling found in the schedule editor during the Phase 8.5 audit.
- "inline @-token detection, tabbed multi-category filtered results, removable chips" — all three shipped (`readMentionTrigger`, `MentionCategoryTabs`+grouped `MentionResultsList`, `SelectedMentionChips`).
- "OD-specific only via the capability data types" — confirmed; replaced by generic `MentionItem`, no other OD coupling found.
- "Popover chrome primitives... generic, no OD types" — shipped flat, per above (with the honest non-consumption note).
- "Timezone utilities... pure Intl wrappers" — shipped flat, consumed by schedule-picker.
- Nothing r6 called generic was simplified away or dropped in this pass.

### What stayed OD-specific and was NOT ported (per r6 §1.19 + the task brief)

- `FormState`/schedule-building tied to the `Routine` contract type, and the whole `buildSchedule`→`CreateRoutineRequest` submission shape.
- The template-picker (`TemplatePopover`, `AutomationTemplate`) and OD's own automation-template catalog content.
- The project-target picker (`New project each run` / existing-project list) — this is *also* where `PopoverMenu`/`PopoverItem` would have been consumed in the origin; not ported since it's a project/target-selection concept, not a generic picker shape on its own.
- The form-submit/REST-endpoint wiring (`/api/routines` POST/PATCH, `onSaved`/`onClose` callback contract).
- `utils/inlineMentions.ts`'s Lexical-adjacent rich-text mention *parser* (`buildInlineMentionParts`, the trie-based token index, `isMentionBoundary`/`isMentionRightBoundary`/`mentionTokenPresent`) — the origin's `NewAutomationModal.tsx` only ever called that file's trivial `inlineMentionToken(label)` helper (ported here as `buildMentionToken`, generalized). The rest of that file is a much larger rich-text-over-a-committed-string mention system that belongs with the Lexical `composer/*` `@mention` system instead (see the 3-way overlap note directly below) — pulling it in here would have smuggled a second, unrelated feature's source file into this task's scope.

### The mention-autocomplete 3-way overlap (flagged per the task brief, not resolved here)

`docs/jini-port/god-components-extraction-plan.md`'s "5 more overlaps" list (~line 148) names three "type a trigger character, get a filtered picker" shapes: `QuickSwitcher.tsx` (Cmd-K fuzzy file/tab switcher), this file's `@`-mention/capability picker (now shipped as `MentionAutocomplete`), and `composer/*`'s Lexical `@mention` system (`MentionNode.ts` + siblings). Read all three at dispatch time to check this:

- **`QuickSwitcher.tsx`** (`apps/web/src/components/QuickSwitcher.tsx` in the real clone): a full-screen Cmd-K-style modal overlay with a single always-visible search input (no inline trigger-character detection — it's already open when mounted), fuzzy-scored ranked results (`scoreMatch`/`scoreWorkspaceContextMatch`, prefix/substring/full-text tiers), arrow-key + Enter keyboard navigation with a `cursor` index and `nextCursor` wraparound, and a recents-first empty-query ordering (`quickSwitcherRecents`). **Not the same component shape as `MentionAutocomplete`**: no inline-textarea trigger detection, no tabbed multi-category grouping, no removable-chips multi-select, and a fundamentally different selection model (arrow-key cursor + Enter, not click/mousedown-to-pick with a chip trail). Both are "type text, get filtered results," but `MentionAutocomplete`'s defining shape (trigger character *inside* a text field, multi-category tabs, persistent multi-select chips) doesn't match `QuickSwitcher`'s (an already-open single-purpose fuzzy-match palette with keyboard-cursor selection). **Conclusion: do not fold `QuickSwitcher.tsx` into `features/mention-autocomplete/`** — it's a distinct shape (closer to a generic "command palette" primitive) and should get its own extraction if/when it's prioritized.
- **`composer/*`'s Lexical `@mention` system** (`apps/web/src/components/composer/MentionNode.ts` + siblings, referenced but not fully read in this dispatch — out of this task's file scope): per r5's own characterization ("generic Lexical rich-text/mention editor primitive," target `features/rich-text-input/`), this is a *contenteditable rich-text* mention system built on the Lexical editor framework, rendering mentions as atomic inline nodes inside a WYSIWYG document model — a fundamentally different implementation substrate than `MentionAutocomplete`'s plain `<textarea>` + string-splicing approach. They likely share only the shallow "type `@`, see a filtered list" *interaction pattern*, not a reusable component-level shape — a plain textarea can't host a Lexical node tree, so `MentionAutocomplete` cannot become `features/rich-text-input/`'s implementation, and shouldn't try to.
- **This task's own verdict**: `MentionAutocomplete` (this shipment) and `QuickSwitcher`/the Lexical mention system are three genuinely different shapes under one superficially-similar description, not the same primitive done three ways. A future dispatch extracting `QuickSwitcher.tsx` or `features/rich-text-input/` should still read this section first and re-verify this conclusion (this recon was done by one task under time pressure, not an exhaustive side-by-side), but should not assume `features/mention-autocomplete/` is already "the" answer for either.

### The `features/progress-card/` discrepancy (flagged per the task brief)

`docs/jini-port/god-components-extraction-plan.md`'s Consolidation map (line ~100) and its §1 priority list (line ~267) both describe `features/progress-card/` as "✅ landed"/"already shipped." **This is not true in this repo as of this dispatch (2026-07-18, branch `extract/schedule-picker-and-mention-autocomplete` off `origin/main` at `e3110ac`)**: `packages/ui/src/features/progress-card/` does not exist — confirmed via `ls packages/ui/src/features/` (lists `asset-grid, browser-chrome, connectors, i18n, observability, settings-dialog, sketch-editor, viewer-shell` only) and via `find`/`ls` directly on the path (no such file or directory). This task did not attempt to reconcile or re-land it — it's out of scope for the schedule-picker/mention-autocomplete extraction — but is recorded here per the task brief's explicit instruction not to let a doc claim stand unverified. A future task should either land `features/progress-card/` for real or correct the plan doc's two claims.

### i18n

Every user-facing string in every new file (both features) routes through `useT()`, English string as key, per this package's i18n policy. `rules.ts` in both features stays hook-free — `ScheduleSummary`'s translated pill segments and `translatedScheduleSummaryLabel`'s translated `aria-label` both wrap `decomposeSchedule`'s untranslated return value at the call site, exactly the pattern the policy prescribes. Every component has a real test mounting under `I18nProvider` with a translated dictionary and asserting the translated text renders (not just that `t()` compiles), including one full end-to-end `MentionAutocomplete` test exercising a translated placeholder, tab labels, section labels, and the chips-row `aria-label` together in one flow.

### Phase 8.5 audit

Ran across every new file in both features: no orphaned `useState`/`useRef` found (every state value/ref in `useRecurringSchedulePicker` and `useMentionAutocomplete` is read somewhere — render, an effect, or a returned callback). No inline JSX callback with real multi-statement branching was found — the only inline arrows are one-line `onClick={() => onChange(x)}`-shaped calls or a `preventDefault()`+one-call pair (`MentionCategoryTabs`'/`MentionResultItem`'s `onMouseDown`), matching the audit bar already accepted for `AssetGridToolbar`'s `onSearchChange`-shaped one-liners elsewhere in this package. Every `useMemo` in `useMentionAutocomplete` (`filteredItems`, `groups`, `selectedKeys`) is a direct, single-purpose derivation with no unextracted branching. Two genuinely-dead-but-TS-required fallbacks were found and refactored away rather than tested around, per Phase 9.5 point 3: `rules.ts`'s `readMentionTrigger` had two `match[n] ?? ''` fallbacks for regex capture groups that are structurally guaranteed to participate whenever the overall match succeeds (replaced with non-null assertions + an explaining comment); `utils/timezone.ts`'s `tzCityLabel` had a `.split('/').pop() ?? timezone` fallback that's likewise unreachable (`split` always returns a non-empty array) (same fix).

### Purity grep

`grep -rniE 'open.?design|\bOD_|--od-stamp|/tmp/open-design'` across `packages/ui/src/features/schedule-picker/`, `packages/ui/src/features/mention-autocomplete/`, `packages/ui/src/utils/timezone.ts`(+test), `packages/ui/src/components/{PillButton,PopoverMenu,PopoverItem}.tsx`(+tests): **clean, zero matches.**

### Test/typecheck/coverage results

- `pnpm --filter @jini/ui run typecheck`: green (zero errors) — required the same `exactOptionalPropertyTypes` discipline as prior sections (every optional hook/prop param needs `| undefined` added explicitly, not just `?`), plus one `renderHook` generic-inference gotcha (an arrow function parameter's *explicit* type annotation does not feed back into inferring the call's own generic type parameters — TypeScript inferred a narrowed union member from `initialProps` instead of the intended full `ScheduleValue` union; fixed by passing `renderHook`'s `<Result, Props>` type arguments explicitly rather than relying on inference).
- `pnpm --filter @jini/ui exec vitest run`: package-wide **160 test files, 1372 tests, all green** (up from the pre-existing 140 files/1209 tests baseline) — this task contributes 12 new test files/79 tests for `schedule-picker` (+ its 3 flat components/timezone util) and 8 new test files/81 tests for `mention-autocomplete`.
- Coverage (`vitest run --coverage`, `json-summary`+`json` reporters, per the Phase 9.5 method): **100% statements/branches/functions/lines on every single new file in both features**, confirmed via the real per-file `coverage-summary.json` numbers (the v8 text-table reporter alone would have hidden this — it drops rows once there are many files, per this package's `vitest.config.ts` comment). The full classify-then-fix loop was needed twice: (1) `groupItemsByCategory`'s per-category cap vs. a single shared cap across all categories — caught by branch coverage before it became a real bug, not just a style choice; (2) the two genuinely-dead `?? ''`/`?? timezone` fallbacks noted in the Phase 8.5 section above, refactored to non-null assertions rather than tested around, per the "never fake the number" rule. No `/* v8 ignore */` or any coverage-suppression comment was used anywhere. The package-wide aggregate (`coverage-summary.json`'s `total`) sits at 93.1%/90.83%/92.67%/93.1% (statements/branches/functions/lines) — this is **pre-existing debt in files this task never touched** (e.g. `utils/notifications.ts` at 67%, `utils/scroll-to-top.ts`, several untested hooks under `src/hooks/`), not a regression; every file this task actually authored or edited is at 100%, which is the bar the task brief's Phase 9.5 method targets (per-file, not a blanket whole-package retrofit).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.
- Full monorepo `pnpm -r run typecheck`: fails only at `packages/agent-runtime` and `packages/chat-react` (both missing a `tsconfig.json` entirely) — pre-existing and already documented in this file's `settings-dialog`/`connectors` sections above; unrelated to this task's changes.
## Section: `features/asset-tree-browser/` — file-tree browser + preview pane (2026-07-18)

Source: a real design-tool origin project's web tree, branch
`refactor/web-memory-slice` @ commit `d695f1e0f2b85a032aa7ce4895a3eb764cb1b65d`,
file `apps/web/src/components/DesignFilesPanel.tsx` (1,731 lines), read in
full and re-verified line-by-line while porting each piece (per
`docs/jini-port/skills/fixing-open-design-web.md`'s standing instruction —
never invent behavior from a summary). Task brief: extract a generic
`AssetTreeBrowser<TFile>` + `FilePreviewPane<TFile>` UI feature into
`packages/ui/src/features/asset-tree-browser/`. This had never been
attempted before this session — no prior branch or partial work existed.

Structural precedent: `features/asset-grid/` (the shipped `types.ts`/
`constants.ts`/`rules.ts`/`ports.ts`/`dependencies.ts`/`index.ts` +
`react/hooks/`+`react/components/` layout, the `Selectors<TAsset>`
accessor-object discipline, and the "ship a real browser-generic port,
fake only the genuinely host-specific one" split).

### What shipped — `packages/ui/src/features/asset-tree-browser/`

| File | Contents |
|---|---|
| `types.ts` | `AssetTreeFileItem`/`AssetTreeFolderItem` (`{path: string}` identity constraints, mirroring `AssetGridItem`'s `{id: string}`), `AssetTreeSelectors<TFile>` (`getSize`/`getModifiedAt`/`getKind`/optional `getLocalPath`), `AssetTreeKindConfig`/`AssetTreeKindConfigMap` (host-supplied label+glyph per kind), `AssetTreeSection<TFile>`, `AssetTreeNavState`, `AssetTreeToolbarAction`, `AssetTreeBreadcrumbSegment`, `AssetTreeRelativeTime` (the `{label, translatable, params?}` i18n-safe shape — see the i18n section below), `AssetTreeRenameState`, `AssetTreeMenuPosition`. |
| `constants.ts` | `DEFAULT_KIND_CONFIG_MAP`/`DEFAULT_KIND_GLYPH`/`DEFAULT_SECTION_ORDER` (all empty — an unconfigured host still gets every kind rendered, just under its raw key), `EMPTY_TOOLBAR_ACTIONS` (a stable `[]` so omitting `toolbarActions`/`emptyStateActions` doesn't allocate a fresh array every render), `ROW_MENU_ESTIMATED_HEIGHT_PX`/`ROW_MENU_SAFE_PADDING_PX`, `COPY_LOCAL_PATH_CONFIRM_MS` (1600ms, matching the origin), `DOUBLE_ACTIVATION_WINDOW_MS` (300ms, matching the origin's keyboard double-Enter-to-open window). |
| `rules.ts` | `deriveTreeChildren` (dirs/files at the current level — preserves a genuinely surprising origin behavior verbatim, see below), `groupFilesByKind` (kind sections ordered by host `sectionOrder`, unconfigured kinds appended in first-seen order — a generification the origin never needed since its `SECTION_ORDER` enumerated every possible kind), `nextExistingAncestorDir` (the auto-navigate-up-when-the-viewed-dir-vanishes logic), `countFilesUnderDir`, `toggleInSet`/`pruneMissingPaths` (selection, path-keyed instead of id-keyed), `basenameForRename`/`resolveRenameCommit` (the rename-commit decision, extracted from inline branching), `computeMenuPosition` (the row-menu's pure viewport-flip math), `canCopyLocalPath`, `isDoubleActivation`, `resolveKindConfig`, `humanBytes` (verbatim, no i18n — matches the origin, which never translated it either), `relativeTimeResult` (returns `{label, translatable, params?}`, not a finished string — see i18n section), `fileExtensionLabel`, `buildBreadcrumbSegments`, the clipboard-paste parsing quartet (`filesFromClipboardData`/`normalizePastedFile`/`extensionForMimeType`/`shouldIgnoreClipboardFilePaste`), and the drag-drop recursive-folder-expansion quartet (`filesFromDataTransfer`/`filesFromFileSystemEntry` + two private helpers) — all ported near-verbatim from the origin, reusing the already-shipped `utils/file-system-errors.ts` for the read-failure wrapping instead of reimplementing it. |
| `ports.ts` | `AssetTreeClipboardPort` (`copyToClipboard`), `AssetTreeDomBridgePort` (`subscribeOutsideDismiss`/`subscribeGlobalPaste`/`getViewportHeight`), `AssetTreeDependencies`. See the "deliberate correction" note below for `subscribeOutsideDismiss`'s signature. |
| `dependencies.ts` | `createBrowserAssetTreeClipboardPort`/`createBrowserAssetTreeDomBridgePort`/`createBrowserAssetTreeDependencies` — all REAL, SSR-guarded implementations (both ports are genuinely browser-generic, same reasoning `asset-grid`'s `createBrowserSseLiveUpdatesPort` used), bound to the already-shipped `utils/copy-to-clipboard.ts` and `utils/dom-subscriptions.ts` rather than reimplemented. `createFakeAssetTreeDependencies` — an inert test double for this feature's own tests (and any host's). |
| `react/hooks/useAssetTreeNavigation.ts` | Current-directory state (seeded from `navState`, reported upward via `onNavStateChange` — a one-time seed + report-upward callback, not a fully controlled prop, matching the origin's own `navState`/`onNavStateChange` pair), `dirsAtCurrentDir`/`filesAtCurrentDir`/`sections` derivations, the ancestor-correction effect. |
| `react/hooks/useAssetTreeSelection.ts` | Path-keyed `Set` selection: toggle/clear, reset-on-nav, prune-on-vanish, `renamePath` (carries a selection over to a renamed path), and `pendingRenamePath` — a fix discovered while writing the orchestrator's own integration test, see below. |
| `react/hooks/useAssetTreePreview.ts` | Which file is previewed (resolved against the FULL `files` list, not just the current directory — the origin never clears the preview on navigation, so neither does this), one-time auto-initial-preview via an optional host `selectInitialPreviewFile`, clear-on-vanish. |
| `react/hooks/useAssetTreeRename.ts` | Start/edit/commit/cancel. One deliberate behavior change from the origin: a failed rename surfaces as `renameError` state instead of a blocking native `alert()` — see below. |
| `react/hooks/useAssetTreeRowMenu.ts` | The `⋯` context menu's open/positioned/dismiss state, wired to `AssetTreeDomBridgePort`. |
| `react/hooks/useAssetTreeDragUpload.ts` | Drag-depth-tracked drag-over overlay + the drop handler (recursive folder expansion via `rules.ts`). |
| `react/hooks/useAssetTreeClipboardPasteUpload.ts` | The global paste listener (parsing/filtering already done by the DOM bridge port — see dependencies.ts). |
| `react/hooks/useAssetTreeBatchActions.ts` | Batch delete (busy-gated, deliberately doesn't clear `selected` itself — matches the origin's own "leave the selection intact for retry" comment) + optional batch download (`triggerBrowserDownload`, a real anchor-click download trigger). |
| `react/hooks/useAssetTreeCopyLocalPath.ts` | The row menu's "copy local path" action + its transient "Copied" confirmation (setTimeout-based revert). |
| `react/components/AssetTreeBreadcrumbs.tsx` | Root label (non-interactive at the root, a button once navigated away) + one segment per path component. |
| `react/components/AssetTreeToolbar.tsx` | Renders host-supplied `toolbarActions` — this package ships zero built-in toolbar buttons (the origin's New-Sketch/Paste/Upload/Library/project-menu buttons are all OD-specific product actions with no generic equivalent). |
| `react/components/AssetTreeSelectionBar.tsx` | Selected count, optional batch-download button, batch-delete (busy-gated), clear. |
| `react/components/AssetTreeFileRow.tsx` | Hover-revealed checkbox + `⋯` menu trigger, click-to-preview/dblclick-to-open on the icon/name/size/time cells, inline rename input, keyboard parity (Enter/Space previews, a second activation within `DOUBLE_ACTIVATION_WINDOW_MS` opens — mirrors the origin's mouse double-click via keyboard). |
| `react/components/AssetTreeFolderRow.tsx` | Navigates on click (both the row and its name button, matching the origin's doubled click targets), shows the deep (not just immediate-level) file count via `countFilesUnderDir`. |
| `react/components/AssetTreeRowMenu.tsx` | The popover itself: open / rename / copy-local-path (disabled unless `getLocalPath` resolves one) / download (hidden unless `getFileUrl` is supplied) / delete. |
| `react/components/FilePreviewPane.tsx` | The separately-named export the task explicitly calls for: thumbnail slot (host-supplied `renderThumbnail`, defaults to a glyph placeholder) + meta footer (full path, kind, modified/size/extension stats, download link) + Open action. `thumbnailIsInteractive` generifies the origin's hardcoded `kind !== 'audio' && kind !== 'video'` check (this package has no fixed kind enum to hardcode against). |
| `react/components/AssetTreeEmptyState.tsx` | Shown when the directory has no files, folders, or persisted folders at all; renders host-supplied `emptyStateActions`. |
| `react/components/AssetTreeUploadErrorBanner.tsx` | A dismissible banner for a failed drag-drop-folder read. |
| `react/components/AssetTreeBrowser.tsx` | The orchestrator — composes all 9 hooks, renders the Folders section (pinned above kind sections), each kind section, the preview pane, and the row menu. Defaults `dependencies` to `createBrowserAssetTreeDependencies()`. |
| `index.ts` | Public barrel — every type/constant/rule/port/dependency-factory/hook/component, matching `asset-grid/index.ts`'s re-export granularity. Also wired into the package-wide `src/index.ts` barrel (`export * from './features/asset-tree-browser/index.js';`), placed alongside the `asset-grid` line. |

### Dropped (origin-specific, non-separable) — cross-checked line-by-line against the real file, not assumed

- **The "live artifacts" section** (`liveArtifacts` prop, `LiveArtifactBadges`, `onOpenLiveArtifact`) — a workspace-tabs-pointing-at-a-live-preview concept, a different domain entirely from file-tree browsing.
- **"Plugin folders" section** (`getPluginFolderCandidates`, `PluginFolderAgentAction`, install/publish/contribute buttons, `buildActionNotice`/`escapeRegExp` notice-parsing) — a plugin-ecosystem feature specific to the origin product.
- **The project menu** (`onCreateDesignSystem(FromProject)`, `onDuplicateProject`, the dropdown) — origin-specific project actions; a host that wants these back adds them via `toolbarActions`.
- **`RotatingTip` footer + the entire tip-copy array** — hardcoded marketing copy with literal social-media links. Product content, full stop — not even the typewriter *mechanism* is ported. A host supplies its own `footer` slot if it wants one; this package ships none by default.
- **`onRefreshFiles`** — declared in the origin's own `Props` interface but genuinely dead: grepped the full 1,731-line file and confirmed it's never called anywhere in the component body (the parent evidently wires the actual refresh button elsewhere). Not ported at all — including a no-op prop for it would be inventing behavior the origin itself doesn't have.
- **"Select from library" special-casing** (`LIBRARY_UI_VISIBLE`/`onSelectFromLibrary`) — generalizes into just another `toolbarActions` entry; no dedicated prop.
- **Analytics** (`useAnalytics()`/`trackFileManagerClick`) — fire-and-forget tracking pings gating no actual behavior; dropped entirely, no `onAction` telemetry callback added either (would be inventing a hook the origin's own calls don't need).
- **`buildSrcdoc`-based HTML iframe preview** and **Excalidraw-shaped sketch-JSON preview** — both are file-kind-specific rendering strategies this generic package cannot know about. Replaced by the single `renderPreviewThumbnail` host slot on `AssetTreeBrowser` (threaded to `FilePreviewPane`'s `renderThumbnail`), defaulting to a generic glyph-in-a-box placeholder.
- **`projectFileUrl`/`projectRawUrl`** (daemon-REST-endpoint builders) — fully replaced by the host-supplied `getFileUrl` callback prop; the builder functions themselves aren't ported at all.
- **The stylesheet-splitting display refinement** (`FileCategory = ProjectFileKind | 'stylesheet'`, the `STYLESHEET_EXTENSIONS` extension-sniffing carve-out that gave CSS/SCSS/etc. their own section separate from `code`) — this is presentation policy layered atop a fixed kind enum this package doesn't have. A host that wants the same effect encodes it directly in its own `getKind` implementation (return `'stylesheet'` for CSS-family extensions).
- **`kindFilter`/`page`/`pageSize`** on the origin's `DesignFilesNavState` — re-verified against the real file per the task brief's own instruction to double-check this: the origin component itself never applies a kind filter or paginates its own rendering (no filter UI, no pager UI anywhere in the file); those fields exist only to be reported upward to a parent outside this component. Confirmed absent from `AssetTreeNavState`, which carries only `currentDir`.

### Two corrections discovered while writing the orchestrator's own integration tests

Both are documented inline in the source, not just here:

1. **`useAssetTreeSelection` gained an optional `pendingRenamePath` param.** The origin's `commitRename` calls `await onRenameFile(...)` then patches `selected`/`preview` afterward — but its selection-pruning effect depends on `[files]` independently, with no coordination between the two. A host that updates its `files` prop as soon as `onRenameFile` resolves (a very plausible, even synchronous, real-world pattern — this session's own `AssetTreeBrowser.test.tsx` rename test hit it immediately with a stateful test harness) can re-render *before* the orchestrator's own `onRenamed` callback gets to run, pruning the in-flight old path out of the selection before it ever gets swapped for the new one — silently dropping the user's selection on every rename. `pendingRenamePath` (the path `useAssetTreeRename` currently has in flight, if any) exempts it from pruning until the rename actually resolves, closing the race. Proven by two dedicated `useAssetTreeSelection.test.ts` cases (with and without `pendingRenamePath`, showing the fix and the bug it fixes side by side) plus the orchestrator's own "renames a file, carrying an active selection and preview over to the new path" end-to-end test, which uses a small stateful `RenameHarness` wrapper specifically to exercise this race realistically rather than against a static `files` array.
2. **The row menu's copy-local-path action no longer closes the popover on click.** The origin's equivalent handler called `setMenuPos(null)` immediately before `copyLocalPath(name)` — every other menu action does this too, but for copy-local-path specifically it means the dedicated `copiedLocalPath`/"Copied" confirmation state can *never actually be seen*, since it only ever renders inside the now-unmounted popover. This reads as a real latent bug in the origin rather than intentional design (the whole point of a transient-confirmation label is to be visible). Fixed by not closing the menu for this one action; the existing outside-dismiss/Escape handling still closes it normally afterward. Proven by the orchestrator's "gates copy-local-path..." test, which asserts the "Copied" label actually renders.

Also, `useAssetTreeRename`'s failed-rename path surfaces `renameError` state instead of calling a blocking native `alert()` (the origin's own behavior) — a deliberate divergence, not an oversight: this package ships into a headless, agent-drivable engine (per this repo's own `AGENTS.md`), where a hardcoded blocking dialog call is exactly the kind of host-hostile side effect a generic UI feature must not own.

And `AssetTreeDomBridgePort.subscribeOutsideDismiss` takes a `container` parameter not present in the task brief's original type sketch — it binds to the already-shipped `utils/dom-subscriptions.ts`'s real `subscribeOutsideClickOrEscape(container, onClose)` signature (proper containment-based outside-click detection) instead of the origin's cruder "any `mousedown` anywhere closes the menu, and the popover manually stops its own `mousedown` from bubbling to protect itself" trick. Documented inline in `ports.ts`.

### The root-level "flattened tree" quirk — verified, not assumed, and preserved

`deriveTreeChildren` preserves a genuinely surprising piece of the origin's own `dirsAtCurrentDir`/`filesAtCurrentDir` `useMemo` verbatim: at the tree root (`currentDir === ''`), **every** file is pushed into `filesAtCurrentDir` — both root-level files and files nested under a subdirectory (which *also* separately contribute their top segment to `dirsAtCurrentDir`) — so the root view is a flattened "everything" listing with folders offered only as a secondary drill-down. Once navigated into any non-root directory, only files strictly at that one level are included. This asymmetry looked enough like a bug to warrant re-reading the real source line-by-line before committing to it (per the task's own "don't trust it blindly" instruction) — but it's exactly what the code does, so it's preserved rather than "fixed," with a `rules.test.ts` case asserting it explicitly (`'at the root, flattens every file (including nested) and surfaces the top-level dir'`).

### i18n wiring

Every user-facing string in every new component is routed through `useT()`,
English string as the key. Two pure `rules.ts` functions return
i18n-safe discriminated shapes instead of finished strings, so a caller can
translate without minting a new dictionary key per distinct value:
- `relativeTimeResult(ts, now)` returns `{label, translatable, params?}` —
  `translatable: true` means `label` is a stable template key
  (`'{n}m ago'`/`'Just now'`/etc.) to pass through `t(label, params)`;
  `translatable: false` means `label` is already a locale-formatted date
  string (`Date#toLocaleDateString`), which isn't a sensible translation key
  since it varies per call — mirrors `asset-grid/rules.ts`'s
  `dayHeadingResult`'s exact same `{label, translatable}` reasoning.
- Folder/section file counts and the selection/batch-bar counts use the same
  discipline directly at the call site (`t('{n} files', { n: count })`,
  `t('{n} selected', { n: count })`) rather than a dedicated rules.ts
  helper, since there's no branching logic to extract — just an
  interpolated template.

Verified end-to-end (not just that `t()` calls compile) by
`AssetTreeBrowser.test.tsx`'s "renders translated copy when mounted under an
I18nProvider with a matching dictionary" test, mounting under a French
dictionary and asserting `Fichiers`/`Dossiers` actually render in place of
the English `Files`/`Folders` fallbacks.

### Phase 8.5-equivalent audit — what it caught

- **Inline JSX callbacks with real branching**: the row's keyboard-Enter
  double-activation dispatch (`handleNameKeyDown` in `AssetTreeFileRow.tsx`)
  and the menu-trigger's click/keydown dispatch (`handleMenuTrigger`) were
  both extracted to named functions inside the component (not `rules.ts`,
  since they call the row's own props/refs directly) rather than left as
  inline arrows; the underlying *decision* logic each dispatches to
  (`isDoubleActivation`, `computeMenuPosition`) is pure and lives in
  `rules.ts`, unit-tested in isolation. The row menu popover's own
  `onMouseDown`/`onClick` `stopPropagation()` one-liners were left inline —
  the same single-line "don't bubble" idiom already established as
  acceptable inline elsewhere in this package (e.g. `asset-grid`'s
  `DeleteConfirmDialog.tsx` backdrop click).
- **Multi-line/inline-construction `useMemo`/derivation bodies**: none of
  the 9 hooks compute anything beyond a one-line call into an already-pure
  `rules.ts` function or a plain default-selection expression — the target
  end state, no extraction needed.
- **Orphaned `useState`/`useRef`**: enumerated every one across all 9 hooks
  and the orchestrator by hand — `useAssetTreeNavigation`'s `currentDir`,
  `useAssetTreeSelection`'s `selected`, `useAssetTreePreview`'s
  `previewPath` + `autoPreviewAppliedRef`, `useAssetTreeRename`'s
  `renaming`/`renameError`, `useAssetTreeRowMenu`'s `menuPos` +
  `containerRef`, `useAssetTreeDragUpload`'s `draggingFiles`/
  `dropReadError` + `dragDepthRef` + `onUploadFilesRef`,
  `useAssetTreeClipboardPasteUpload`'s two latest-value-bridging refs,
  `useAssetTreeBatchActions`'s `deleting`/`downloading`/`downloadError`,
  `useAssetTreeCopyLocalPath`'s `copiedPath`, `AssetTreeFileRow`'s
  `lastActivationRef` — every one traced to a real read site, none
  unassigned.

`pnpm --filter @jini/ui run typecheck` was re-run clean after every fix in
this pass.

### Purity grep — reported verbatim per this task's own instructions

```
$ grep -rn "Open Design\|OD_\|--od-stamp\|open-design\.ai\|openDesignDesktop\|@open-design/" packages/ui/src/features/asset-tree-browser/
(no output — clean)

$ grep -rn "od-" packages/ui/src/features/asset-tree-browser/
(no output — clean)
```

One doc comment in `AssetTreeBrowser.tsx` initially read "Ported from Open
Design's `DesignFilesPanel.tsx`" — caught by the first grep above during
this same pass and reworded to "Ported from a design-tool origin project's
file-manager panel," matching this section's own prose-only provenance
convention (bare source filenames like `DesignFilesPanel.tsx` are fine to
cite — 15 files across this feature do — the product name itself is not).

### Test/coverage/typecheck/guard results — verbatim

- `pnpm --filter @jini/ui run typecheck`: **clean, zero errors** (confirmed both mid-pass and as the final check).
- `pnpm --filter @jini/ui exec vitest run src/features/asset-tree-browser --coverage --coverage.reporter=json-summary --coverage.reporter=json`: **251 tests, 22 files, all green.** Coverage read from the real `coverage-summary.json` (not the v8 text table, which silently drops rows — per this task's own Phase 9.5 method), aggregated across every file in the feature:
  ```
  statements 1223 / 1223  100.00%
  branches    476 /  476  100.00%
  functions    94 /   94  100.00%
  lines      1223 / 1223  100.00%
  ```
  **Every individual file is 100% on all four metrics** — no file needed a specific call-out, no `/* v8 ignore */` anywhere. The loop closed in two passes: pass 1 landed at 99.92% statements / 96.30% branches / 91.49% functions aggregate; classifying every uncovered line found one genuinely dead ternary arm in `rules.ts`'s `filesFromDataTransfer` (refactored away — the `if (rejected)` guard above it already proves every remaining result is fulfilled) and one genuinely-unreachable ternary arm in `AssetTreeBrowser.tsx`'s copy-local-path handler (the button is `disabled` whenever the arm would matter, so a real click can never reach it — replaced with an asserted non-null read + comment); every other gap was a reachable-but-untested line/branch, closed with a real test (see the "corrections" and audit sections above for the interesting ones: the non-FileSystemReadError rethrow, the cancel-during-in-flight-rename race, the omitted-`folders`/omitted-`dependencies` default paths, the vanishing-menu-file race, the two-level-nested-folder path template branch).
- Full package `pnpm --filter @jini/ui exec vitest run`: **1460 tests, 162 files, all green** (no regressions in any other feature).
- Full monorepo `pnpm -r --no-bail --if-present run typecheck`: `packages/ui typecheck: Done` (clean). Summary: 9 fails, 7 passes — every failure pre-existing and unrelated to this task, the identical set the `asset-grid` section above already documented: `agent-runtime`/`chat-react`/`cli`/`http`/`node-host`/`renderers-react`/`sqlite` (7 stub packages genuinely missing a `tsconfig.json`) and `daemon`/`deploy` (2 packages failing only on unbuilt `@jini/protocol`/`@jini/core` workspace `dist/` output in this fresh checkout — a build-order issue, not a type error).
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending implementation during extraction)` — unchanged, no boundary violations introduced.

### Dependencies installed, not skipped

`node_modules` did not exist anywhere in this repo checkout at the start of
this task (confirmed: no root `node_modules`, no `vitest` binary resolvable
via `pnpm --filter @jini/ui exec vitest`). Per this task's own instruction
("do NOT run `pnpm install` at the repo root unless you find dependencies
are missing"), ran `pnpm install` once at the repo root — this genuinely
qualified as the documented exception, not a shortcut.

---
---

## Section: `features/memory/` — MemorySection vertical-slice port (2026-07-18)

### Source

**PR #5228**, `nexu-io/open-design`, "refactor(web): decompose MemorySection into a
features/memory vertical slice" —
<https://github.com/nexu-io/open-design/pull/5228> — closed 2026-07-15 **without
merging**, authored by this project's own owner. Pinned at commit
`d695f1e0f2b85a032aa7ce4895a3eb764cb1b65d` (verified: `git fetch
https://github.com/nexu-io/open-design.git refs/pull/5228/head` resolves to this
exact SHA). Primary source read in full at that commit:
`apps/web/src/features/memory/`, `apps/web/src/providers/memory/`,
`apps/web/tests/features/memory/`.

### What happened, plainly

The decomposition itself did **not** create bugs. Extensive automated review (many
rounds, over an extended review cycle) found a long sequence of real
async/state-correctness bugs — malformed-response trust, concurrency races,
missing error handling, stale state on retry — but the PR author independently
verified via `git show` against the original 2,636-line pre-refactor
`MemorySection.tsx` that **every one of those bug classes already existed
byte-for-byte in the monolith**. The decomposition didn't introduce them, it
exposed pre-existing ones that had zero test coverage (the original file's 29
tests were 100% happy-path — no test for a failed fetch, a malformed response, two
operations racing, or a retry). The author fixed round after round of these as
they were found, and closed the PR because the review process felt endless, not
because a reviewer or maintainer rejected the underlying approach — the
maintainer's own last comment explicitly agrees the bugs were pre-existing and
only asks that the PR's own remaining loose ends be closed before merging.

One specific bug was still open and unfixed when the PR was closed: `fetchMemoryList()`
in the pinned source's `providers/memory/entries.ts` validated only that the
`entries` field was present on a 2xx response, even though
`useMemoryConfig.hydrate()` (`enabled`) and `useMemoryEntries.reload()`
(`rootDir`/`index`) all consumed other fields off that same response with no
fallback. A malformed `200` like `{ entries: [] }` passed validation and then
silently hydrated those fields to `undefined` instead of surfacing a broken
response. **Fixed as part of this port** — see "The `fetchMemoryList()` fix"
below.

### Standing flag for later

Open Design's own live version of this component (the still-monolithic
`components/MemorySection.tsx` on its current `main`) likely still has these bugs
today, since the fix never merged there. If Open Design revisits this component
in the future, PR #5228's later commits (and this Jini port, which carries the
fixes forward plus the one additional fix made here) are a ready-made reference
for what a corrected version looks like.

A broader CI/CD gate generalizing the exact bug taxonomy found here
(malformed-success responses, races, missing error handling, stale state on
retry) as a standard requirement for future async-heavy ports is tracked as a
**separate follow-up**, not part of this task's scope.

### Where it landed, and why (`packages/ui/src/features/memory/`, not `chat-react`)

Per `docs/jini-port/god-components-extraction-plan.md`'s Consolidation map and
`packages/ui/README.md`'s scope boundary: Memory is a settings/data-management
surface (saved facts/preferences, an editable index, connector-sourced
suggestions) — the same shape as the already-shipped `features/connectors/` and
`features/settings-dialog/`, not a conversation surface. It lands alongside them
in `@jini/ui`, using the **new** `types.ts`/`constants.ts`/`rules.ts`/`ports.ts`/
`dependencies.ts`/`formatters.ts`/`async-commit-guard.ts`/`index.ts` at the
feature's top level, `hooks/`+`components/` under a `react/` subfolder — the
layout decided 2026-07-17, matching `features/viewer-shell/`/`features/asset-grid/`/
`features/sketch-editor/`, not `features/connectors/`'s older flat layout.

### The connector-reconciliation-reducer decision (the "third piece")

The task brief's third sought piece — "connector-reconciliation reducers" — does
**not** come from PR #5228. Its real origin is Open Design's `main`-branch
`apps/web/src/components/connectors-state.ts` (confirmed by cloning
`https://github.com/leonaburime-ucla/open-design.git` at its default `main`
branch and reading `connectors-state.ts` directly, since `codex/connector-memory-settings`,
the branch originally suspected to hold this, diffs empty against current `main`
— i.e. that logic already lives on `main` by some other route). Its 4 functions
— `connectorAuthSnapshotChanged`/`hasConnectorStatusChanges`/`mergeConnectorCatalog`/
`applyConnectorStatuses` — are a **separate, shared/generic** connector-list
reconciliation module OD's `MemorySection.tsx` monolith imports directly
(`import { hasConnectorStatusChanges } from './connectors-state'`), distinct from
PR #5228's own Memory-local `mergeMemoryConnector`/`upsertMemoryConnector`/
`applyMemoryConnectorStatus(es)`/`connectorStatusesChanged` (which the PR's own
`rules.ts` comment calls "convenience duplication" of the shared module, kept
slice-local per the PR's own stated slice conventions).

Direct line-by-line comparison found `@jini/ui`'s `features/connectors/rules.ts`
**already ships the generified port of `connectors-state.ts`** — from the
`ConnectorsBrowser.tsx` canary task (2026-07-17), see that section above —
as `mergeConnectors`/`applyConnectorStatuses`/`hasConnectorStatusChanges`/
`connectorAuthSnapshotChanged`, operating on the generic `Connector`/
`ConnectorStatusMap` types instead of OD's `ConnectorDetail`. Their logic is
identical to `connectors-state.ts`'s (verified field-by-field), and `mergeConnectors`
already subsumes what PR #5228's `mergeMemoryConnector`+`upsertMemoryConnector`
did (single-connector merge + array upsert in one pass). This is exactly the
overlap `god-components-extraction-plan.md`'s Consolidation map flagged in
advance: *"Memory slice's connector reducers... substantially overlap
`features/connectors`'... check whether it can import these directly instead of
re-deriving equivalents."*

**Decision**: `features/memory/rules.ts` imports `mergeConnectors`/
`applyConnectorStatuses`/`hasConnectorStatusChanges` from `../connectors` and
re-exposes two thin, Memory-specific conveniences over them
(`upsertMemoryConnector` = `mergeConnectors(current, next ? [next] : [])`;
`applyMemoryConnectorStatus` = the 1-item form of `applyConnectorStatuses`, used
by the synthetic not-yet-detailed catalogue row). Only `connectorWithPendingAuthorization`
(no equivalent in `features/connectors`) is genuinely new Memory-local logic.
Memory's own connector type is `Connector` from `features/connectors/types.ts`
directly (not a third near-duplicate of `ConnectorDetail`) — its shape already
matches (id/name/provider/category/status/accountLabel/lastError/tools/toolCount/
toolsNextCursor/toolsHasMore/logoUrl).

### The `fetchMemoryList()` fix

`dependencies.ts`'s `fetchMemoryList()` now validates `entries`/`rootDir`/`index`/
`enabled` are all present on a 2xx response (throwing `"Memory list request
succeeded without a '<field>' field"` if any is missing), matching the pattern
already used by the pinned source's own `fetchMemoryEntry()` (which the PR had
already fixed earlier in its history: only a genuine 404 maps to `null`, and a
successful-but-field-missing response throws via `requiredNonNullField` rather
than silently returning something falsy-but-plausible). The four per-hook flags
(`chatExtractionEnabled`/`profileEnabled`/`rewriteEnabled`/`verifyEnabled`) are
**deliberately not** added to the required set — `useMemoryConfig.hydrate()`
already treats their absence as legitimate legacy-default behavior
(`list.xEnabled !== false`), a design choice already present and already
documented in the pinned source; validating them as required would be a
*behavior* change, not a bug fix.

Before/after, `dependencies.ts`:
```ts
// BEFORE (the pinned source, still-open bug)
export async function fetchMemoryList(): Promise<MemoryListResponse> {
  const resp = await fetch('/api/memory');
  if (!resp.ok) throw new Error(`Memory list request failed (${resp.status})`);
  const json = (await resp.json()) as MemoryListResponse;
  requiredField(json, 'entries', 'Memory list request');
  return json;
}

// AFTER (this port's fix)
export async function fetchMemoryList(): Promise<MemoryListResponse> {
  const resp = await fetch('/api/memory');
  if (!resp.ok) throw new Error(`Memory list request failed (${resp.status})`);
  const json = (await resp.json()) as MemoryListResponse;
  requiredField(json, 'entries', 'Memory list request');
  requiredField(json, 'rootDir', 'Memory list request');
  requiredField(json, 'index', 'Memory list request');
  requiredField(json, 'enabled', 'Memory list request');
  return json;
}
```
Regression coverage: `dependencies.test.ts`'s `fetchMemoryList` describe block
parametrizes over all 4 newly-required fields (each rejected when absent), plus
an explicit test reproducing the exact bug-report payload (`{ entries: [] }`
alone) and a test proving the 4 per-hook flags are still NOT required.

### Transport binding: real HTTP, not a fake — a deliberate deviation from the connectors canary's precedent

`features/connectors/dependencies.ts` ships a **fake** in-memory double for its
main data port by design (the real transport is a specific third-party
OAuth-catalog vendor's API shape, which a product-neutral package shouldn't
assume). Memory's `/api/memory*` surface is different: a plain, generic
list/tree/entry-CRUD + config-PATCH + extraction-history-CRUD REST contract with
no third-party vendor coupling, and the task's own bug-fix/regression-test
requirement only makes sense against a real, testable adapter. So
`memoryConfigPort`/`memoryEntriesPort`/`memoryExtractionsPort` bind **real**
`fetch`-based adapters (ported from the pinned source's `providers/memory/{config,entries,extractions}.ts`,
with the `fetchMemoryList` fix applied) as this package's default — a disclosed,
deliberate difference from the connectors canary's fake-only convention, not an
oversight.

`memoryConnectorsPort`, by contrast, keeps the fake-by-default convention:
`fetchMemoryConnectors`/`fetchConnectorStatuses`/`connectConnector`/
`suggestConnectorMemories` all depend on the same kind of vendor-specific
OAuth-catalog discovery transport `features/connectors` already declines to ship
for real, so `createFakeMemoryConnectorsPort()` (an in-memory catalogue double,
same shape as `createFakeConnectorsPort`) is the default. `saveMemoryEntry` on
this same port is the **real** HTTP adapter, though — saving a connector
suggestion is an ordinary memory write, not a connector-transport concern, so it
reuses the entries cluster's real binding rather than being faked too.
`readPendingConnectorAuthIds`/`writePendingConnectorAuthIds` (sessionStorage) and
`notifyConnectorsChanged` (a same-page `CustomEvent`, `jini:memory-connectors-changed`
— the pinned source's cross-tab broadcast mechanism, out of scope for this
slice, same carve-out `features/connectors` already made for its own
`connectors-events.ts`) are real, SSR-guarded browser-only bridges, matching
`features/connectors`' own real-bridge-for-generic-browser-APIs convention.

### `MemoryHooksPanel` folded in from a separate OD file

The pinned source's `MemoryHowPanel.tsx` imports `MemoryHooksPanel` from OD's
**separate** `components/MemoryHooksPanel.tsx` (not part of `features/memory/`,
single consumer). Ported into this slice as
`react/components/MemoryHooksPanel.tsx` rather than left as a dangling
cross-package import — it has no other consumer in OD's tree and no reason to
live outside this feature in Jini. Its `.module.css` import was dropped (no
CSS-module build step in this package yet, same as every other component in
this package's earlier flat-group porting task) and flattened to plain
`memory-hooks-panel*` class names; its `useT()` dictionary keys were converted
to plain-English keys per this package's i18n convention (see below).

### `renderMarkdown`: a scoped-down local reimplementation, not the real `runtime/markdown.tsx`

`MemoryEntryCard.tsx`'s saved-memory preview needs to render a memory body's
Markdown. The pinned source's real `runtime/markdown.tsx` (2,881 lines) is
chat/artifact-rendering territory this package's own README already scopes out
to `@jini/chat-react`/`@jini/renderers-react` (see the "i18n/observability/utils
sweep" section above: "Deferred, not yet ported"). Rather than drop the feature
or take on that whole file, `react/render-markdown.tsx` is a ~20-line local
reimplementation covering just this one need — GFM Markdown → HTML via
`micromark`/`micromark-extension-gfm` (already real dependencies of this
package, added earlier for `utils/markdown-scroll-sync.ts`). `micromark`
escapes raw HTML in its input by default (`allowDangerousHtml` is not set), so
this is XSS-safe without a separate sanitizer pass — proven by a real test
asserting a `<script>`/event-handler payload embedded in memory-body Markdown
renders as inert text, not live markup.

### `copyToClipboard` semantics changed under the port — adapted, not ignored

`useMemoryEntries.hooks.ts`'s `onCopyPath` in the pinned source relied on
`copyToClipboard` **rejecting** when both the Clipboard API and its
`execCommand('copy')` fallback fail, catching that rejection to avoid a false
"copied" flash. `@jini/ui`'s own `utils/copy-to-clipboard.ts` (ported earlier,
2026-07-16) has a different, already-shipped contract: it **never rejects** —
it resolves `false` on total failure, having already implemented the same
Clipboard-API-then-`execCommand`-fallback chain internally. `onCopyPath` was
adapted to check the boolean return instead of catching a throw, preserving the
original intent (never claim success on a total failure) against the actual
contract of the utility this package already ships, rather than silently
becoming dead code (a `catch` block that could never fire).

### i18n

Every user-facing string across all 8 components routes through `useT()`,
following this package's "the English string itself is the key" convention
(`t('Connect')`, not `t('settings.memoryX')`) — the pinned source's OD dictionary
keys are product content and were not ported; every `t(...)` call site below
uses a plain-English default chosen from surrounding context (there was no OD
dictionary available to port the actual translated copy from, since that
content is explicitly out of scope per this package's own established i18n
policy). `constants.ts`'s `STARTERS` array changed shape accordingly — plain
`name`/`description`/`body` strings instead of dictionary-key fields — since the
manual editor's starter chips now call `t(starter.name)` etc. directly at the
render site, matching how every other pure-data module in this package already
defers translation to the call site (`rules.ts`'s `statusLabel()` precedent,
noted in the connectors section above).

### Purity grep

`grep -rn "Open Design\|OD_\|--od-stamp\|/tmp/open-design\|@open-design/\|open-design\.ai\|openDesignDesktop"`
across every file in `features/memory/`: **clean, zero matches** (two
provenance-comment leaks initially found during a self-review pass — a literal
`Open Design` in `rules.ts`'s comment and a literal `@open-design/` in
`types.ts`'s comment — were caught and reworded to `OD`, matching the
established convention already used elsewhere in this package, e.g.
`features/connectors/dependencies.ts`'s "OD's real implementation calls
`providers/registry`"). A second pass for the lowercase lookalikes this
package's earlier sections also checked (`od-*` class prefixes, `composio`)
found one real hit: the pinned source's hardcoded `provider: 'composio'` for a
synthetic not-yet-detailed connector catalogue row — replaced with a neutral
`DEFAULT_CONNECTOR_PROVIDER` constant (`'connector-catalog'`), documented in
`constants.ts` with the same reasoning `ConnectorLogo`'s Composio-CDN-slug drop
used in the connectors canary section above.

### What's intentionally not ported (host-owned, or genuinely out of scope)

- **The orchestrator itself.** Unlike the `ConnectorsBrowser.tsx` canary (which
  shipped its own full orchestrator inside the slice), PR #5228's diff never
  included OD's `components/MemorySection.tsx` — that 2,636-line file stays the
  host's own composition root, importing this slice's pieces through its
  barrel. This port ships exactly what PR #5228 shipped: ports + dependencies +
  hooks + dumb components + barrel, no orchestrator.
- **The two OAuth browser subscriptions** (the mid-authorization status poll,
  the popup-callback message listener) and **the SSE event stream**
  (`/api/memory/events`). All three open accumulating browser subscriptions;
  the pinned source's own `useMemoryConnectors.hooks.ts` file-header comment
  already documents that a single-instance host orchestrator must own these and
  drive the hook's exposed `refreshConnectorStatuses()`/`applyExtractionEvent()`
  — this port preserves that exact seam rather than inventing a different one.
  `ports.ts` correctly never declared these as slice responsibilities in the
  first place.
- **`isTrustedConnectorCallbackOrigin`/`subscribeConnectorCallback`/
  `subscribeConnectorStatusPolling`** (the pinned source's
  `providers/memory/connector-auth.ts`) — same reasoning: these back the two
  host-owned OAuth subscriptions above, not a slice-owned port method.

### Test/typecheck/coverage results

- `pnpm --filter @jini/ui typecheck`: green (zero errors).
- `pnpm --filter @jini/ui exec vitest run src/features/memory`: **423 tests, 21
  files, all green** — `async-commit-guard` (4), `rules` (12), `formatters`
  (38), `dependencies` (30, including the full `fetchMemoryList()` bug-fix
  regression suite), `index` (3, this feature's own barrel completeness
  smoke test), the extraction-history store (46, direct unit tests of the
  pure concurrency-ordering rules), 6 hook test files (`useMemoryFlash` 7,
  `useMemoryNavigation` 10, `useMemoryConfig` 33, `useMemoryEntries` 46,
  `useMemoryExtractions` 27, `useMemoryConnectors` 61), and 9 component test
  files (`MemoryHooksPanel` 6, `MemoryHowPanel` 4, `MemoryEntryCard` 8,
  `MemoryExtractionCard` 9, `MemoryList` 11, `MemoryAdvancedModal` 15,
  `MemoryManualEditor` 15, `MemoryConnectedPanel` 32, `render-markdown` 6).
  Every hook has a mounted `renderHook` test against a hand-written fake
  port; every component has both a `@testing-library/react` mount test and a
  real `I18nProvider`-mounted French-dictionary translation-proof test.
- **Coverage (v8, `json-summary`/`json` reporters): 100% on all 4 metrics —
  statements, branches, functions, lines — aggregate (2616/2616 statements,
  993/993 branches, 120/120 functions, 2616/2616 lines) AND every individual
  file**, clearing the ≥99%-with-100%-as-the-goal bar with no `/* v8 ignore */`
  anywhere. Reached via the classify-then-fix loop: every initially-uncovered
  branch was genuinely reachable and got a real test (a `requiredNonNullField`
  present-but-null case, a connector with no `accountLabel`, a blocked
  `sessionStorage` write, the editor scroll/focus effect — driven by
  attaching real DOM elements to the hook's returned refs before triggering
  it, rather than writing it off as hook-level-untestable, a suggestion's
  `toolTitle`-only source-label fallback) — except one real dead branch,
  found in `useMemoryExtractions.hooks.ts`'s `reloadExtractions()`: a
  `try/catch/finally` whose bare `catch {}` never itself throws carried a
  structurally-unreachable "exception during catch, before finally" edge
  that no test could ever satisfy. Refactored away (not suppressed) per this
  project's coverage policy — replaced the `finally` with an explicit
  `endReload()` call at each of the 3 return points, behavior-preserving.
- Full monorepo `pnpm -r --no-bail run typecheck`: 7 pass, 9 fail — every
  failure pre-existing and unrelated (stub packages with no `tsconfig.json`
  at all: `agent-runtime`/`chat-react`/`cli`/`http`/`node-host`/
  `renderers-react`/`sqlite`; `daemon`/`deploy` failing only on unbuilt
  `@jini/protocol`/`@jini/core` `dist/` resolution, per this checkout not
  having run `pnpm -r run build`) — the same set of pre-existing breakages
  every prior section in this file has already documented. `@jini/ui` itself,
  `@jini/core`, `@jini/protocol`, `@jini/platform`, `@jini/sidecar`,
  `@jini/chat-core`, and `automation/project-runner` all typecheck clean.
- Purity grep (`Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design`/
  `@open-design/`/`open-design.ai`/`openDesignDesktop`, plus the stricter
  lowercase `od-`/`composio` self-imposed pass) across every file in
  `features/memory/`: **clean, zero matches** — two provenance-comment leaks
  (a literal `Open Design` and two literal `@open-design/contracts`
  mentions, all in doc comments explaining what was ported *from*, none in
  actual code) were caught during self-review and reworded to `OD`, matching
  this package's established convention.
- `pnpm guard` (repo root): `[guard] ok (skeleton — rules pending
  implementation during extraction)` — unchanged, no boundary violations
  introduced.
