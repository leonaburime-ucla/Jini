Fixtures for the milestone 1 patch-canary red-spec (`sync-ownership.test.ts`).

`upstream-daemon-sample.patch` is a **synthetic stand-in** for a real
`git format-patch` output from OD's upstream daemon — this sandbox has no
network access to the actual `nexu-io/open-design` history, so a hand-written
minimal patch stands in for "a known upstream daemon patch" until milestone 1
impl (or a later session with real upstream access) can swap in an actual
historical commit. It touches `apps/daemon/src/routes/health.ts`, which the
path transform must rewrite to `foundry/integrations/open-design/daemon/src/routes/health.ts`
(see extraction-plan.md §4.3 — the transform target there says
`products/open-design/daemon/…`, which predates this repo's `integrations/`
rename; the real target is the current `foundry/integrations/open-design/` layout).
