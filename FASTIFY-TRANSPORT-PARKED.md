# Fastify transport — parked for the future

This branch is the last point where `@jini/http`/`@jini/node-host` supported a
switchable `transport: 'express' | 'fastify'` HTTP transport. It was removed
from `main` on 2026-07-22 and preserved here, unchanged, in case a future
consumer actually needs it.

## Why it was removed from `main`

The Fastify transport was fully built and independently tested to 100%
coverage (`packages/http/src/fastify/`), but had **zero real consumers** —
nothing in this repo, `examples/minimal-host`, or any known downstream
consumer ever set `transport: 'fastify'` in production. Keeping it in `main`
had a real, ongoing cost with no offsetting benefit yet: every new HTTP route
pack added to `@jini/http` implicitly raised the question "does this also
need a Fastify mounting sibling, or do we explicitly defer it?" — extra
surface area and a recurring parity-tracking tax for an option nobody used
(see `AUD-004` in
`ADS-memory/reports/audit-fastify-merge-and-six-gap-fixes-2026-07-22.md` for
one concrete instance: 6 route packs shipped Express-only with Fastify parity
explicitly deferred, precisely because of this tax).

## What's here

- `packages/http/src/fastify/` — the full Fastify-native route-registration
  guard, security middleware, daemon-status routes, and mounting siblings for
  `runs`/`agents`/`host-tools` (dual-mounting the same `JsonRouteSpec` objects
  the Express side uses — see that package's `source-map.md`'s "Fastify
  transport split" and "Real dual-transport parity" sections for the full
  design).
- `packages/http/src/express-index.ts` — the thin `express` namespace barrel
  built to mirror `fastify/index.ts`'s shape symmetrically.
- `packages/node-host/src/create-local-node-daemon.ts`'s `transport?:
  'express' | 'fastify'` config option and its `if (config.transport ===
  'fastify') { ... } else { ... }` branch.
- `packages/node-host/src/__tests__/create-local-node-daemon.fastify-transport.test.ts`
  and `packages/node-host/scripts/dual-boot-smoke.ts`.

## Reviving this

Rebase this branch onto current `main`, reapply the `transport` config option
and branching in `create-local-node-daemon.ts` (the removal commit on `main`
shows exactly what to reverse), then extend Fastify mounting to whatever
route packs `main` has gained since — `memory`/`terminals`/`model-proxy`/
`active-context`/`db-ops`/`media` had no Fastify sibling yet even at the
point this was parked (that was the `AUD-004` gap the parity-tax argument
above is about). `memory.ts`/`terminals.ts` already sit on the shared,
transport-agnostic `createSseChannel` primitive, so porting those two is
mostly reuse; `model-proxy.ts` still manages Express's `Response` directly
for vendor SSE pass-through and needs the same retype-to-raw-`ServerResponse`
treatment `runs.ts` already got.
