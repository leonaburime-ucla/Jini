# OD PR Inventory Coverage Audit

Audit of `leonaburime-ucla/open-design` (fork of `nexu-io/open-design`) branches, all authored by
leonaburime-ucla, all either closed-without-merge or still-open PRs against `nexu-io/open-design`.

For each branch: checked out in `/tmp/od-audit`, located the real test suite for the package(s) it
touches, ran it, and captured pass/fail counts and coverage (statements/branches/functions/lines) if a
coverage script/config exists. Also checked mergeability against the fork's current `main` via
`git merge-base` + a dry-run merge into a throwaway branch (never merged into anything real).

Working notes: this file is checkpointed — one row appended (commit + push) immediately after each
individual branch finishes, not batched. If this run stops early, everything below the header is real,
verified progress; anything not yet listed has simply not been audited yet.

Status legend: ✅ complete audit · ⚠️ partial/blocked (see note) · ❌ branch not found

## Results

| Priority | Branch | PR# | Status | Test suite found | Pass/Fail | Coverage (stmts/branch/func/lines) | Mergeable vs main | Note |
|---|---|---|---|---|---|---|---|---|
| 3 | codex-capability-barrel | #5150 | ✅ | Yes — `apps/daemon` vitest (`pnpm test` in `apps/daemon`, `vitest.config.ts`) | Files: 415 passed / 9 failed / 4 skipped (428). Tests: 5413 passed / 25 failed / 7 skipped / 4 todo (5449) | No coverage script/config found for `apps/daemon` (`vitest run --coverage` errors: `@vitest/coverage-v8` not installed; no coverage script in `apps/daemon/package.json` or root `package.json`) | Yes — `git merge-base` origin/main == origin/main HEAD (0b88ef561) for this branch, dry-run `git merge --no-commit --no-ff` clean, 0 conflicts | All 25 failing tests are outside the codex domain the branch touches (amr-session-resume, connection-test auth/CLI-spawn, media/policy-routes, xai/tokens EACCES-as-root) — same failure signatures reproduced independently on `memory-capability-barrel`'s run, strongly suggesting these are pre-existing/environment-driven (sandboxed process spawning, no real network/CLI auth, tests run as root so EACCES simulation via chmod 0o000 doesn't hold) rather than caused by this branch. No codex-specific test failed. |
