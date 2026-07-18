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

## Not ported / explicitly out of scope

- **`media/index.ts`'s `generateMedia` (the actual multi-provider REST
  dispatch/execution engine, 155,475 bytes)** — grepped for its exported
  surface (`generateMedia` is the sole top-level export; the rest is private
  per-provider HTTP-call implementation) rather than read line-by-line, and
  deliberately not ported. This is the task brief's own framing: the brief
  asks for the type system, registry, task-store port, policy port, and
  catalogue — not a from-scratch re-implementation of 25 vendors' live REST
  integrations (auth headers, polling loops, response parsing per vendor).
  Re-implementing that safely would be its own multi-week extraction task,
  not something to rush through inside this dispatch's scope, and doing so
  hastily risks silently getting a real vendor's wire contract wrong. Flagged
  as a real, explicit gap for a future task, not silently dropped.
- **`media/config.ts` in full** (23,414 bytes) — grepped for its exported
  function names and env-var table rather than read line-by-line. It resolves
  an OD-specific config file path (`OD_MEDIA_CONFIG_DIR`/`OD_DATA_DIR`-rooted
  `media-config.json`, `~/.open-design`-style paths) and per-project model
  aliasing — this is host/project configuration-file-format logic, not
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

`@jini/core` (workspace) for `token()` — see `src/tokens.ts`. `node:crypto`
(`randomUUID`) and `node:fs`/`node:path` (staging) — Node built-ins, no new
external dependency. No `better-sqlite3`, no `@open-design/contracts`.

## Coverage

`pnpm --filter @jini/media exec vitest run --coverage` (json-summary + json
reporters per `docs/jini-port/skills/fixing-open-design.md` Phase 6.5):
**100% statements / 100% branches / 100% functions / 100% lines**, aggregate
and per file (9 covered source files; `src/types.ts` is excluded from the
coverage config as a genuinely zero-executable-statement file — verified via
`grep -nE '^(export )?(const|function|class|let|var) '` finding no runtime
declarations — same documented carve-out precedent `packages/ui/vitest.config.ts`
already established, not a coverage dodge). No `/* v8 ignore */` or equivalent
suppression comment anywhere in this package. One dead branch found during
the coverage loop (`providers.ts`'s `modelsForSurface` — see its row above)
was refactored away rather than tested around; every other uncovered line
found during the loop (an fs `readdir`/`stat` best-effort catch, a
stray-non-file directory entry in the staging dir, an unparseable
`supportedSizes` entry) was genuinely reachable and got a real test, several
using `vi.spyOn` to force the underlying `fs.promises` call to fail for real
rather than being skipped.
