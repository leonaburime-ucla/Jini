# Barrel & guard — the enforced rules and how to register a domain

The guard lives at `scripts/check-barrel-imports.ts` and runs inside `pnpm guard`. Its own test suite is `scripts/check-barrel-imports.test.ts`. Read both alongside this file — they are the source of truth; this page summarizes them.

## The 7 rules (numbering matches the test suite)

For each registered domain, the guard walks every source file under the scan root, parses its imports (static `import`, re-exports `export … from`, `import type`, dynamic `import()`, and `import x = require()`), and enforces:

1. **External code may only import via the domain barrel** (`<root>/index.ts`) — never into a subdir directly. This is the rule that makes internals movable.
2. **A subdir may import the foundation (`core`) directly**, by any path (allowance).
3. **Imports within the same subdir are unrestricted** (allowance).
4. **A subdir may reach a non-foundation sibling only along a declared `allowedEdges` edge, and only through that sibling's barrel** (`../<sibling>/index.js`). Every other cross-subdir import is a violation.
5. **A subdir may not import the domain root barrel** (`../index.js`) — the root re-exports every subdir, so this invites a cycle. Import from `core` or an allowed sibling barrel instead.
6. **A file directly under the domain root** (the root `index.ts`, or a straggler module like `server-services.ts`) may reach a subdir **only through that subdir's barrel** (`./<subdir>/index.js`), never a private file inside it.
7. **The domain root barrel must use explicit named re-exports** — `export *` from a subdir hides the public surface and silently swallows name collisions.

A cycle in the declared `allowedEdges` list, a `foundation` that appears in an edge, an unknown subdir, or a self-loop are all **configuration errors** that fail the check *before any file is scanned*.

## Registering a new domain

Add one entry to `CAPABILITY_BARREL_DOMAINS` in `scripts/check-barrel-imports.ts`. The shape (`CapabilityBarrelDomain`):

```ts
{
  name: 'design-systems',                    // human-readable, used in violation messages
  root: 'apps/daemon/src/design-systems',    // repo-relative domain root
  subdirs: ['core', 'catalog', 'user', 'import', 'tokens', 'jobs'],
  foundation: 'core',                        // the kernel; every sibling may import it directly
  allowedEdges: [                            // directed, acyclic [from, to]; must go through the sibling barrel
    ['user', 'catalog'],
    ['import', 'tokens'],
    ['jobs', 'user'],
    ['jobs', 'catalog'],
  ],
}
```

Rules for the entry:

- `foundation` must be one of `subdirs`, and must **not** appear in any `allowedEdges` pair (siblings import it freely, so declaring an edge to it is redundant/an error).
- `allowedEdges` must be **acyclic**. Keep it minimal — each edge is a real, reviewed coupling. If you need many, your concern boundaries are wrong (see `architecture.md`).
- You are only adding a registry entry. The scan machinery, the `pnpm guard` wiring, and the test harness already exist from the design-systems domain — do **not** fork or duplicate the scan code.

After adding the entry, run the guard's own suite and the full guard:

```bash
node --import tsx --test scripts/check-barrel-imports.test.ts
pnpm guard
```

Fix every violation by correcting the **import** (route it through the right barrel, or move the shared symbol to `core/`). Never fix a violation by loosening the rules or adding an ad-hoc exception — a violation the guard can't express cleanly means the layout is wrong.

## Scope is runtime code, by design

The scan root is intentionally `apps/daemon/src` (runtime code) only. `apps/daemon/tests` is **not** scanned, and that is deliberate:

- Unit tests legitimately **white-box** internal helpers that are deliberately *not* on the public barrel (design-systems has ~18 such tests importing `core/swift-colors`, `user/migration`, `tokens/token-contract`, `import/shadcn-import`, …).
- Widening the scan to tests would force those internal-only helpers onto the public surface just so tests could import them through the barrel — which destroys the encapsulation the whole pattern exists to create.

So the enforced guarantee is: **external *runtime* code imports only the barrel.** The complementary rule for tests is a documented **convention, not machine-enforced**:

> A test covering a symbol the root barrel *does* export (a public-surface function) should still import it via the root barrel, so the public API is exercised the way real consumers use it. Only genuinely internal helpers get white-boxed through deep paths.

This distinction matters for the PR description: say "external **runtime** code imports only the root barrel," not "all external code." Over-promising here is exactly the kind of thing a reviewer will (correctly) flag. If they do, narrow the wording and move the public-surface tests back onto the barrel — do **not** widen the scan.
