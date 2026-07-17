# `@jini/ui` — provenance

Origin: vendored snapshot at
`integrations/open-design/reference/web-src-directories/{i18n,observability,utils}/`
(read-only source for this task; real consumer check done against
`integrations/open-design/reference/components-original/`, falling back to
`integrations/open-design/reference/od-web-src.orig/` where a consumer wasn't
in the smaller snapshot). Covers the i18n/observability/utils porting task
only — see `docs/jini-port/ui-extraction-plan.md` for the separate
components/features-bucket work (not touched here).

## i18n (`src/features/i18n/`)

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

### Dropped: manual-vs-auto-detected locale tagging

Origin's `detectInitialLocale` tagged every `localStorage` write with a
`'manual'` source marker so only a deliberate "change language" action could
out-rank a freshly-read OS locale on next launch — an auto-detected pick
never got to pin the app. That's real product UX policy, not generic
mechanism, so it's not reproduced here. A host that wants the same guarantee
implements it inside its own `LocalePersistencePort` (e.g. only call
`setStoredLocale` from an explicit user action, never from the initial
detection path).

## Observability (`src/features/observability/`)

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

## Utils (`src/utils/`)

New slot on this package (README.md updated), per
`docs/jini-port/ui-extraction-plan.md`'s bucket-A note that this directory
doesn't exist yet and these are non-component pure/small-stateful helpers.
All 19 origin files were routed individually by checking real consumers via
`components-original/` (falling back to the fuller `od-web-src.orig/` tree
for 3 files whose consumers weren't in the smaller snapshot), not just
import-count — the same method the extraction plan used to catch
`composer-detail-position.ts` belonging to chat-composer rather than
generic UI.

### Ported (7)

| Jini file | Origin file | Consumers checked | What changed |
|---|---|---|---|
| `file-system-errors.ts` | `utils/fileSystemErrors.ts` | `DesignFilesPanel.tsx`, `DesignSystemFlow.tsx` (OD-product today; zero type coupling — ships per the bucket-A "reusable logic before anyone outside OD uses it" note) | Verbatim. |
| `ime-composing.ts` | `utils/imeComposing.ts` | `BoardComposerPopover.tsx`, `PreviewDrawOverlay.tsx` (OD-product canvas/composer surfaces, but the concern — IME composition handling for any text input — is UI-generic and has zero domain-type coupling) | Verbatim. |
| `notifications.ts` | `utils/notifications.ts` | `SettingsDialog.tsx`, `ProjectView.tsx` | Genericized: `labelKey: keyof Dict` (OD's fixed dictionary type) widened to a plain `string`. Hard-coded `SERVICE_WORKER_URL = '/od-notifications-sw.js'` replaced by an optional `serviceWorkerUrl` option on `CompletionNotificationOpts` (omit to skip the service-worker path entirely). Hard-coded `tag = 'od-task-${status}'` (product-identity prefix) replaced by an optional `tagPrefix` option, defaulting to `'task'`. `SUCCESS_SOUNDS`/`FAILURE_SOUNDS` label keys reworded from OD's `settings.notifySound*` dot-paths to a package-neutral `notifications.sound.*` namespace (illustrative placeholder keys — a host supplies its own i18n dictionary entries for them, same as every other UI string). |
| `platform.ts` | `utils/platform.ts` | `ProjectView.tsx`, `AvatarMenu.tsx`, `FileWorkspace.tsx` | Verbatim. |
| `smooth-scroll-to-top.ts` | `utils/smoothScrollToTop.ts` | `EntryShell.tsx`, `HomeView.tsx` (OD-product; zero coupling) | Verbatim (only file renamed to kebab-case for this package's naming convention). |
| `uuid.ts` | `utils/uuid.ts` | `DesignSystemFlow.tsx`, `ProjectView.tsx`, `workspace/useConversationChat.ts` (OD-product + chat domain; but the generator itself has zero type/domain coupling — same "ship reusable logic early" reasoning as `smooth-scroll-to-top.ts`) | Verbatim logic; doc comment's product-identity example reworded generically. |
| `visual-stability.ts` | `utils/visualStability.ts` | `DesignFilesPanel.tsx`, `SettingsDialog.tsx`, `plugins-home/cards/{DesignSystemSurface,HtmlSurface}.tsx` | Genericized the hard-coded product-identity storage key (`'open-design:visual-stability'`) into a configurable `storageKey` parameter, defaulting to `'jini:visual-stability'`. |

### Not ported — belongs elsewhere (10)

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

### Not ported — OD-specific / forbidden import (1, overlapping the table above)

| Origin file | Reason |
|---|---|
| `utils/pickAndImportError.ts` | Imports `OpenDesignHostProjectImportResult` from `@open-design/host` (forbidden import) and formats OD's desktop "Open folder failed" error flow — not a generic-UI concern, and not portable without the OD desktop-host type it's built around. |

(`utils/pluginRequiredInputs.ts` above also has a forbidden `@open-design/contracts` import, in addition to being OD-plugin-specific.)

## Dependencies

`@jini/ui` now depends on `react` (the i18n feature is a React context +
hooks). `react-dom`, `@testing-library/react`, `@types/react`,
`@types/react-dom`, and `jsdom` are dev-only, for tests. No `@jini/*`
package dependency, no OD product import — verified by grep across
`packages/ui/src/**` for `@open-design/*` specifiers and the
`Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design` product-identity strings
(both clean; see Programmer handoff report for the exact commands run).

## Package scaffolding added

- `packages/ui/tsconfig.json` (didn't exist yet) — same `tsconfig.base.json`
  extension pattern as `packages/protocol/tsconfig.json`, plus `"jsx":
  "react-jsx"` and `"lib": ["ES2023", "DOM", "DOM.Iterable"]` (this package's
  code touches `window`/`document`/`localStorage`/`PerformanceObserver`/etc.,
  unlike the framework-free packages built so far).
- `packages/ui/vitest.config.ts` + `packages/ui/vitest.setup.ts` (new) — jsdom
  test environment and a global `@testing-library/react` `cleanup()` after
  each test (needed once real component tests existed in this package; no
  prior `@jini/*` package needed a DOM test environment).
- `packages/ui/package.json` — added `react` as a runtime dependency and the
  test-only React/DOM/testing-library dev dependencies described above.

## Not ported — out of task scope (unchanged from before this task)

`src/features/byok-config/`, `mcp-config/`, `rich-text-input/`,
`workspace-tabs/`, and the flat-group `src/components/` bucket (Icon.tsx,
Toast.tsx, etc.) from `docs/jini-port/ui-extraction-plan.md` are untouched —
explicitly out of scope per this task's brief.
