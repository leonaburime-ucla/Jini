# Validation, merging with main, and opening the PR

## Validation commands (Phase 6)

Run from the repo root. Record the real numbers — the PR's Validation section quotes them.

```bash
# 1. The guard's own suite (also compile-checks your registry edit)
node --import tsx --test scripts/check-barrel-imports.test.ts

# 2. Full guard — runs the barrel check across every registered domain
pnpm guard

# 3. Package typecheck — BOTH src and tests must be clean
pnpm --filter @open-design/daemon typecheck

# 4. The module's targeted test suite (adjust the globs to your module)
pnpm --filter @open-design/daemon exec vitest run tests/<your-module> tests/<related>.test.ts

# 5. Public-surface proof — the root barrel must export the same names as before.
#    Capture the old export list before you start, diff it after.
git show <base>:apps/daemon/src/<module>/index.ts   # (or the old flat file)
```

Notes:
- A `pnpm guard` failure on residual `.js` files under untracked local dirs (e.g. a vendored toolkit) is a **pre-existing, unrelated** local-only issue — it won't appear on CI, which checks out only committed files. Confirm the failure is that and not your change before dismissing it.
- If the working tree carries unrelated dirty files, run the targeted suite rather than a broad one, and don't let an unrelated WIP typecheck error mask your result.

## Merging main into a long-lived refactor branch

A refactor PR often sits in review while `main` moves ahead — and `main` will keep editing the **old** structure (the monolith / flat files) you just dissolved. Merging then conflicts because "file split into N" can't auto-reconcile with "file gained new code." The re-home procedure:

1. **If the working tree is dirty with unrelated work, do the merge in an isolated worktree** so nothing in the main checkout is disturbed:
   ```bash
   git worktree add --detach /tmp/<name> HEAD
   cd /tmp/<name>
   git merge origin/main            # resolve conflicts here
   ```
   The worktree has no `node_modules`; run `pnpm install` there to validate (it hard-links from the global store, ~1 min). Clean up with `git worktree remove --force /tmp/<name>` after pushing.
2. For each conflict, **diff what `main` added to the old structure** and re-home it into the new split files:
   ```bash
   BASE=$(git merge-base HEAD MERGE_HEAD)
   git diff $BASE MERGE_HEAD -- apps/daemon/src/<module>/index.ts   # every line main added to the monolith
   ```
   Place each added symbol in the subdir that owns its concern (a new read → the read subdir, a new type → `core/types.ts`, a provenance/threading change → wherever that logic lives), then re-export new **public** symbols through the sub-barrel and the root barrel. Keep logic byte-equivalent to main's — this is still a move, not a rewrite.
3. **Fix any test imports** `main` added that reference the old flat paths (they'll point at files you moved).
4. Re-run the full Phase 6 validation on the merged state. For a non-trivial merge, an **independent second-model audit** of the resolution is worth it — on the reference PR it caught two real dropped-import blockers (test files still importing pre-refactor paths) that would have failed CI.

## Opening the PR

1. **Commit only the refactor's files.** Stage explicit paths (`git add <path> <path>`); never `git add -A` when the tree has unrelated WIP. No `Co-authored-by` / co-author trailers (repo policy).
2. **Push to the right remote.** For a cross-repo (fork) PR, `origin` (upstream) will 403 — push to the contributor's `fork` remote. Confirm the topology first:
   ```bash
   gh pr view <n> --repo nexu-io/open-design --json headRepositoryOwner,isCrossRepository,headRefName
   git push fork HEAD:<branch>
   ```
3. **Fill the body** from `../templates/pr-body.md`. Every section, not just the title. The repo's PR template Surface-area checklist for a pure internal refactor is **None** (the guard script is internal dev tooling, not a user surface). Quote the real Phase 6 numbers in Validation.
4. **After a mid-review merge, refresh the Validation section** — pre-merge numbers are stale once you re-home main's code.
5. Verify the result: `gh pr view <n> --json mergeable,mergeStateStatus` should read `MERGEABLE` (a `BLOCKED` mergeStateStatus just means CI/review gates are pending, not a conflict).
