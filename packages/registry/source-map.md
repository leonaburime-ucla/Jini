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

## 2026-07-21 hardening pass

Targeted audit of every file in `src/` (not just this doc), matching the
rigor of `ADS-memory/reports/code-review/CR-remaining-backend-audit-2026-07-21.md`
and `ADS-memory/reports/security/SEC-remaining-backend-audit-2026-07-21.md`
(both already covered this package as CR-008/CR-009/SEC-RB-005 — those were
independently re-verified against the current tree, not re-derived from
scratch). CR-008/CR-009/SEC-RB-005's headline items (version-identity
mismatch, `list()` ignoring its filter, database `publish()` ignoring
`dryRun`, `yank()` reporting false success, the hardcoded `'official'`
trust default) were **already fixed** in an earlier commit on this branch
(`97ad2d80f`, before this session started — see its own commit message for
detail) and were still passing on re-verification; this pass looked for
what was genuinely still open, not a re-litigation of already-closed items.

**Findings, fixed:**

- **Medium — manifest envelope not guarded against a non-array `entries`,
  crashing `list`/`search`/`resolve`/`doctor` with a bare `TypeError`
  instead of a clear diagnostic.** `validEntries()` called
  `manifest.entries.flatMap(...)` and `doctor()` did `for (const raw of
  entries)` (`packages/registry/src/static-backend.ts`, pre-fix) assuming
  `RegistryManifestSchema`-shaped input, but nothing on the read path
  actually runs that schema against the manifest *envelope* — only against
  each entry inside it. `GithubRegistryBackend.create()`
  (`packages/registry/src/github-backend.ts:127-132`) passes whatever its
  injected `client.readManifest()` returns straight through with no
  validation; a malformed remote JSON file (missing `entries`, or `entries`
  not an array) would throw a bare `TypeError` out of a caller-facing method
  instead of the clear, attributable errors this package uses everywhere
  else for corrupt input (`database-backend.ts`'s `parseStoredEntry`,
  `github-backend.ts`'s `assertSafeEntryName`/`assertSafeVersion`). Fixed by
  adding `manifestEntriesRaw()`/updating `validEntries()`
  (`packages/registry/src/static-backend.ts:240-261`) to treat a non-array
  `entries` as no entries (matching the existing "drop malformed content
  silently" philosophy for read paths), and by having `doctor()`
  (`packages/registry/src/static-backend.ts:162-170`) report one explicit
  `malformed-manifest` issue instead of crashing — consistent with its own
  documented purpose ("surface malformed data," not hide it by returning an
  empty, `ok: true` report). Tests:
  `packages/registry/src/__tests__/static-backend.test.ts`'s "malformed
  manifest envelope on the read paths" and "flags a malformed manifest
  envelope" / "flags a manifest with entries entirely missing" `doctor`
  cases; `packages/registry/src/__tests__/github-backend.test.ts`'s
  "malformed remote manifest (SEC-RB-005)" case exercises the actual
  external-boundary scenario (a client returning `entries: 'not-an-array'`)
  this was originally about.

- **High — `publish()` validated only `name`/`version`'s path-safety, not
  the rest of the request, against the wire schema — `DatabaseRegistryBackend`
  could have a single malformed `publish()` call permanently break every
  future read for that backend.** `database-backend.ts`'s `publish()`
  (pre-fix) wrote `request.entry` straight to the `registry_entries` table
  with no schema check. But every read path
  (`manifestFromDb()`/`parseStoredEntry()`,
  `packages/registry/src/database-backend.ts:152-164`) **throws** — not
  silently drops — on a row that fails `RegistryEntrySchema`, on the
  documented theory that data this backend itself wrote should already be
  schema-shaped. A caller passing a malformed `entry` (wrong field type, or
  a `name` not matching the required `vendor/name` shape) to `publish()`
  would write exactly such a row, then permanently break `list`/`search`/
  `resolve`/`doctor` for that backend id until someone manually repaired
  the row — a denial-of-service reachable through the ordinary public API
  by an innocently-malformed caller, not just an attacker.
  `github-backend.ts`'s `publish()` had the analogous but lower-severity gap:
  it validated `name`/`version` shape for path/branch safety
  (`assertSafeEntryName`/`assertSafeVersion`) but not the rest of the entry
  before writing it into a real PR against a shared external manifest.
  Fixed by adding `assertValidPublishRequest()`
  (`packages/registry/src/static-backend.ts:263-294`, exported so both
  backends share one validator) which parses the whole request against
  `RegistryPublishRequestSchema` and throws a clear error on failure; wired
  into `database-backend.ts:52` (before any DB write) and
  `github-backend.ts:143` (after the existing path-safety asserts, so their
  more specific error messages still fire first for the traversal/branch-
  injection cases those asserts exist for). Tests:
  `packages/registry/src/__tests__/database-backend.test.ts`'s "publish
  rejects a malformed entry instead of writing a row that would poison
  future reads" and "...a wrongly-typed field..." cases (both assert
  nothing was written and the backend stays usable);
  `packages/registry/src/__tests__/github-backend.test.ts`'s "publish
  rejects an entry that passes name/version path-safety but fails the wire
  schema otherwise"; `packages/registry/src/__tests__/static-backend.test.ts`'s
  `assertValidPublishRequest` describe block (unit-level, both the
  pass-through and rejection cases).

- **Medium — `DatabaseRegistryBackend.yank()`'s read-modify-write was two
  separate auto-committing statements, not one atomic operation, leaving a
  lost-update window against a concurrent writer sharing the same database
  file.** `yank()` (pre-fix,
  `packages/registry/src/database-backend.ts:60-85`) ran a bare `SELECT`,
  computed `nextVersions` from the result, then ran a separate `UPSERT` —
  with nothing binding those two statements together at the SQLite level. A
  second connection/process writing to the same row between them (a
  realistic shape for this backend, since the whole point of a
  `better-sqlite3`-backed registry is a shared file multiple daemon
  instances could point at) would have its change silently overwritten when
  the stale-data-derived `UPSERT` finally ran. Fixed by wrapping the whole
  read-modify-write in `this.db.transaction(...).immediate()`
  (`packages/registry/src/database-backend.ts:78-104`) — `.immediate()`
  acquires the write lock at the *start* of the transaction, before the
  `SELECT` even runs, so a concurrent writer is rejected for the whole
  operation instead of being able to interleave. Test:
  `packages/registry/src/__tests__/database-backend.test.ts`'s "yank
  concurrency (read-modify-write atomicity)" describe block — uses two real
  file-backed `better-sqlite3` connections (not `:memory:`, which each
  connection would see independently) and intercepts the exact moment
  `yank`'s `SELECT` runs to attempt a genuinely concurrent write from the
  second connection at that point; asserts the concurrent write is rejected
  (`SQLITE_BUSY`) and the yank itself still succeeds — proving the whole
  operation now holds the lock, not just proving the code runs. Both
  connections are constructed with a short explicit `timeout` (50ms,
  `packages/registry/src/__tests__/database-backend.test.ts:230-235`)
  because `better-sqlite3`'s default busy-wait budget is 5000ms, which would
  otherwise make this one test take 5+ seconds for no benefit.

**Findings, deferred to a proposal doc (needs architect/human sign-off):**

- **High (the still-open half of SEC-RB-005) — registry `trust` is entirely
  config-asserted; `RegistryEntrySchema.signatures[]` is defined in
  `@jini/protocol` but never read or verified by any backend.** A host can
  still explicitly construct a backend with `trust: 'official'` (this
  session's earlier-branch fix only removed the *automatic* default, not
  the option itself) with nothing cryptographically backing that claim.
  Closing this for real requires deciding which signature kind(s) to verify
  first, where a trust-root/allowlist lives, and whether verified trust
  replaces/narrows/sits-alongside the existing backend-level `trust`
  field — the last of which is a `@jini/protocol` schema decision outside
  this package's boundary. Write-up:
  `ADS-memory/reports/proposals/PROP-registry-signature-trust-verification-2026-07-21.md`.
  Not implemented.

**Observed, not fixed (reasoned as acceptable, not requiring a proposal):**

- `GithubRegistryBackend.yank()` does not check whether the requested
  `name`/`version` actually exists in its locally-held manifest snapshot
  before opening a PR (`packages/registry/src/github-backend.ts:175-208`),
  unlike `DatabaseRegistryBackend.yank()`'s existence check
  (`database-backend.ts:90-93`, the original CR-009 fix). This is an
  intentional asymmetry, not an oversight: the GitHub backend's manifest
  snapshot is read once at `create()` time and can be stale relative to the
  real upstream file (which may have gained the target version via an
  already-merged PR since), so a local "not found" check could produce a
  false rejection. The GitHub flow's actual safety net is the PR review
  itself — a human reviewing a yank PR for a genuinely nonexistent
  entry/version would see a nonsensical diff (a "yank" that creates a new
  file rather than modifying an existing one) and reject it. Revisit if
  this backend ever gains a live-synced manifest.
- `list()`/`search()`'s `RegistryListFilter` has no result-count bound at
  the protocol layer (`search()` is capped at `query.limit ?? 100`, itself
  ceilinged at 500 by `RegistrySearchQuerySchema`, but `list()` has no
  equivalent). Not fixed: adding one would mean changing
  `@jini/protocol`'s `RegistryListFilterSchema`, which is outside this
  package's boundary and this task's scope. Low severity in practice — a
  content/plugin registry's entry count is operator-controlled, not
  attacker-controlled unbounded content, unlike (for comparison) an
  arbitrary-user-upload surface. Worth a proposal if this package is ever
  promoted and a registry with a genuinely large entry count becomes real.
- `GithubRegistryClient`/its actual HTTP implementation (timeout, retry,
  rate-limit handling for the real GitHub API calls) does not exist in this
  package — `readManifest`/`createPublishPullRequest` are an injected
  interface with no concrete implementation anywhere in this repo yet
  (confirmed via repo-wide grep). There is nothing to harden here until a
  real implementation is built; noted so a future implementer doesn't
  assume this package already covers that concern.

**Verification:** `pnpm --dir packages/registry exec vitest run --coverage`
— 103/103 tests pass, 100% statements/branches/functions/lines on
`database-backend.ts`, `github-backend.ts`, `index.ts`, `static-backend.ts`
(the four files touched this pass); `versioning.ts` (untouched this pass)
stays at its pre-existing 99.3% branch coverage, one pre-existing gap this
pass did not introduce or touch. Package-wide aggregate 100/99.68/100/100,
above the package's configured 99% threshold gate
(`packages/registry/vitest.config.ts`). `pnpm --dir packages/registry exec
tsc --noEmit` clean. `pnpm guard` (repo root) clean. `pnpm --dir
packages/protocol exec vitest run` (unmodified, but exercised more heavily
via `RegistryPublishRequestSchema`) still 10/10 passing.
