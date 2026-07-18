# `@jini/registry` — provenance

**New package, not yet in the locked §3 package set in
`docs/jini-port/extraction-plan.md`.** Per that doc's precedent for
`@jini/deploy` ("a genuinely new package this list didn't originally
enumerate — listed here for visibility, not folded into the locked set
until reviewed"), the same applies here: this package needs Coordinator/
Software-Architect sign-off before being folded into the locked list. It was
built per the task-6 audit's PART A brief off `docs/jini-port/recon/
r1-daemon.md`'s TASK 1 MIXED classification for `registry/`: "Pluggable
content-registry backends (`static`/`github`/`database`/`versioning`) —
generic pattern, but typed against `@open-design/registry-protocol` +
`MarketplaceManifest` (OD marketplace). Split protocol from OD manifest."

## Why a new package instead of folding into `@jini/core` or `@jini/sqlite`

The task brief suggested `@jini/core` as a likely home. Read `@jini/core`'s
own `source-map.md` first: its charter is explicitly composition-only — "a
from-scratch implementation of the typed composition contract... there is
nothing to port" — it holds zero concrete port/adapter implementations
today (`token.ts`/`pack.ts`/`bindings.ts`/`daemon.ts` are all pure DI
machinery). Adding stateful backend classes (in-memory, GitHub-PR-mutating,
sqlite-backed) would be a first-of-its-kind widening of that charter, which
reads as exactly the kind of ad-hoc scope creep extraction-plan.md §9 warns
against ("a new kernel token requires a kernel invariant, not merely a need
discovered by the first consumer").

`@jini/sqlite` was the other candidate (it already holds one concrete
`better-sqlite3`-backed adapter, `event-log.ts`, implementing `@jini/daemon`'s
`EventLog` port). But `@jini/sqlite`'s own source-map.md scopes it
specifically to durable adapters for daemon/core kernel ports; a registry
backend is not a kernel port and two of the three backends here
(`static`/`github`) have no sqlite dependency at all.

Instead this follows the same shape as `@jini/sqlite` itself: `@jini/protocol`
defines the pure wire types and the `RegistryBackend` port (already true
before this change — see "What already existed" below); this new leaf
package holds concrete backend implementations against that port, exactly
as `@jini/sqlite` holds concrete `EventLog` implementations against
`@jini/daemon`'s port.

## What already existed (this task reused it, did not duplicate it)

`packages/protocol/src/registry.ts` — `RegistryEntry`, `RegistryBackend`,
`RegistrySearchQuery`/`Result`, `RegistryPublishRequest`/`Outcome`,
`RegistryYankOutcome`, `RegistryDoctorReport` — was ported in an earlier
session (branch `port/http-sqlite-platform-protocol-plus`, commit
`1572052f8`, "feat(protocol): add registry-protocol wire schemas"), already
merged to `main`. This task's PART A did **not** re-port those; it added one
new schema to that same file (`RegistryManifestSchema` — see below) and
built the concrete backends on top.

## Origin

`leonaburime-ucla/open-design`'s `refactor/web-memory-slice` branch (cloned
fresh to `/tmp/od-source`), `apps/daemon/src/registry/` (4 files: `static-
backend.ts`, `github-backend.ts`, `database-backend.ts`, `versioning.ts`).

## File map

| Jini file | Origin file | Transform |
|---|---|---|
| `src/versioning.ts` | `registry/versioning.ts` | `parsePluginSpecifier`→`parseRegistrySpecifier` (generic rename); `resolveMarketplaceEntryVersion`→`resolveRegistryEntryVersion`, retyped from `MarketplacePluginEntry` to `@jini/protocol`'s `RegistryEntry` — the field shapes are already identical (both carry `version`/`source`/`ref`/`versions`/`distTags`/`integrity`/`manifestDigest`/`deprecated`), so this is a type-only swap; the npm-style caret/tilde/prerelease semver resolution logic is byte-identical. |
| `src/static-backend.ts` | `registry/static-backend.ts` | `StaticRegistryBackendOptions.manifest` retyped from OD's `MarketplaceManifest` to `@jini/protocol`'s new `RegistryManifest` (`entries` instead of `plugins`). Because `RegistryManifest.entries` is already `RegistryEntry[]` (not a separate `MarketplacePluginEntry` needing conversion), the origin's `toRegistryEntry`/`normalizePublisher` conversion step is gone — replaced with a `RegistryEntrySchema.safeParse` defensive filter (`validEntries()`) that keeps the same "drop malformed entries silently" behavior without a type-conversion step that no longer applies. `list`/`search`/`resolve`/`doctor` logic otherwise unchanged. |
| `src/github-backend.ts` | `registry/github-backend.ts` | `GithubRegistryClient.readMarketplace`→`readManifest` (returns `RegistryManifest`); `marketplacePath`→`manifestPath`, default path `plugins/registry/official/open-design-marketplace.json`→`registry/index.json` (de-branded, generic default); publish/yank's file-tree root `plugins/${vendor}/${name}`→`entries/${vendor}/${name}` (de-branded — "plugins" is OD's marketplace vocabulary, "entries" matches the generic `RegistryEntry` noun). Publish/yank PR-mutation logic otherwise unchanged. |
| `src/database-backend.ts` | `registry/database-backend.ts` | Retyped from `MarketplaceManifest`/`MarketplacePluginEntry` to `RegistryManifest`/`RegistryEntry`; `manifestFromDb`'s per-row `toRegistryEntry` validation step dropped for the same reason as `static-backend.ts` (rows already store `RegistryEntry` JSON, no marketplace-shaped conversion needed); table schema, dry-run/db:// changed-file paths ("plugins/"→"entries/", matching the github-backend rename), and publish/yank logic otherwise unchanged. |
| `src/index.ts` | *(new — barrel)* | Re-exports the four modules' public surface. |

## New protocol schema: `RegistryManifestSchema`

Added to `packages/protocol/src/registry.ts` (not a new file) alongside the
already-ported `RegistryEntry`/`RegistryBackend` schemas: `{ specVersion,
name, version, entries: RegistryEntry[] }`. This is the direct generic
counterpart of OD's `MarketplaceManifest` (`{ specVersion, name, version,
plugins: MarketplacePluginEntry[] }`, `packages/contracts/src/plugins/
marketplace.ts`) — same envelope shape, `entries` instead of the
marketplace-specific `plugins`. Kept in `@jini/protocol` rather than this
package because it is a pure wire type with the same "no runtime/backend
logic" charter as every other schema in that file, and because both this
package and any future non-backend consumer (e.g. a CLI that just reads a
manifest file) need it without depending on `@jini/registry`'s concrete
backend code.

## De-branding

No `Open Design`/`OD_`/`--od-stamp` strings anywhere in this package (grep-
verified). Every "marketplace"/"plugin(s)" noun tied to OD's specific
product vocabulary was replaced with the generic "registry"/"entry"/
"entries" vocabulary already established by the protocol-layer port. `gh`-
style file-tree conventions (`entries/<vendor>/<name>/...`) are backend
implementation detail, not product identity.

## Dependencies

`@jini/protocol` (workspace) for the wire types/schemas; `better-sqlite3`
(matching `@jini/sqlite`'s existing dependency) for `database-backend.ts`
only — `static-backend.ts`/`github-backend.ts` have no database dependency.
