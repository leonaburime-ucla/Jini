# `@jini/metatool` — provenance

Origin: `leonaburime-ucla/open-design`'s `packages/metatool` on `main`
(cloned fresh to `/tmp/od-source`; 2 `src` files, ~195 LOC). Per
`docs/jini-port/recon/r2-packages.md` §13: "build-metadata hash/check/write
mechanics for repo-local tool build outputs (`meta.json`). OD coupling: NONE
(grep: 0 od-concept files)... likely not needed by an engine."

**Ported speculatively with no current consumer, per an explicit human
decision (not because a task currently needs it)** — also **not** in
extraction-plan.md's locked §3 package set, needs sign-off like
`@jini/diagnostics` above. The original recon flagged this package as
"likely not needed by an engine," and this session's task brief confirmed
that framing explicitly: "This package currently has NO identified consumer
in Jini... It is being ported anyway, deliberately, as a reserve/speculative
utility that may become useful later." No other package in this repo
imports it, and none was made to — see "Not wired into any consumer" below.

## File map

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/index.ts` | `packages/metatool/src/index.ts` | Verbatim — zero OD coupling (confirmed independently: `grep -niE "open[- ]design\|OD_"` returned no matches before porting). Zod-validated `meta.json` policy in (`buildCommand`/`distEntries`/`inputs`/`packageName`/`toolName`), a deterministic recursive source-tree hash (sorted directory walk, content-hashed files, path-hashed symlinks), a written `dist/metadata.json` build-hash record, and a freshness assertion that recomputes the source hash and compares it against what's on disk. |
| `src/cli.ts` | `packages/metatool/src/cli.ts` | Logic verbatim (`write`/`check` subcommands, tool-root arg or cwd default). **One mechanical import-extension fix**: the origin imports `./index.ts` directly (works under OD's own tsx/node loader setup); changed to `./index.js` to match the `.js`-extension-on-relative-imports convention every other `@jini/*` package in this repo uses (resolves to the compiled `.js` output, not a runtime behavior change). |
| `src/index.test.ts` | `packages/metatool/tests/build-metadata.test.ts` | Ported near-verbatim (both tests: build-hash shape + freshness-assertion pass, and hash-mismatch rejection after a source edit). Moved beside `index.ts` per this porting session's per-file test convention, so no second `tsconfig.tests.json` was needed. **Identity-stripped** the test fixtures' `@open-design/${name}` package-name strings (used only as arbitrary fixture policy data, not tested behavior) → `@jini/${name}`, and the temp-dir prefix (`open-design-${name}-` → `jini-metatool-${name}-`) — needed to pass this session's own `grep -rniE "open-design"` validation sweep even though the strings were inert fixture data, not real coupling. |

## Not wired into any consumer

Per the task brief's explicit instruction: "Do not invent a consumer or wire
it into any other package to justify its existence — it's fine for it to
sit unused for now." No other `@jini/*` package imports `@jini/metatool`,
and none was added to. Its plausible future use (per the origin package's
own description: "checking freshness of built tool dist outputs") is for a
project-runner-style build-cache mechanism `automation/project-runner`
might eventually want — but that's speculation, not a decision made here.

## Not ported (build tooling, not package content)

`esbuild.config.mjs` (dual CJS/ESM build script) and `tsconfig.tests.json`
(only needed because the origin's tests live outside `src/`) — this package
builds via the shared `tsc -p tsconfig.json` convention every other
`@jini/*` package in this porting session uses.

## Dependencies

`zod` (`^3.25.76`, matching the origin package's pinned version) — for the
`meta.json` policy schema validation.
