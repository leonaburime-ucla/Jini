# `@jini/platform` — provenance

Origin: `nexu-io/open-design` (fork `leonaburime-ucla/open-design`), branch `main`,
commit `951fa5f1541c3b7af23ccb07e3e60b294def56b1` (2026-07-12), local reference
clone `/Users/la/Desktop/Programming/OSS-Repos/open-design-agentic`.

Per extraction-plan.md §8 task 4: "`@jini/platform` + `@jini/sidecar` verbatim,
path-mirrored + patch-router." This package is the low-risk mechanical half of
that task — OS/process/file/http/proxy/toolchain primitives with no OD domain
nouns to strip, unlike `@jini/protocol` (task 2), which needed heavy content
stripping.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/command.ts` | `packages/platform/src/command.ts` | Verbatim. Cross-platform command-invocation construction (Windows `.bat`/`.cmd` shim quoting, package-manager re-entry). No OD nouns; only relative import paths preserved as-is (no sibling imports in this file). |
| `src/process.ts` | `packages/platform/src/process.ts` | Verbatim. Process stamp encode/decode, spawn/stop helpers, process-tree walk, POSIX/Windows snapshot enumeration. Imports `./command.js` unchanged (same relative path, now resolving inside `@jini/platform`). |
| `src/proxy-env.ts` | `packages/platform/src/proxy-env.ts` | Ported with 3 minimal type-strictness edits only (no behavior change) — see "Strictness-only edits" below. System proxy discovery (macOS `scutil`, Windows registry) and proxy-aware env merging; no OD nouns. |
| `src/fs.ts` | `packages/platform/src/fs.ts` | Verbatim. Path containment, atomic copy, best-effort removal, log-tail reads. No OD nouns. |
| `src/http.ts` | `packages/platform/src/http.ts` | Verbatim. HTTP readiness polling (`waitForHttpOk`). No OD nouns. |
| `src/toolchain.ts` | `packages/platform/src/toolchain.ts` | Ported with 1 identity-strip (comment only) + 1 type-strictness edit — see below. User-level toolchain bin discovery (npm/pnpm/bun/cargo/deno/go/pyenv prefixes, asdf/volta/mise/nvm/fnm shims, per-version Node roots). Business logic (which dirs to search) kept verbatim — it is generic to any GUI-launched Node daemon, not OD-specific. |
| `src/index.ts` | `packages/platform/src/index.ts` | Ported with 1 identity-strip (module doc comment) — see below. Root barrel; re-exports the same public surface under the same names. |

## Identity strips (per root `AGENTS.md` hard boundary: no `Open Design`/`OD_`/`--od-stamp`/`/tmp/open-design` in `packages/@jini/**`)

| File | Origin | Change | Reason |
|---|---|---|---|
| `src/index.ts` | `@module @open-design/platform` | → `@module @jini/platform` | Module doc comment named the OD package; renamed to the Jini package, no behavior change. |
| `src/toolchain.ts` | comment: `"...they resolve cleanly from the user's shell. See open-design issue #442."` | Dropped the `See open-design issue #442` sentence; kept the rest of the rationale comment. | Named the origin product and a product-specific issue tracker reference. The underlying rationale (why `~/.npm-global`/`~/.npm-packages` are searched) is generic and was kept. |

## Strictness-only edits (Jini's stricter `tsconfig.base.json`, no behavior change)

Jini's root `tsconfig.base.json` sets `noUncheckedIndexedAccess: true`, which OD's
own `tsconfig.json` does not set. This surfaces `string | undefined` on regex
match-group and fixed-length-tuple index access that OD's compiler didn't flag.
Fixed with non-null assertions at call sites where the surrounding logic already
guarantees the value is present (a successful regex match with a mandatory
capture group; a tuple index bounded by the tuple's own `.length`):

- `src/proxy-env.ts`: `parseMacosScutilProxyOutput`'s exception-list/scalar regex
  captures (`match[1]!`, `match[2]!`) and `parseRegistryValue`'s capture
  (`match[1]!`).
- `src/toolchain.ts`: `compareVersionLikeDirNames`'s tuple index comparison
  (`rightSemver[index]!`, `leftSemver[index]!`).

No other files needed strictness edits.

## Flat daemon primitives (2026-07-18, port continuation task — Part 2)

Four of the seven top-level files identified in `apps/daemon/src/` as
"generic daemon primitives, not yet ported" (`agents.ts`, `sandbox-mode.ts`,
`terminals.ts`, `daemon-paths.ts`, `origin-validation.ts`,
`api-token-auth.ts`, `redact.ts`) landed here: the ones that do real
filesystem/OS-process work, matching this package's existing
command/process/fs/toolchain scope. The three pure security/auth/telemetry
primitives (`redact.ts`, `api-token-auth.ts`, `origin-validation.ts`)
landed in `@jini/core` instead, and `agents.ts` was deliberately not
ported at all — see `@jini/core`'s own `source-map.md` for both.

| Jini file | Origin file | Home rationale + transform |
|---|---|---|
| `src/home-expansion.ts` | `apps/daemon/src/home-expansion.ts` | Verbatim port (already product-neutral — no `OD_`-prefixed names or product strings in the origin). A new file, not present in the pre-2026-07-18 `@jini/platform`; added because both `sandbox-mode.ts` and `daemon-paths.ts` depend on it and it's a pure path-expansion primitive, the same kind of thing `fs.ts` already hosts here. |
| `src/sandbox-env.ts` | `apps/daemon/src/sandbox-mode.ts` | Genericized: the origin hardcoded its host product's sandbox-mode/import-allowed-roots/data-dir/agent-home env-var names and a literal product-branded config sub-directory name. All are now fields on `SandboxEnvConfig`, threaded through every function — the same "config object carries the product's env-var names" pattern `agent-runtime-env.ts`'s `RuntimeEnvConfig.envPrefix` (per `r1b-daemon-design.md` §1c) already established for this codebase. Renamed `sandbox-mode.ts` → `sandbox-env.ts` since the file is about the sandboxed *environment* (directory tree + env-var overlay) more than a boolean "mode." Home: `@jini/platform`, not `@jini/core` — it does real `fs.mkdirSync`/`fs.realpathSync` work and builds a `NodeJS.ProcessEnv` overlay for a spawned process, the same OS-primitive shape as `process.ts`'s env/spawn helpers. |
| `src/resource-paths.ts` | `apps/daemon/src/daemon-paths.ts` | Genericized: the origin hardcoded its host CLI's env-var names, its own npm package specifier (`require.resolve('<package>/package.json')`), a `.` + product-name default data-dir name, and a product-name path segment in the Windows packaged-resources marker. All are now fields on `ResourcePathsConfig`. One API-shape change beyond de-branding: `resolveProcessResourcesPath` takes an injected `{ resourcesPath?, execPath }` parameter instead of reading the global `process` object directly, so the macOS/Windows marker-matching logic is unit-testable without mutating `process.execPath` in-process. Renamed `daemon-paths.ts` → `resource-paths.ts` to describe what the file actually resolves (CLI path, packaged-resources root, plugin-previews dir, data dir) now that "daemon" isn't an implicit product noun here. Home: `@jini/platform` — real `fs`/`path`/packaged-app-layout resolution, the same shape as `toolchain.ts`'s bin-discovery primitives. |
| `src/terminal.ts` | `apps/daemon/src/terminals.ts` | The one file in this batch with **zero** product-identity strings in the origin — but two real couplings were replaced with injectable ports rather than ported verbatim, per the task brief's own framing ("this file is especially relevant — this project's consumer research (Zana + Open-Marketing both independently need a terminal/PTY port) means this file may directly inform that future port; design its generic interface accordingly"): (1) the origin statically `import type * as NodePty from 'node-pty'` and dynamically `await import('node-pty')` — `@jini/platform` does not depend on `node-pty` (a native addon this sandboxed build environment can't install/compile), so the port instead defines a minimal `PtyProcess`/`PtySpawn` port interface and takes a `loadSpawnPty: () => Promise<PtySpawn>` factory from the caller; a real Node host wires a thin `node-pty` adapter, a test wires a fake. `spawnHelperCandidatePaths`'s `require.resolve('node-pty')` call is a *runtime* string lookup (not a static import), so it still typechecks and still resolves for real once a consumer has `node-pty` installed — it just isn't a hard dependency of this package. (2) the origin's `stream(session, req, res, createSseResponse)` took an Express `req`/`res` pair directly; the port replaces it with a transport-neutral `attach(id, lastEventId, sink: TerminalSseSink)` / `detach(id, sink)` pair (`TerminalSseSink` = `{ send, end }`, no Express/HTTP types), so a future terminal port for a non-Express host isn't stuck re-deriving this from OD's routes. Beyond those two seams, the ring-buffer/coalescing/exit-tail-trim/TTL-cleanup logic is behaviorally the same as the origin, retyped away from `any` (this package's public surface bans `no-explicit-any` per `extraction-plan.md` §7) — sessions are looked up by `id: string` rather than the caller holding and re-passing the mutable internal session object, and `write`/`resize`/`kill`/`attach`/`detach` all take `id` for that reason. One dead-branch removal surfaced during the coverage-driven pass (Phase 6.5): the `pty.onExit` handler's `exitCode ?? null` fallback is unreachable given `PtyProcess.onExit`'s own callback type declares `exitCode: number` (non-nullable, matching both the origin's own type annotation and node-pty's real exit-event shape) — removed, documented inline at the call site, same classification and precedent as the agent-protocol port's dead-branch removals. |

## Dependencies

No runtime dependencies in the origin package (devDependencies only: `@types/node`,
`esbuild`, `typescript`, `vitest` — all build/test tooling). `@types/node` was added
to the Jini repo root `package.json` devDependencies (not previously present) since
`@jini/protocol` is pure-TypeScript and never needed Node type declarations; this is
the first engine package that touches `node:*` builtins.

## Addendum: `asset-cache.ts` (2026-07-17)

Sourced from the OD fork's unmerged `arch/plugins-fold-decouple` branch (not
part of the original task-4 batch above), commit `c1ee358` on
`leonaburime-ucla/open-design`, file `apps/daemon/src/plugins/plugin-asset-cache.ts`
(the branch's own commit renamed it from the pre-refactor
`apps/daemon/src/plugin-asset-cache.ts`).

Verification context: this branch was one of several old capability-barrel
refactor branches audited to see whether they held reusable engine substrate
vs. genuinely OD-product logic. Two sibling files in the same branch
(`plugin-preview-bakes.ts` — bakes a plugin marketplace's hover-preview video
clips, `OD_PLUGIN_PREVIEWS_DIR`/R2 CDN specific — and the branch's `design/`
trio ported separately, if ever — see god-components-extraction-plan.md) were
judged genuinely OD-specific and NOT ported. `plugin-asset-cache.ts` was the
one exception: despite its "plugin preview" framing in comments, the
implementation itself has zero OD domain nouns — it is a generic, SSRF-hardened
same-origin disk cache/proxy for external media any sandboxed-content renderer
(iframe preview, embedded document, etc.) would need.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/asset-cache.ts` | `apps/daemon/src/plugins/plugin-asset-cache.ts` | Logic verbatim (SSRF guard chain: `assertSafePublicUrl` up-front rejection + `createValidatingLookup` DNS-rebinding/TOCTOU guard installed on the undici `Agent`, content-addressable disk cache with in-flight de-dup, capped streaming read). Renamed `createPluginAssetCache`/`PluginAssetCache`/`PluginAssetCacheOptions` → `createAssetCache`/`AssetCache`/`AssetCacheOptions` (the "plugin" framing wasn't load-bearing — this is generic media-proxy infra). `assetCacheRewriteUrl` gained a second `routePath` param (was hardcoded `/api/asset-cache`) since the mount path is a host-application concern, not this package's. Header comment reworded to drop "plugin preview HTML (example.html)" / "marketplace card" framing while keeping the CSP/latency/SSRF rationale. |
| `src/asset-cache.test.ts` | `apps/daemon/tests/plugin-asset-cache.test.ts` | Same coverage (cacheable-URL predicate, IPv4/IPv6 private-range classification incl. IPv4-mapped literals, up-front + connection-time SSRF rejection, disk persistence/replay, concurrent de-dup, oversized-asset rejection with and without Content-Length, non-cacheable/private-IP short-circuits before any fetch) renamed to match the `createAssetCache` API; added one test for the new `routePath` param. Test fixture CDN hostnames (`images.higgs.ai`) swapped for `images.example.com` — a real third-party company name, not OD's own, but still not a stable fixture to depend on. |

Dependency: `undici@^7.25.0` added to `package.json` (previously none) — needed
for the `Agent`/connection-time `lookup` SSRF guard. Same major version OD's
own daemon pins.

## Not ported (out of scope for this task)

Nothing was left out — every file in the origin `packages/platform/src/` ported
(verbatim or with the identity/strictness edits above). The origin `tests/`
directory (`tests/index.test.ts`, `tests/process-tree.test.ts`,
`tests/stamp-read.test.ts`, ~1216+41+78 lines) was not ported verbatim; `src/index.test.ts`
here is a fresh vitest suite exercising the same real exported surface (command
invocation, process stamp round-trip/match, process-tree collection, fs atomic
copy/removal/log-tail, http polling, proxy-env parse/merge, toolchain bin
discovery) rather than a line-for-line port of OD's larger fixture suite.

## Explicitly deferred (task 1 dependency)

The "patch-router" half of task 4's gate ("a real historical `packages/platform`
patch routes cleanly") depends on task 1 (harnesses + sync-ownership manifest),
which has not been done yet. Not attempted here — see the Programmer handoff
report for this task.
