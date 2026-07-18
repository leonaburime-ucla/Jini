# `@jini/capability-providers` — provenance

**No OD source.** This is not a port — it is a greenfield capability-provider
port/interface design, built per an explicit project-owner scope constraint
(see the dispatch brief): abstract ports only, plus one trivial in-memory
reference stub per interface, zero wiring into any other package.

## Why this exists (the gap it names)

`docs/jini-port/recon/r5b-consumers-matrix.md` §2 (the capability matrix) and
§3.3 identify a **capability-provider registry with auth / storage /
payments / db / realtime as Zana + Tovu-Runner convergent** — both consumers
independently built an explicit port+provider layer (Zana: `app-chassis`'s
"rigid core, flexible edges" thesis, `packages/{core,ai,db,auth,storage,
payments}` + `providers/supabase` declaring which capabilities it
implements; Tovu-Runner: "ports+sqlite/memory"), while Open Design itself
only models these capabilities thinly. §3.3 states this "should be an engine
primitive... so products swap Supabase/SQLite/Stripe without touching core"
— that is the shape this package builds: 5 independent ports (not one
umbrella "CapabilityProvider" interface — see "Design decisions" below) each
with a typed DI token (`packages/core/src/token.ts`'s pattern) and a minimal
in-memory reference implementation proving the port is genuinely
implementable.

## Package map

| File | Contents |
|---|---|
| `src/auth.ts` | `AuthProvider` (signUp/signIn/signOut/verifySession) + `createInMemoryAuthProvider`. Plaintext password storage, non-cryptographic session tokens — a port-shape reference stub, explicitly not a security reference (documented in the file's header comment). |
| `src/storage.ts` | `StorageProvider` (put/get/delete/list, key-prefix listing) + `createInMemoryStorageProvider`. Copies bytes in/out so callers can't mutate internal state through a returned/passed `Uint8Array`. |
| `src/payments.ts` | `PaymentsProvider` (charge/getCharge/refund) + `createInMemoryPaymentsProvider`. Every charge deterministically succeeds — no real money moves, no async settlement delay modeled. |
| `src/db.ts` | `DbProvider` (insert/get/update/delete/query, collection + record id, exact-match `where` filter only — deliberately not a query language) + `createInMemoryDbProvider`. |
| `src/realtime.ts` | `RealtimeProvider` (publish/subscribe, in-process synchronous fan-out) + `createInMemoryRealtimeProvider`. |
| `src/tokens.ts` | `AuthProviderToken`/`StorageProviderToken`/`PaymentsProviderToken`/`DbProviderToken`/`RealtimeProviderToken` via `@jini/core`'s `token()`, namespaced `jini.capabilityProviders.*`, following the same bare-interface-name-suffixed-`Token` convention `@jini/daemon`/`@jini/media` already established. |
| `src/index.ts` | Barrel re-exporting all of the above. |

## Design decisions

**Five separate port interfaces, not one `CapabilityProvider` union.** Zana's
own model has a single adapter (Supabase) implementing multiple capabilities
at once, which might suggest one umbrella interface with optional methods.
Rejected: extraction-plan.md §2.2's core lesson (the reason typed tokens beat
a structural dependency object in the first place) is that a union/bag
interface is exactly the shape that decays into an OD-`ServerContext`-style
god-object as capabilities accrete. Five independently bindable tokens means
a consumer wiring only `DbProviderToken` + `StorageProviderToken` never sees
`AuthProvider`/`PaymentsProvider`/`RealtimeProvider` in its type surface. A
real adapter that happens to implement several (a future `SupabaseAdapter`)
is free to be one class satisfying multiple interfaces and bound to multiple
tokens — that composition happens at the binding site, not in this package.

**No registry/discovery module.** The task brief's scope constraint says
"abstract port/interface definitions... plus at minimum one trivial
reference/stub implementation" and explicitly forbids wiring this into any
other package. `@jini/core`'s existing typed-token + `bindings()` mechanism
already *is* the registration/discovery layer (extraction-plan.md §2.2) —
building a second, parallel registry inside this package would duplicate
that machinery for no reason and blur the "zero other package depends on
this" boundary the brief asked for. A consumer registers these tokens in its
own `createDaemon({ bindings: bindings().bind(AuthProviderToken, ...) })`
call; this package supplies only the tokens and the interfaces they carry.

**In-memory reference stubs, not "the obvious real adapter."** The brief is
explicit: interfaces + minimal stubs only, no full per-provider-type
implementations (no real Stripe/Auth0/Supabase integration). Every stub here
optimizes for proving the port's shape is satisfiable and unit-testable, not
for production use — see each file's header comment for the specific corners
cut (plaintext passwords, deterministic always-succeeding charges, no
cross-process realtime fan-out, no query language beyond exact-match
`where`).

## Scope / sign-off status (required note per the dispatch brief)

**Built speculatively as port-design exploration, no current consumer, not
wired into any other package — per an explicit human decision.** Not in
`extraction-plan.md`'s locked §3 package set, needs sign-off like
`@jini/deploy`/`@jini/diagnostics`/`@jini/metatool` before being folded in,
and unlike those, may never gain a real consumer — that's an accepted,
deliberate risk for this module specifically.

Caveat found while researching this dispatch: the brief's own framing cites
`@jini/desktop-host`, `@jini/diagnostics`, and `@jini/metatool` as
already-built same-day precedent packages to model this note on. None of the
three exist anywhere in this repository's git history as of this dispatch
(`git log --all -- packages/desktop-host packages/diagnostics
packages/metatool` returns nothing on any branch reachable from this
session, and `packages/` on `main` has no such directories). `@jini/deploy`
*is* real — it exists on a separate, unmerged branch this session found and
pushed as `preserved/detached-ui-work` (see the top-level task report) — so
this note follows `@jini/deploy`'s actual `source-map.md` precedent directly
rather than the two/three packages that could not be located. This
discrepancy is flagged here rather than silently worked around, per this
package's own "verify, don't assume" precedent for citing sources.

## Confirmed: zero other package imports this one

```
$ grep -rl "@jini/capability-providers" packages/*/src packages/*/package.json 2>/dev/null | grep -v "^packages/capability-providers/"
(no output)
```

## Dependencies

`@jini/core` (workspace) for `token()` — see `src/tokens.ts`. No other
dependencies; no Node builtins beyond what TypeScript itself needs.

## Coverage

`pnpm --filter @jini/capability-providers exec vitest run --coverage`
(json-summary + json reporters per
`docs/jini-port/skills/fixing-open-design.md` Phase 6.5): **100%
statements/branches/functions/lines**, aggregate and per file (7 covered
source files). No `/* v8 ignore */` or equivalent suppression comment
anywhere in this package. One dead branch found during the coverage loop
(`auth.ts`'s `verifySession` — a `find()` result that can never be
`undefined` given this port surface has no `deleteUser`) was resolved with a
documented non-null assertion (Phase 6.5's "TS-required fallback with no
real runtime path" classification), not a contrived test or a suppression
comment.
