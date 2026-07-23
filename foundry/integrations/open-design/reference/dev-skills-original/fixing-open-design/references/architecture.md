# Architecture — why the capability-barrel shape

Read this before doing any mechanical work. The steps in `SKILL.md` only produce a good result if you understand *why* the shape is what it is. The canonical, working embodiment of everything below is `apps/daemon/src/design-systems/` — read its `README.md` sections "Why this shape" and "Import conventions" alongside this file.

## The problem it solves

A flat directory of 13+ files (or a 3.6k-line `index.ts` god-file) has **no enforced boundaries**. Any file can import any other. Three things rot as a result:

1. **Silent dependency cycles.** Two files start importing each other's helpers; nothing stops it. The design-systems module had a real `catalog ↔ user` cycle before the refactor.
2. **Public vs. internal API becomes indistinguishable.** Once external code imports a deep helper, that helper is *de facto* public — and every future refactor has to preserve it. The module loses the freedom to change its own internals.
3. **Humans and AI agents can't navigate it.** A flat namespace gives no signal about what depends on what, or what's safe to change.

The capability-barrel pattern makes the boundaries **explicit and machine-enforced**, so they can't rot. Direction was validated by a 3-model design debate (Claude/Codex/Gemini) that converged on: flat tooling + capability barrels, *plus machine enforcement and docs-as-precedent* to make it a real, repeatable template rather than a one-off.

## The four load-bearing ideas

### 1. Concern-based subdirectories (not type-based)

Group files by **what they do for the domain**, not by language kind. design-systems: `catalog/` (read), `user/` (write/CRUD), `import/` (ingest pipeline), `tokens/` (extraction), `jobs/` (async job store), `core/` (foundation). There is no `utils/`, `helpers/`, or `types/` bucket — those are the anti-pattern, because "utility" isn't a concern and becomes a dumping ground that everything depends on.

The test of a good split: the `allowedEdges` list comes out **short**. If your subdirs need many cross-edges to function, they aren't real concerns — re-cluster.

### 2. The foundation kernel (`core/`)

`core/` holds the shared **types** and pure **primitives** (parsers, id/path utilities, metadata read helpers) that many concerns need.

- **Every subdir may import `core/` directly**, by any path.
- **`core/` imports no sibling.** It is the bottom of the dependency graph.

Why a kernel instead of letting siblings share directly: it gives every genuinely-shared piece a single, dependency-free home, so sharing never creates a horizontal edge between two concerns. When two siblings both need something, the answer is *never* "let A import B" — it's "move the shared thing to `core/`." That's exactly how the `catalog ↔ user` cycle was broken: the shared read primitive `readUserMetadata` (plus `cleanProjectIdForMetadata`, `normalizeArtifactMode`) moved into `core/metadata.ts`, and the two-way edge disappeared.

Caveat worth knowing (documented in design-systems' README "Known limitations"): "imports nothing" is a *structural* definition of the kernel, not a *semantic* one. It can pull in generic utilities that arguably belong at a daemon-wide shared location (design-systems' `core/frontmatter.ts` is a YAML parser also used by `skills.ts`/`memory.ts`). That's an accepted tradeoff with a noted follow-up — don't over-engineer around it, but don't treat `core/` as a junk drawer either.

### 3. Barrels as the only entry point

Each subdirectory exposes its public surface through a barrel `index.ts`. Callers import the **barrel**, never a private file inside the subdir. The module as a whole exposes one **root barrel** `index.ts`.

- **External code imports only the root barrel.** This is what lets internals move freely: as long as the root barrel keeps re-exporting the same names, no external caller breaks. The root barrel *is* the public API contract.
- Cross-subdir imports (along an allowed edge) also go through the sibling's barrel, so even internal dependencies only see each other's public surface.
- The root barrel uses **explicit named re-exports**, never `export *`. `export *` hides the public surface, makes it un-enumerable, and silently swallows name collisions between subdirs. Enumerability is the point — the export list is the reviewable API.
- A subdir must **not** import the root barrel (`../index.js`): the root re-exports every subdir, so a subdir importing it creates an obvious cycle risk.

### 4. Acyclic, declared edges

The dependency graph between non-foundation siblings must be a **DAG**. Permitted edges are declared explicitly as `allowedEdges` (`[from, to]` pairs). design-systems: `user→catalog`, `import→tokens`, `jobs→user`, `jobs→catalog`. Everything not listed is forbidden. A cycle in the declared list is itself a configuration error that fails the check before any file is scanned.

Acyclicity is what preserves the freedom the split is buying: in a DAG you can always reason about a subdir by looking only "downstream" of it, and you can change a leaf without touching its dependents.

## Why machine-enforced (not just documented)

Conventions in a README rot the first time someone's in a hurry. The guard (`scripts/check-barrel-imports.ts`, run by `pnpm guard`) turns every rule above into a CI failure. That is the difference between "we have an architecture" and "we have an architecture that will still be true in six months." A capability-barrel refactor that isn't registered in the guard is only half-done — it will decay back into a flat namespace, just more slowly.

The enforcement is deliberately scoped to **runtime code** (`apps/daemon/src`). See `barrel-and-guard.md` → "Scope is runtime code, by design" for why tests are exempt and how to keep public-surface tests honest anyway.

## Where the reasoning lives, per module

Every refactored module carries its *own* reasoning in its `README.md` (sections "Why this shape", "Import conventions", "Known limitations & staged migration"). That is docs-as-precedent: the next person refactoring the next subsystem reads a real, working example, not just this abstract template. When you finish a module, its README must stand on its own the way design-systems' does.
