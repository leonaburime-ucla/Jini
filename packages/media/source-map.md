# `@jini/media` — provenance

Origin: `nexu-io/open-design` (fork `leonaburime-ucla/open-design`), branch `main`,
commit `0b88ef5` (2026-07-18 clone), local reference clone `/tmp/od-source`. All 11
files named in the task brief were read in full:

- `apps/daemon/src/media/models.ts` (245 lines)
- `apps/daemon/src/media/config.ts` (grepped in full for exported functions/env
  var names — not read line-by-line beyond that, since it is entirely
  `OD_*`-env/OD-project-path resolution logic explicitly out of scope; see
  "Not ported" below)
- `apps/daemon/src/media/index.ts` (155,475 bytes — the multi-provider REST
  dispatch/execution engine; grepped for its exported surface (`generateMedia`
  is the only top-level export), not read in full — see "Not ported" below)
- `apps/daemon/src/media/policy.ts` (92 lines)
- `apps/daemon/src/media/tasks.ts` (335 lines)
- `apps/daemon/src/media/amr-image-staging.ts` (77 lines)
- `apps/daemon/src/media-adapters/capabilities.ts` (41 lines)
- `apps/daemon/src/media-adapters/index.ts` (15 lines)
- `apps/daemon/src/media-adapters/seed.ts` (128 lines)
- `apps/daemon/src/media-adapters/types.ts` (116 lines)
- `apps/daemon/src/media-adapters/video.ts` (293 lines)

plus `packages/contracts/src/api/media.ts` (the `MediaExecutionPolicy` type +
`mediaExecutionPolicyDenial` function `policy.ts` wraps — read to recover the
actual generic logic `policy.ts` itself only re-exports).

Per `docs/jini-port/START-HERE.md`/dispatch brief: this is a genuinely new
package — **not in `extraction-plan.md`'s locked §3 package set** (same
situation as `@jini/deploy`, flagged there for the identical reason: named
only in roadmap-appendix-adjacent prose, not in the locked list). This is
added to `AGENTS.md`'s package list flagged as needing Coordinator/
Software-Architect sign-off before it is treated as locked architecture, per
the same precedent `@jini/deploy`'s `source-map.md` set.

