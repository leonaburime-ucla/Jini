# Documentation conventions — @module docblocks, JSDoc, and the README

Documentation is a **hard acceptance bar** for this refactor, not a nicety. The reference module `apps/daemon/src/design-systems/` documents every file and every exported symbol; copy its style exactly. Open any of its files next to this page.

## 1. Every file starts with a `@module` docblock

The first thing in every `.ts` file (source and barrel) is a module docblock: what this file owns, and how it relates to its siblings. Real examples from the reference:

```ts
/** @module core/index
 * Foundational layer: all shared types, YAML front-matter parsing, SwiftUI color parsing, DESIGN.md body utilities, metadata read primitives, and CLI argument parsers.
 * This is the kernel every other subdirectory may depend on directly; core itself never imports from a sibling subdirectory.
 */
```

```ts
/** @module reader
 * Read-only catalog operations: listing all design systems (built-in + installed + user), reading a single entry, resolving package info, and pulling individual files.
 * Parses DESIGN.md front-matter and body to populate DesignSystemSummary; delegates asset resolution to assets.ts.
 */
```

Guidance:

- Line 1: `@module <name>` + one sentence on the file's responsibility.
- Following lines: the important collaborators / what it delegates to / any invariant a reader must know. For `core/*` files, state explicitly that they import no sibling. For a subdir file, name the sibling barrel(s) it's allowed to reach.
- Keep it to 2–4 lines. It's a signpost, not an essay.

## 2. Every exported symbol gets JSDoc

Every exported function, type, and const carries a JSDoc block. It must say **why the thing exists / what invariant it upholds**, not just restate the signature. Include `@param` and `@returns` where they add information. Example shape:

```ts
/**
 * Reads a design-system file as raw bytes for static HTTP serving, or `null`
 * when the id/path is invalid, the file is not manifest-declared, escapes the
 * design-system root, or does not exist. The returned payload carries the
 * resolved `Content-Type`.
 */
export async function readDesignSystemStaticFile(...) { ... }
```

Prefer a named helper whose docblock states the invariant over an unexplained `if` guard — the call site should read as intent (this matches the repo's "Let the fix read as an invariant" guidance in `AGENTS.md`).

## 3. Private helpers get a short `@internal` block

Non-exported helpers still get a brief docblock, tagged `@internal`, so a reader knows it's not part of the surface:

```ts
/**
 * @internal
 * Recursively adds all files under a declared directory to the pull-file allowlist.
 * Hidden files and directories are skipped.
 */
async function addFilesUnderDeclaredDir(...) { ... }
```

## 4. Every barrel describes the layer

Barrels (`<subdir>/index.ts` and the root `index.ts`) carry a `@module` docblock naming the layer's responsibility and its boundary. The root barrel's block states that it is the module's public API and re-exports only from subdir barrels. Example:

```ts
/** @module catalog/index
 * Read-only catalog layer: design system listing, reading, asset resolution, source context fetching, and HTML preview/showcase rendering.
 * All operations here are non-mutating — writes live in user/ and import/.
 */
```

## 5. Write the module README

Every refactored module gets a `README.md` that stands on its own, mirroring `apps/daemon/src/design-systems/README.md`. Required sections (same headings):

- **What changed (refactor history)** — the ordered list of moves, so a `git blame`-confused reader can reconstruct intent.
- **Why this shape (architecture reasoning)** — the concern boundaries, the foundation kernel, why the edges are what they are, and any cycle you broke and how.
- **Import conventions** — the enforced rules restated for this module (foundation, edges, barrel-only, no root-barrel-from-subdir, explicit named re-exports), plus the "tests are exempt by design; public-surface tests still use the barrel" note.
- **Known limitations & staged migration** — honest caveats (e.g. a generic utility that landed in `core/` and its planned follow-up) and what's deferred.
- **Directory structure** — a tree with a one-line purpose per subdir.
- **Types** — where the shared types live and what they model.

This is *docs-as-precedent*: the next contributor refactoring the next subsystem should be able to read your README and this reference module and reproduce the pattern without you.

## Delegating the mechanical writing (default when subagents exist)

Drafting dozens of docblocks is mechanical. If your harness supports subagents, delegate the *first draft* of docblocks, barrel descriptions, and per-file summaries to a cheaper/faster model — on Claude Code, Sonnet (e.g. `claude-sonnet-4-6`) subagents. Don't go below Sonnet-class: Haiku-class models produced badly inaccurate file summaries when tried on this workflow. Batch the work per subdirectory so each subagent gets a coherent slice, and hand it the `@module`/JSDoc conventions from this file verbatim so drafts land in the right shape. Non-negotiable: **you** verify every block against the actual code — an inaccurate docblock actively misleads and is worse than none. If you can't delegate, write them inline; do not skip them.
