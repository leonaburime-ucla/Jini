# integrations/open-design

The Open Design **adapter** — everything product-coupled lives here, never in `packages/@jini/*`. OD is the first consumer of the engine.

## OD-sync strategy (see extraction-plan §4 + §12)

This adapter keeps OD's **exact upstream daemon file tree**. Every file lifted into a `@jini/*` package is gutted here to a **1-line re-export** (`export { X } from '@jini/daemon'`), so `git format-patch` from upstream OD still hits the path — then a `sync-ownership manifest` + a CI **patch canary** ensure a delegated-path fix reaches the engine package (not a dead copy). The daemon is mounted **whole** behind `createDaemon` first (strangler-fig); route groups migrate to packs only after a churn audit.

## Contents (to be populated during extraction)

- `daemon/` — OD product daemon + OD route-packs (design-systems/brands/figma/deploy/media).
- `contracts/` — the OD half of the contracts split (`@od/contracts`), depends on `@jini/protocol`.
- `identity/` — product name/appId/`OD_*` env/`--od-stamp-*`, injected into `@jini/release`/`@jini/sidecar`.
- `web/` — OD's feature-sliced Vite app.
- `reference/od-web-src.orig/` — the real OD web tree (the source for frontend extraction; the original `apps/web/src` symlink into Tovu was broken).
