# Cloud routine prompt template (Claude Code cloud / claude.ai/code routines)

The prompt to pass as `job_config.ccr.session_context.events[].data.message.content`
when creating a routine (via `/schedule` or the `RemoteTrigger` tool) that drives
one `project-runner` ledger claim. Copy the block below, do not hand-invent a new
one each time — it encodes two lessons from the 2026-07-16 trial run
(`trig_01BpadA61VBEnmgUvzZvo8nk`, see `docs/jini-port/milestone-1-red-spec.md` for
what it produced).

**Routine config notes (as of 2026-07-16):**
- `session_context.sources` supports exactly **one** `git_repository`, cloned at
  its **default branch only** — no multi-repo, no ref/branch selection. Set it
  to the Jini repo. Anything else the session needs (OD reference branches — see
  `docs/jini-port/od-reference-branches.md`) it clones itself, live, via Bash
  (`nexu-io/open-design` and `leonaburime-ucla/open-design` are both public, no
  credentials needed).
- One claim per routine invocation (the prompt below does not loop). Trigger
  again for the next `WorkItem`.
- Lessons already folded into the prompt below: (1) a `red-spec` task's whole
  point is a FAILING test — don't tell the session "make tests pass," tell it
  "the new spec must fail with a clear message; everything else must stay
  green." An earlier draft of this prompt said "make sure tests pass," which is
  actively wrong for `red-spec` and only avoided causing a bad outcome by luck.
  (2) explicitly point at `docs/jini-port/od-reference-branches.md` so a session
  doing frontend work knows real refactor branches exist instead of guessing.

---

```
You are working in the Jini repo — a general-purpose, headless, agent-drivable
engine being extracted from a product called Open Design (OD). Be conservative:
if anything is ambiguous or the scope feels too large for one session, do less
but do it correctly, and say so honestly in your summary rather than
overreaching.

Read first, in order:
1. AGENTS.md (repo root) — directory guide and hard boundaries.
2. docs/jini-port/START-HERE.md and docs/jini-port/extraction-plan.md — the
   locked architecture and the numbered extraction task list (section 8).
3. automation/project-runner/README.md — the ledger you'll be driving.
4. docs/jini-port/od-reference-branches.md — if your claimed task touches
   frontend/UI extraction, this indexes real OD refactor branches (both repos
   are public; clone them yourself with plain `git clone`, they are not
   pre-attached to this session).

Then:

1. Run `pnpm install`.
2. Run `pnpm --filter @jini-automation/project-runner run claim`. This claims
   the next eligible WorkItem from the committed SQLite ledger and prints
   `claimed=true/false` plus (if true) work_item_id, attempt_id, task_type,
   milestone, milestone_title, milestone_gate, sandbox_path.
   - If claimed=false: nothing is available (queue empty or everything left is
     waiting on human approval). Just report that and stop — do not force
     anything.
3. If claimed, task_type is one of red-spec, impl, package-contract, tarball,
   consumer-canary, evidence, or human-approval — all sub-steps of the
   milestone named in milestone_title, gated by milestone_gate:
   - human-approval: this WorkItem only becomes claimable after a human
     already ran the approve CLI, so there is no code work to do —
     immediately run `pnpm --filter @jini-automation/project-runner run
     complete <attempt_id> succeeded "human approval already granted"` and
     stop.
   - red-spec: write the failing test(s)/spec that pin down the milestone's
     target behavior before any implementation exists. THE NEW SPEC TEST(S)
     MUST FAIL when you run them — that failure, with a clear message
     pointing at what needs to be built, IS the deliverable. Do not write
     throwaway implementation just to turn it green; that defeats the point.
     Everything ELSE in the repo (pnpm guard, any pre-existing test suite)
     must still pass — you're pinning one new failure, not causing a
     regression elsewhere. Complete the attempt as `succeeded` once the new
     spec fails cleanly and nothing else broke.
   - impl: implement against an existing red-spec so it (and everything else)
     passes.
   - package-contract: verify/define the package's public export surface
     matches what the milestone needs (types, barrel exports).
   - tarball: prove the package packs correctly (e.g. `pnpm pack` or
     equivalent) and can be installed as a tarball dependency.
   - consumer-canary: prove a real consumer (e.g. examples/minimal-host) can
     actually consume the package.
   - evidence: collect and record test/typecheck/build output as evidence the
     milestone's gate (milestone_gate) is satisfied.
   - IMPORTANT: check whether the milestone's real engine work already exists
     in packages/ from an earlier session that did NOT go through this ledger
     (this has happened before — the ledger can be stale relative to reality).
     Look at what already exists first (source-map.md, tests, tsconfig) before
     doing anything; if it already satisfies the sub-task, complete it with a
     summary explaining that, rather than duplicating work.
4. Do the actual work for the claimed sub-task (except red-spec's inverted
   pass/fail rule above). Follow the same rigor as the existing packages under
   packages/* that already have a source-map.md (protocol, core, platform,
   sidecar, chat-core) — same tsconfig/barrel/test/source-map pattern if
   you're producing new package code.
5. Run `pnpm guard` and any relevant `pnpm --filter <pkg> run
   typecheck`/`test` and make sure the REPO'S EXISTING state is green (see the
   red-spec exception above for the one new intentionally-failing test).
6. Complete the attempt: `pnpm --filter @jini-automation/project-runner run
   complete <attempt_id> <succeeded|failed> "<one-line summary>"` — use
   `failed` honestly if the gate wasn't actually met; don't mark succeeded to
   look done.
7. Commit everything (the code changes AND the updated
   automation/project-runner/ledger/* files) and push to main. Write a clear
   commit message describing exactly what was done, in the style of the
   existing commit history (`git log` to see the pattern).

End your session with a clear plain-language summary of what you found, what
you did, and what (if anything) looked wrong with the ledger/claim/complete
tooling itself or this prompt — that feedback matters as much as the
extraction work itself.
```
