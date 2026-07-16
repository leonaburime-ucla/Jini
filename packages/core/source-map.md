# `@jini/core` — provenance

Unlike `@jini/protocol`/`@jini/platform`/`@jini/sidecar`, `@jini/core` is **not lifted from
OD** — OD's `ServerContext` (`apps/daemon/src/server-context.ts`) is exactly the
structural-dependency-bag anti-pattern the locked architecture rejects (round-1 finding,
reaffirmed in extraction-plan.md §1: "a structural intersection decays exactly like OD's
`ServerContext` did — 40 `any` fields"). There is nothing to port; this package is a
from-scratch implementation of the typed composition contract specified in
`docs/jini-port/extraction-plan.md` §2.2 and §8 task 3.

| file | implements |
|---|---|
| `src/token.ts` | `token<T>(id)` / `manyToken<T>(id)` — nominal, versioned, cardinality-typed identity. `const Id extends string` type params (TS 5's `const` type parameter inference) so a token's id is a literal type, not just `string` — required for the compile-time check below. |
| `src/pack.ts` | `definePack({ deps, services, http?, cli? })` and the `PackContainer` a pack's `services` factory receives — scoped to that pack's own declared `deps`; resolving an undeclared token throws (no ambient resolver escape, per §2.2 "Kernel exports only kernel-service tokens... No ambient resolver escapes setup"). |
| `src/bindings.ts` | `bindings().bind(token, impl).bindMany(manyToken, impl)` — a typed builder that accumulates the literal union of bound token ids in its own type parameter (`Bindings<BoundIds>`), and rejects a duplicate singleton binding or a version-incompatible resolution at the point it happens, with the exact token id and (for version) both version numbers in the message. |
| `src/daemon.ts` | `createDaemon({ packs, bindings, transports? })` — the compile-time gate (`Exclude<RequiredTokenIds<Packs>, BoundIds>` must be `never`, enforced via a config property that only becomes satisfiable when the exclusion is empty) plus the runtime resolution pass that calls each pack's `services()` against a container scoped to its own deps. |
| `src/index.test.ts` | Runtime proof: successful compose + resolve, `bindMany` ordering, and the three "legible error" cases from the gate (missing / duplicate-singleton / version-incompatible), each asserting the exact message. |
| `src/compose.typecheck.ts` | Compile-time proof: an under-bound `createDaemon` call is expected to fail typecheck (`@ts-expect-error`); if the gate regresses, the unused directive itself fails `pnpm typecheck`. |

Not yet implemented (later tasks per extraction-plan §8): kernel service tokens themselves
(`RunLifecycle`, `EventLog`/`EventSink`, `AgentExecutor`, `ToolRegistry`/`ToolExecutor`,
`ProviderRegistry`, `Principal`/`Authorizer` — task 5/6/7), `@jini/node-host`'s zero-interface
preset (task 9), and the startup diagnostics wording in §8 task 3 beyond what's here (today's
diagnostics are thrown `Error`s with legible messages; a structured startup report — e.g. all
violations collected before exit rather than fail-fast on the first — is a reasonable
follow-up once a real host has more than one or two packs to compose).
