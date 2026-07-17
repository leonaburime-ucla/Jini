<!-- Fill EVERY section. Delete these comments as you go. This mirrors the repo
     PR template (.github/pull_request_template.md) with the sections a
     capability-barrel refactor always needs. Replace <module> throughout. -->

Refactors `apps/daemon/src/<module>/` into the machine-enforced capability-barrel architecture, following the proven `design-systems` reference (see #5088 / #5087).

## Why

<!-- Cover BOTH: -->
1. **Author's use case:** <why you picked this module now — e.g. it's the next god-file on the maintainability roadmap; you want a proven, low-risk reference before touching bigger files>.
2. **The pain:** maintainability / tech debt — a flat directory (or an N-line monolith) with **no enforced boundaries**, so any file can import any other, dependency cycles form silently, and public-vs-internal API is indistinguishable. The `check-barrel-imports` guard makes the boundaries un-rot-able: violations fail CI.

## What users will see

**Nothing.** Internal refactor with zero user-facing change. The module's public API (root `index.ts` exports) is unchanged, so all `<module>` flows behave exactly as before — no UI, CLI, HTTP endpoint, or output change.

<!-- If a reviewer flags QA: name the regression surface to exercise, e.g. -->
Regression surface to exercise (behavior should be identical): <list the module's user-visible flows>.

## What this does

Reorganizes `apps/daemon/src/<module>/` into concern-based subdirectories (`core/`, `<...>`), each with an `index.ts` barrel, and registers the import guard.

- **No logic changes** — strangler-fig structural moves only; public API unchanged, external importers unaffected.
- **`core/` is the foundation kernel**; non-core subdirs depend on each other only along declared, acyclic edges through sibling barrels; external **runtime** code (under `apps/daemon/src`) imports only the root barrel.
- **Enforcement:** registered in `CAPABILITY_BARREL_DOMAINS` (`scripts/check-barrel-imports.ts`, run by `pnpm guard`), validated via the TypeScript AST, failing CI on violation. Scope is runtime code by design; tests may white-box internals but public-surface tests import through the barrel — see `<module>/README.md`.
- <If you broke a cycle:> One real dependency cycle (`<a> ↔ <b>`) was broken by relocating <symbol> into `core/<file>.ts`.
- **Docs:** every file carries a `@module` docblock, every exported symbol has JSDoc, and `<module>/README.md` documents the shape.

## Scope / boundary

Intra-`apps/daemon` only. `apps/web` and shared packages are untouched.

## Surface area

<!-- Repo template checklist. A pure internal refactor is None. -->
- [ ] UI · [ ] Keyboard shortcut · [ ] CLI / env var · [ ] API / contract · [ ] Extension point · [ ] i18n keys · [ ] New top-level dependency · [ ] Default behavior change
- [x] **None** — internal refactor. The new registry entry + guard machinery is internal dev tooling, not a user surface.

## Validation

<!-- Real numbers from Phase 6. -->
- `scripts/check-barrel-imports.test.ts`: <N/N> pass
- `pnpm guard`: <N/N> pass
- `pnpm --filter @open-design/daemon typecheck`: clean (src + tests)
- `<module>` test suite: <N/N> pass across <M> files
- Public-surface diff: root barrel exports identical to pre-refactor

See `apps/daemon/src/<module>/README.md` for the architecture writeup and staged migration plan.

Refs #5087