## Package map

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/types.ts` | `media/models.ts` (catalogue shape: `MediaProvider`, `MediaModel`) + `media-adapters/types.ts` (request-builder shape: `ModelCapability`, `MediaFamily`, `MediaType`, `ExtraBodyParamDef`, `VideoBuildInput`, `BuiltVideoRequest`, `NormalizedVideoResponse`) | Ported near-verbatim — both origin files are already product-neutral (the task brief's own research confirmed `media-adapters` is "a clean, already-generic port"). Fields made `readonly`/arrays `readonly T[]` per this repo's stricter `tsconfig.base.json` conventions (not present in the origin). No OD nouns existed in either source file to strip. |
| `src/providers.ts` | `media/models.ts` (`MEDIA_PROVIDERS`, `IMAGE_MODELS`, `VIDEO_MODELS`, `AUDIO_MODELS_BY_KIND`, `MEDIA_ASPECTS`, `VIDEO_LENGTHS_SEC`, `AUDIO_DURATIONS_SEC`, `findMediaModel`, `findProvider`, `modelsForSurface`) + `media/config.ts`'s `PROVIDER_ENV_CANDIDATES` (de-branded) | The ~25-vendor catalogue (OpenAI, Fal.ai, Leonardo.ai, MiniMax, ElevenLabs, Volcengine, xAI, ...) ported verbatim — every id/label/hint names a real third-party vendor, not an OD concept, so it is reference data under the AGENTS.md product-identity boundary, not a string to strip. Two entries dropped: `codex` provider + `codex-gpt-image-2` model (Codex-CLI-subscription-based auth is an OD-specific local-CLI-login integration, not a REST credential shape any other Jini consumer could use) — flagged explicitly rather than silently omitted. `PROVIDER_CREDENTIAL_ENV_VARS` is a **new, de-branded** table: the origin's `PROVIDER_ENV_CANDIDATES` in `config.ts` led every provider with an `OD_*`-prefixed project-scoped override var (e.g. `OD_OPENAI_API_KEY` before `OPENAI_API_KEY`) — that override convention is a host's own project-local-secrets-layer concern, not vendor reference data, so it was dropped; only the generic (non-`OD_`) env var names survive, in the same priority order. One `modelsForSurface` behavior change from the origin: the origin falls back to `AUDIO_MODELS_BY_KIND.music` via `AUDIO_MODELS_BY_KIND[k] \|\| AUDIO_MODELS_BY_KIND.music` (defensive against an unvalidated JS string key); here `audioKind` is a real `AudioKind` union type, so indexing `Record<AudioKind, ...>` is exhaustive and the fallback is genuinely dead code — removed per the coverage-driven-refactor loop's "dead branch → refactor away" rule (Phase 6.5) rather than writing a contrived test to hit an unreachable `??`. |
| `src/capability-registry.ts` | `media-adapters/capabilities.ts` | Verbatim pattern-for-pattern port — the task brief's own prior research already verified this as "a clean, already-generic port." `CapabilityRegistry`'s `get()`/`register()`/`all()` shape, `normalizeModelId`'s `aihubmix-` prefix strip, and the seed-injection design are unchanged. |
| `src/seed.ts` | `media-adapters/seed.ts` | Ported verbatim (real, vendor-call-verified `ModelCapability` reference data). Renamed `AIHUBMIX_VIDEO_SEED` → `MEDIA_CAPABILITY_SEED` — the origin's name ties the *data* to one specific aggregator (AIHubMix) it happened to be sourced through, but the data itself (Seedance/Wan/Sora/Veo/HappyHorse wire behavior) is vendor reference data, not an AIHubMix-owned concept; the rename keeps the package's public surface aggregator-neutral while the file's header comment still documents the AIHubMix provenance. |
| `src/video-request.ts` | `media-adapters/video.ts` | Ported verbatim (pure, transport-free request-shape builder: `resolveWireModel`, `deriveVideoFamily`, `snapDuration`, `snapResolutionToken`, `snapVeoSize`, `snapSizeToSupported`, `buildVideoRequest`, `normalizeVideoResponse`). This wasn't explicitly named in the task brief's four deliverables (types/registry/task-store/policy/catalogue), but it is the direct, equally-generic sibling of `capability-registry.ts` within the same already-generic `media-adapters` layer the brief itself flagged as clean — porting the registry without the request-builder that makes it useful would leave `ModelCapability` data with no consumer in this package. `normalizeVideoResponse` was rewritten (not behaviorally changed) to avoid `any`-typed property chains (`d.data?.id` etc.), since `packages/@jini/**` bans `no-explicit-any` on public surfaces per extraction-plan.md §7 — the origin's optional-chaining fallback logic is preserved exactly, just typed through `Record<string, unknown>` casts instead of implicit `any`. |
| `src/task-store.ts` | `media/tasks.ts` | **Generalized, not lifted** — the origin is a synchronous `better-sqlite3` CRUD module (raw SQL schema, `db.prepare(...).run(...)`) keyed on `projectId` (an OD domain noun) with a hand-written JSON-column serialization layer. Per extraction-plan.md §2.6 ("ports are async-only from day one") and the precedent `@jini/daemon`'s `EventLog` already set (`packages/daemon/src/event-log.ts`: a port interface + `createInMemoryEventLog` reference implementation, no SQL), this is a from-scratch `MediaTaskStore` port + `createInMemoryMediaTaskStore` reference implementation reproducing the same lifecycle semantics: `queued→running→done\|failed\|interrupted` status machine, `listByOwner`'s terminal-status filtering (renamed from `listMediaTasksByProject`; `projectId` → generic `ownerRef`, an opaque host-supplied scoping key — never an OD project id), and `reconcileOnBoot`'s two-phase boot reconciliation (mark in-flight tasks `'interrupted'`, delete terminal tasks past a TTL) ported behaviorally intact from `reconcileMediaTasksOnBoot`. No SQL schema, no `better-sqlite3` dependency — a durable adapter (a future `@jini/sqlite` addition) implements the same `MediaTaskStore` interface, per this task's explicit scope note ("do NOT build a sqlite-backed version, that's a future task"). |
| `src/policy.ts` | `media/policy.ts` + `packages/contracts/src/api/media.ts` | **Generalized, not lifted.** `media/policy.ts` itself is a thin wrapper re-exporting `@open-design/contracts`'s `MediaExecutionPolicy`/`mediaExecutionPolicyDenial` — reading only that file would have missed the actual logic, so `packages/contracts/src/api/media.ts` was read too. That underlying logic (`mode: 'enabled'\|'disabled'` + optional `allowedSurfaces`/`allowedModels` allowlists, denying with one of three codes) carries **zero OD-specific moderation content or thresholds** — it's a plain gate, confirmed by reading the real function body, not inferred. So it ports as a redefinition: `MediaPolicy` is now a **host-injected port** (`evaluate(target): MediaPolicyDenial \| null`), and `createAllowlistMediaPolicy(policy)` is the reference implementation reproducing the origin's exact gate logic (verbatim behavior, including the "empty array means unrestricted" semantics) — proving the port's shape rather than being the only possible policy a host could wire. A host that needs real content-moderation (NSFW classifiers, per-tenant quotas) implements `MediaPolicy` itself. The doc comment "Run-scoped policy controlling **Open Design**-owned media generation only" was rewritten to drop the product name (per AGENTS.md's product-identity boundary) — the underlying mechanism it describes is unchanged. |
| `src/staging.ts` | `media/amr-image-staging.ts` | **Generalized, not lifted verbatim, despite an unusually clean origin.** The filename and the task brief both flag this as "AMR/vela-vendor-specific," but reading the actual file (77 lines, in full) found **zero AMR/vela coupling in the logic itself** — it is a generic "copy a local file into a staging dir under `cwd`, with root-containment checks and TTL-based pruning" utility; the only OD-specific thing was the hardcoded `.amr-attachments` directory name. Ported as a real, testable `AttachmentStaging` port + `createFsAttachmentStaging` reference implementation (not just an interface — the task brief explicitly allowed either, and a real implementation is more useful and was directly testable). Renamed `stageAmrImagePaths` → `AttachmentStaging.stage`; `STAGING_DIRNAME` (`'.amr-attachments'`, module-level constant) → `stagingDirName` (a per-instance option defaulting to `'.media-attachments'`, so a host can namespace multiple staging areas). `STAGING_MAX_AGE_MS` → `maxAgeMs` option, same default (24h). All logic (root-containment via `path.relative`, prune-by-`mtimeMs`, collision-avoiding `randomUUID()`-prefixed copy, best-effort error swallowing for malformed/missing paths) ported behaviorally intact. |
| `src/tokens.ts` | *(new)* | `CapabilityRegistryToken`/`MediaTaskStoreToken`/`MediaPolicyToken` via `@jini/core`'s `token()` (`packages/core/src/token.ts`), following the exact naming convention `@jini/daemon`'s `src/tokens.ts` already established (bare-interface-name suffixed `Token`, e.g. `RunStoreToken`/`EventLogToken` — not extraction-plan.md §2.2's illustrative bare-name pseudocode, which would shadow the interface names in this codebase's actual precedent). Namespaced `jini.media.*`. |
| `src/index.ts` | *(new — barrel)* | Re-exports all of the above. |

## The dispatch engine (`src/dispatch/`) — added 2026-07-21

`media/index.ts`'s `generateMedia` (the actual multi-provider REST
dispatch/execution engine, 4,055 lines / 155,475 bytes, read in full this
pass — not just grepped) is a genuinely large port: ~20 real vendor
`render*` functions plus shared plumbing. This pass ported the engine core
and an initial, fully-tested vendor slice; the remaining vendors are an
explicit, itemized gap below, not silently dropped — re-implementing all 20
safely in one sitting risks exactly the "getting a real vendor's wire
contract wrong" failure mode the original port brief warned about.

**Boundary redesign (not a verbatim lift):** the origin resolves an OD
`projectId` into a filesystem path and writes bytes there directly
(`ensureProject`/`sanitizeName`/`mkdir`/write) — Jini's kernel has no
`Project` concept at all (locked architecture §2.1). `createMediaDispatchEngine().generate()`
returns `{ bytes, providerNote, ... }` to the caller instead; a host pairs
this with its own `AttachmentStaging`/`MediaTaskStore` wiring. Reference-image
resolution follows the same pattern `video-request.ts`'s `VideoBuildInput.imageRef`
already established: the caller resolves any reference image to a data URL
before calling — this package performs no filesystem I/O anywhere, not just
in the new code. Credential resolution is dependency-injected
(`MediaDispatchEngineOptions.credentials`) rather than reading an
OD-project-scoped config file (`resolveProviderConfig`, already excluded
below); `resolveProviderCredentialsFromEnv` is an opt-in reference resolver
using `providers.ts`'s already-ported `PROVIDER_CREDENTIAL_ENV_VARS`, not
something the engine calls itself. OD's per-project model-alias layer
(`resolveModelAlias`) is also not ported (see below); the request type
carries an optional `wireModel` a host can set instead.

| Jini file | Origin (`media/index.ts`) | Notes |
|---|---|---|
| `src/dispatch/types.ts` | `MediaContext`/`RenderResult`/`ProviderConfig` shapes | Redefined per the boundary redesign above — see its own module doc comment. |
| `src/dispatch/engine.ts` | `generateMedia`'s orchestration (validation, `clampNumber`/`clampWithWarning`, dispatch if/else-if chain) | Ported behaviorally: surface/audioKind/model/catalogue validation, numeric clamping with warnings, the `customImageOverridesOpenAIModel` precedence rule. The `codexSubscriptionModel`/`useCodexSubscription` branch is dropped entirely (codex is already excluded from `providers.ts`). The fal-`ai/*`-path and `aihubmix-`-prefix catalogue-bypass branches (`isFalCustomPath`/`isCatalogBypass`) are **not yet ported** — they exist in the origin specifically to support the fal/AIHubMix renderers, which aren't wired up yet either; porting the bypass without the renderer would be dead code. Context construction was pulled out into `context.ts`'s `buildRenderContext` (see its own row below) specifically so `ctx.promptInfluence`/`ctx.imageRefs` — real origin fields not consumed by any renderer ported in this pass — could be kept in the type surface and directly, honestly tested, rather than dropped as "unobservable" or left untested. One genuinely dead branch was removed rather than tested around, matching this repo's coverage-driven-refactor convention: a `findProvider(def.provider)` null-check in the stub-fallback path (every catalogued model's `provider` id is proven present in `MEDIA_PROVIDERS` by a new `providers.test.ts` catalogue-integrity test, added this pass). |
| `src/dispatch/context.ts` | `generateMedia`'s `ctx` object-literal construction | *(new file, extracted from `engine.ts`)* `buildRenderContext(request, resolvedAudioKind, length, duration)` — pure, exported, and directly unit-tested (`context.test.ts`) independent of any renderer. This is the mechanism that lets `promptInfluence`/`imageRefs` stay real, tested fields despite having no current consumer: rather than needing a live renderer to observe their computed value (impossible for a not-yet-ported vendor) or dropping them from the type surface (a real capability regression relative to the origin), their derivation is tested directly against this function's return value. `clampNumber`'s `allowed.length === 0` guard was removed as separately-proven-dead (see the `engine.ts` row) — that one **is** a true no-behavior-change simplification, not a scope question, since it's an internal defensive guard with no user-visible capability, unlike `promptInfluence`/`imageRefs` which are real request fields. |
| `src/dispatch/openai-compatible.ts` | The shared OpenAI-wire-compatible helpers (`parseOpenAICompatibleJson`, `bytesFromOpenAICompatibleData`, `detectAzureEndpoint`, `normalizeOpenAICompatiblePath`, `buildOpenAICompatibleGenerationUrl`, `buildOpenAIImageUrl`, `buildOpenAIImageEditUrl`, `buildOpenAIVideoUrl`, `openaiSizeFor`, `buildOpenAISpeechUrl`, `sniffImageExt`, `truncate`) | Ported verbatim. Shared by OpenAI, ImageRouter, and custom-image today; AIHubMix's image/TTS renderers (not yet ported) also route through this same OpenAI-compatible shape in the origin, so porting them later should mostly be new provider-specific glue on top of this already-ported layer, not new shared plumbing. `openaiSpeechFormatFor(fileName)` was redesigned as `resolveSpeechFormat(requested)` — the origin derived the TTS response format from the caller's output filename extension; since this engine has no filename/output-path concept, the caller now passes an explicit `speechFormat` request field instead (defaults to `'mp3'`, matching the origin's default). |
| `src/dispatch/stub.ts` | `renderStub`/`svgPlaceholder`/`aspectToBox`/`silentWav` | Ported behaviorally. The origin picked SVG-vs-PNG placeholder bytes from the caller's requested output filename extension; since there's no filename here, the image stub always returns the PNG placeholder (`svgPlaceholder` is still exported standalone for a caller that wants it directly). `OD_MEDIA_ALLOW_STUBS` (an env var the origin reads itself) becomes `MediaDispatchEngineOptions.allowStubFallback` (an explicit constructor option) — this package never reads `process.env` (see `providers.ts`'s standing invariant), so the origin's fail-closed-unless-opted-in design is preserved via an option, not an env var. |
| `src/dispatch/credentials.ts` | *(new)* | `resolveProviderCredentialsFromEnv` — opt-in reference resolver, not called by the engine itself; see boundary redesign above. |
| `src/dispatch/providers/openai.ts` | `renderOpenAIImage`, `renderOpenAISpeech` | Ported verbatim, including Azure OpenAI deployment detection/handling and the long-timeout `undici.Agent` default for image generation (added `undici` as a package dependency, mirroring `packages/deploy`). The Codex-CLI-subscription fallback path (`codexSubscriptionModel`/`renderCodexImage`) is dropped — see "Not ported" below. |
| `src/dispatch/providers/imagerouter.ts` | `renderImageRouterImage`, `renderImageRouterVideo`, `imageRouterSizeFor` | Ported verbatim. Uses `providers.ts`'s already-catalogued `imagerouter` default base URL as its fallback rather than a second hardcoded constant (the origin had a local `IMAGEROUTER_DEFAULT_BASE_URL` duplicating the same value already in `models.ts`'s catalogue — de-duplicated here, not a behavior change). |
| `src/dispatch/providers/custom-image.ts` | `renderCustomOpenAIImage`, `customImageOverridesOpenAIModel` | Ported verbatim. |

### Not yet ported (real, itemized gap — not silently dropped)

Every other `render*` function in the origin, grouped by why it's deferred:

- **Async-polling vendors** (submit-then-poll-then-fetch, materially more
  complex than the synchronous ones ported this pass): Volcengine video
  (`renderVolcengineVideo`), Grok video (`renderGrokVideo`), OpenRouter video
  (`renderOpenRouterVideo`), AIHubMix video (`renderAIHubMixVideo`), Fal
  image/video (`renderFalImage`/`renderFalVideo`, queue-based), and
  **Leonardo image (`renderLeonardoImage`)** — see the 2026-07-21 addition
  below for why Leonardo moved into this bucket despite being originally
  (mis)categorized as "simple synchronous." Note: `src/video-request.ts`
  (already ported, see above) implements the seedance/wan/veo/generic family
  request-body-building logic as a separate, reusable layer — but the
  origin's actual live `media/index.ts` dispatcher does **not** call into it
  (no such import exists in `media/index.ts`); whoever ports these should
  decide whether to reuse `buildVideoRequest` or mirror the origin's
  separate implementation, not assume they're already wired together.
- **Simple synchronous REST vendors, not yet ported**: Volcengine image
  (`renderVolcengineImage`), Grok/xAI TTS (`renderXAITTS`),
  ElevenLabs TTS + SFX (`renderElevenLabsTTS`/`renderElevenLabsSfx`),
  MiniMax TTS (`renderMinimaxTTS`), SenseAudio TTS + image
  (`renderSenseAudioTTS`/`renderSenseAudioImage`), AIHubMix image + TTS
  (`renderAIHubMixImage`/`renderAIHubMixGeminiImage`/`renderAIHubMixTTS`),
  FishAudio TTS (`renderFishAudioTTS`). (Grok image, Nano Banana / Gemini,
  and OpenRouter image were ported this pass — see the 2026-07-21 addition
  below.)
- **Local-process vendors, need their own design decision, not just a
  translation**: HyperFrames (`renderHyperFramesViaCli`) shells out to a
  local `npx hyperframes render` + Puppeteer/Chrome and is tied to a
  project-directory concept the way the whole engine used to be — deferred
  alongside the general project-directory redesign, not a REST port at all.
- **`resolveProjectImage`** — the origin's own reference-image path
  resolver (containment check under an OD project dir, 16 MB size cap, mime
  allowlist, base64 data-URL encoding) is not ported as a callable utility
  in this package; per the boundary redesign, callers resolve reference
  images to data URLs themselves. A future pass could still port
  `resolveProjectImage`'s security logic (containment/size-cap/mime-allowlist)
  as a standalone, caller-owned-root utility so hosts don't have to
  re-invent it — flagged as a worthwhile small follow-up, not done this
  pass since the engine itself doesn't need it to function.
- **The fal-`ai/*`-path and `aihubmix-`-prefix catalogue bypass** in
  `generateMedia`'s model-resolution step — see the `engine.ts` row above.

## 2026-07-21 addition — three more vendor slices (Grok image, Nano Banana, OpenRouter image; backlog pass, `feat/http-routes-and-cli-commands`)

Ported the next batch of the dispatch engine's "simple synchronous REST
vendors, not yet ported" bullet (previous section). Verified against
`nexu-io/open-design` fork `leonaburime-ucla/open-design`, branch
`refactor/web-memory-slice`, commit `d695f1e0f` (2026-07-14), the same
origin `media/index.ts` the initial dispatch-engine pass cited — via `git
show lucla/refactor-web-memory-slice:apps/daemon/src/media/index.ts` from a
local `Open-Marketing` clone with that ref fetched. All three render
functions plus their helper functions were read in full (not grepped) at
their real line ranges in that 4,256-line file.

| Jini file | Origin (`media/index.ts`) | Notes |
|---|---|---|
| `src/dispatch/providers/grok.ts` | `renderGrokImage` (L1756–1812) + `grokAspectFor` (L2567–2581) | Ported behaviorally. The response shape (`{ data: [{ b64_json \| url }] }`) is identical to OpenAI's images API, so — per the task brief's explicit instruction to check for this before writing new shared plumbing — this routes through `openai-compatible.ts`'s already-ported `buildOpenAIImageUrl`/`parseOpenAICompatibleJson`/`bytesFromOpenAICompatibleData`/`sniffImageExt` rather than re-implementing URL-building/JSON-parsing/byte-extraction inline the way the origin does (verified the substitution is behavior-preserving: for a base URL like `https://api.x.ai/v1`, `buildOpenAIImageUrl(baseUrl, false)` reduces to the same `https://api.x.ai/v1/images/generations` the origin's naive `` `${baseUrl}/images/generations` `` concat produces — it's a strict improvement, additionally handling trailing slashes/query strings the manual concat wouldn't). Dropped the origin's no-credential error message's OD-specific OAuth guidance ("sign in with your SuperGrok subscription (in OD or via `hermes auth add xai-oauth`)") — this package has no OAuth chain or local-CLI-login concept; credentials are always host-injected, matching every other ported provider's plain "configure an API key or set `<ENV_VAR>`" message style. `grokAspectFor` was rewritten from the origin's one `\|\|`-chained `if` condition into a sequence of independent `if` returns, matching this package's established aspect/size-mapping style (`imagerouter.ts`'s `imageRouterSizeFor`, `openai-compatible.ts`'s `openaiSizeFor`) — same input→output mapping for all 6 cases (5 recognized aspects + default), verified by testing each one individually; not a behavior change, and incidentally the more directly-100%-branch-coverage-friendly shape for a chain of `\|\|`-guarded string-equality checks. |
| `src/dispatch/providers/nanobanana.ts` | `renderNanoBananaImage` (L1814–1859) + `nanoBananaHeaders`/`usesOfficialGoogleApiKeyHeader`/`nanoBananaAspectFor`/`inlineImageBytesFromGenerateContent` (L1861–1927) | Ported behaviorally, including the official-Google-endpoint-vs-custom-gateway header-selection logic (`x-goog-api-key` for `generativelanguage.googleapis.com`, `Authorization: Bearer` for anything else, including a malformed/unparseable `baseUrl` — the origin's own defensive `try/catch` around `new URL(baseUrl)` is preserved and directly tested, not assumed unreachable). **Not** routed through `openai-compatible.ts`'s OpenAI-images helpers — Gemini's `generateContent` request shape (`contents[].parts[].text` + `generationConfig`) and response shape (`candidates[].content.parts[].inlineData.data`) share nothing with `/images/generations`'s `{ data: [...] }` shape, so reusing those helpers would have been a shape mismatch, not a legitimate de-duplication (per the task brief's own "wherever a vendor's real implementation routes through the same OpenAI-wire-compatible shape" qualifier). Only the genuinely vendor-agnostic utilities (`truncate`, `sniffImageExt`, `withRequestInit`) are reused; the JSON-parse-with-tagged-error and nested-candidate-walk logic are new, matching the origin's own inline (non-shared) implementation. `nanoBananaAspectFor` got the same independent-`if`-returns rewrite as `grokAspectFor` above, for the same reason (no behavior change, matches this package's established style). |
| `src/dispatch/providers/openrouter.ts` | `renderOpenRouterImage` (L1947–2055) + `openRouterAspectFor` (L2287–2301) | Ported behaviorally: model-slug resolution (`credentials.model` over `ctx.wireModel`, then strip the catalogue's `openrouter/` prefix), the `gemini`-slug-in-model-name heuristic for `modalities: ['image','text']` vs `['image']`, and all three response-decoding paths (`data:` URI, plain `http(s)` URL download, bare-base64 fallback). **Not** routed through `openai-compatible.ts`'s OpenAI-images helpers — this vendor's image surface goes through `/chat/completions` (messages + `modalities`), not `/images/generations`, and its response embeds images at `choices[0].message.images[].image_url.url`, not `data[].{b64_json,url}` — a genuinely different wire shape from the same vendor's own *video* surface (which the source-map's async-polling bucket defers). Only `truncate`/`sniffImageExt`/`withRequestInit` are reused. **Dropped** the origin's `HTTP-Referer: https://opendesign.dev` / `X-Title: Open Design` request headers — OpenRouter's optional app-attribution headers (used for their model leaderboard, not required for the request to succeed), and both literal values are Open-Design product identity, out of scope per AGENTS.md's product-identity-string boundary; this package has no host-identity concept to substitute a neutral value with, and `MediaGenerationRequestInit` (`Pick<RequestInit, 'dispatcher'>`) doesn't expose a way for a caller to inject extra headers either, so this is a real (harmless, non-required) capability drop, flagged rather than silently absorbed into "de-branding." `openRouterAspectFor` got the same independent-`if`-returns rewrite as `grokAspectFor` above. |

**`engine.ts` / `ROUTES`**: added `grok: { image: renderGrokImage }`,
`nanobanana: { image: renderNanoBananaImage }`, `openrouter: { image:
renderOpenRouterImage }`. `engine.test.ts`'s two stub-fallback tests
previously used `grok-imagine-image` as their "known-unwired pair" fixture
— now that grok+image is wired, they were switched to `leonardo-phoenix`
(leonardo+image), which stays genuinely unwired (see below). Three new
engine-level dispatch-routing tests were added (mirroring the existing
openai/imagerouter/custom-image routing tests) to prove the `ROUTES` table
entries resolve correctly end-to-end, not just that each provider file's
own render function works in isolation.

**Leonardo re-categorized, not ported.** The task brief's candidate list
(inherited from this source-map's own prior "simple synchronous REST
vendors" categorization) named `renderLeonardoImage` alongside Grok/Nano
Banana/OpenRouter. Reading its real body this pass (L2303–2429) found that
categorization was wrong: Leonardo's image generation is
submit-then-poll-then-fetch — `POST /generations` returns a
`generationId`, then a `while (Date.now() - startedAt < 120_000)` loop polls
`GET /generations/{id}` every 2 seconds until `status === 'COMPLETE'` (or
throws on `'FAILED'`/timeout) before downloading the final image URL. That
is structurally the same async-polling shape as the video vendors the task
brief explicitly said not to attempt this pass (submit → poll → fetch,
needing its own timer/retry/timeout design and fake-timer-driven tests, not
a same-shape translation of the three ported above) — not a "simple
synchronous" vendor at all. Rather than force a port that doesn't fit this
pass's scope just because it was on the suggested list, Leonardo was moved
into the "Async-polling vendors" bucket in the "Not yet ported" section
above, and `engine.test.ts`'s stub-fallback fixture was repointed at it
specifically because it's a real, still-unwired (provider, surface) pair.

Tests: `src/dispatch/providers/__tests__/grok.test.ts` (7 tests),
`src/dispatch/providers/__tests__/nanobanana.test.ts` (11 tests),
`src/dispatch/providers/__tests__/openrouter.test.ts` (15 tests), plus 3 new
`engine.test.ts` routing tests and 2 repointed stub-fallback tests. Mocks a
real `fetch`/`Response` throughout (matching the existing dispatch-engine
tests' convention), not the provider functions themselves — every
URL-building/header-selection/body-shaping/response-decoding branch is
exercised end-to-end, including: the Google-official-vs-custom-gateway
header branch (and its malformed-`baseUrl` fallback), every aspect-mapping
case for all three vendors, the `gemini`-slug modality heuristic, the
`openrouter/`-prefix-strip both-ways branch, and all three of OpenRouter's
image-decoding paths (data URI / http(s) download / bare base64) plus its
download-failure path. No new dependency.

**Coverage**: 100% statements / 100% branches / 100% functions / 100% lines,
package-wide (`pnpm --dir packages/media exec vitest run --coverage`) —
316 tests across 20 files, up from 280/17. `tsc --noEmit` and `pnpm guard`
both clean.

## Not ported / explicitly out of scope (pre-existing, from the original pass)

- **`media/config.ts` in full** (23,414 bytes) — grepped for its exported
  function names and env-var table rather than read line-by-line. It resolves
  an OD-specific config file path (`OD_MEDIA_CONFIG_DIR`/`OD_DATA_DIR`-rooted
  `media-config.json`, `~/.open-design`-style paths) and per-project model
  aliasing (`resolveModelAlias`, consumed by `generateMedia` — the dispatch
  engine's `MediaGenerationRequest.wireModel` is the replacement, set by the
  caller instead of resolved from a project config file) — this is host/project configuration-file-format logic, not
  provider reference data, so none of it ported as code. Only the *env var
  names* (with `OD_*` overrides stripped) survive, as `providers.ts`'s
  `PROVIDER_CREDENTIAL_ENV_VARS`.
- **`codex` provider + `codex-gpt-image-2` model** — dropped from
  `providers.ts`/`IMAGE_MODELS` (see the table row above): local Codex-CLI
  subscription auth, not a REST credential shape.
- **AMR/vela-specific integration wrapper** around
  `amr-image-staging.ts`'s actual staging logic — there wasn't one to find;
  see the `staging.ts` row above. The file's *name* implied vendor coupling
  that its *body* didn't have.

## Dependencies

`@jini/core` (workspace) for `token()` — see `src/tokens.ts`. `undici` (as of
the dispatch engine — `providers/openai.ts`'s long-timeout `Agent` for image
generation, mirroring `packages/deploy`'s use of the same package).
`node:crypto` (`randomUUID`) and `node:fs`/`node:path` (staging) — Node
built-ins. No `better-sqlite3`, no `@open-design/contracts`.

## Coverage

`pnpm --filter @jini/media exec vitest run --coverage` (json-summary + json
reporters per `docs/jini-port/skills/fixing-open-design.md` Phase 6.5):
**100% statements / 100% branches / 100% functions / 100% lines**, aggregate
and per file, across the whole package including the dispatch engine added
this pass (280 tests across 17 files; the dispatch-engine tests mock a real
`fetch`/`Response` rather than the provider functions themselves, so the
actual URL-building/body-shaping/response-parsing logic is exercised
end-to-end, not bypassed). Enforced by a real `thresholds: { statements:
100, branches: 100, functions: 100, lines: 100 }` gate in
`vitest.config.ts`, not just measured. `src/dispatch/types.ts` is excluded
from the coverage config for the same reason as the top-level `src/types.ts`
(a genuinely zero-executable-statement file — verified via `grep`, not a
coverage dodge).

Reaching 100% (up from an initial ~89% branches on the dispatch engine)
involved one genuine dead-code removal and one refactor, not contrived
tests written just to hit a line — matching this repo's own
coverage-driven-refactor convention, and specifically avoiding trading real
capability for a coverage number:
- **One dead branch removed**: a `findProvider(def.provider)` null-check in
  the stub-fallback path (every catalogued model's `provider` id is proven
  present in `MEDIA_PROVIDERS` by a new `providers.test.ts`
  catalogue-integrity test added this pass). `clampNumber`'s
  `allowed.length === 0` guard was removed the same way (unreachable — its
  only two call sites always pass `providers.ts`'s non-empty
  `VIDEO_LENGTHS_SEC`/`AUDIO_DURATIONS_SEC` constants, proven by an existing
  `providers.test.ts` test) — both are internal defensive guards with no
  user-visible capability attached, not a scope question.
- **One extraction, not a removal**: `promptInfluence` and `imageRefs`
  (plural) are real origin fields (`renderElevenLabsSfx`'s prompt-influence
  dial; multi-image i2v/style-reference flows) not consumed by any renderer
  ported in this pass. The first attempt at 100% dropped both from the
  type surface as "unobservable" — correctly flagged by the user as a real
  capability reduction disguised as a coverage fix, not acceptable just
  because nothing currently reads them. The actual fix: pull `ctx`
  construction out of `engine.ts` into its own pure, exported
  `context.ts`/`buildRenderContext` function, so both fields' derivation
  (including their edge cases — a non-finite `promptInfluence`, an explicit
  `imageRefs` array vs one derived from a single `imageRef`) can be tested
  directly against the function's return value instead of needing a live
  renderer to observe them through. Both fields are back in
  `MediaGenerationRequest`/`RenderContext`, genuinely tested
  (`context.test.ts`), with zero capability lost relative to the origin.
- Everything else was genuinely reachable and got a real test: Azure
  error-tagging paths, dall-e-2 vs dall-e-3 quality branches, every
  aspect-ratio size-mapping branch, unparseable-URL fallback paths in the
  URL builders, and the stub renderer's `?? '?'`/`|| '-'` note-formatting
  fallbacks.

### Original substrate coverage note (pre-dispatch-engine)

No `/* v8 ignore */` or equivalent suppression comment anywhere in this
package. One dead branch found during the coverage loop (`providers.ts`'s
`modelsForSurface` — see its row above) was refactored away rather than
tested around; every other uncovered line found during the loop (an fs
`readdir`/`stat` best-effort catch, a stray-non-file directory entry in the
staging dir, an unparseable `supportedSizes` entry) was genuinely reachable
and got a real test, several using `vi.spyOn` to force the underlying
`fs.promises` call to fail for real rather than being skipped.
