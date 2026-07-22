# Daemon source recovery — 2026-07-19

Investigation into whether `packages/daemon/src/__tests__/characterization.test.ts`'s
"no running OD daemon or captured live event-stream fixture available" gap
could be closed. Summary: **a real captured byte-for-byte SSE trace still was
not produced** (that requires actually running OD, which this pass
deliberately did not do — see below), but two things of real, non-fabricated
value *were* recovered, and are documented here rather than silently folded
into the test.

## 1. Real network access to upstream OD was available this session

This directory's own `README.md` says: "this sandbox has no network access to
the actual `nexu-io/open-design` history." That was true in whatever session
wrote it. **It was not true in this session.** Verified:

```
curl -sS --max-time 6 -o /dev/null -w "HTTP %{http_code}\n" https://github.com
  -> HTTP 200

gh auth status
  -> Logged in to github.com account leonaburime-ucla (keyring), scopes: gist, read:org, repo, workflow

git ls-remote https://github.com/leonaburime-ucla/open-design.git
  -> 1283 refs returned, including refs/heads/arch/server-startserver-endgame
     at f1aabe9e5ac24b48894b135031a65f893a443b2d — the EXACT branch
     characterization.test.ts's doc-comment cites as `fork/server-endgame`.
```

`leonaburime-ucla/open-design` is a real fork of `nexu-io/open-design` (the
actual "Open Design" product, 79,691 stars, `open-design.ai`), owned by this
project's author. A shallow, single-branch fetch of the exact cited branch
took under 8 seconds:

```
git init && git remote add origin https://github.com/leonaburime-ucla/open-design.git
git fetch --depth=1 origin arch/server-startserver-endgame
```

**Do not assume this access is durable.** It clearly varies by environment/
session (this repo has at least one other fixture, `upstream-daemon-sample.patch`,
built specifically because a prior session lacked it). Any future automation
that depends on this should re-check, not assume.

Separately: `../jini-backups/integrated-478a8557.bundle` (referenced from the
root `AGENTS.md`) is **not corrupted** — `git bundle verify` reports it "records
a complete history," but it is a *thin* bundle whose prerequisite commit is
already an ancestor reachable from this Jini repo's own history, so a bare
`git clone <bundle>` into an empty directory fails ("did not send all
necessary objects"). Fix: fetch the bundle's ref into a repo that already has
the prerequisite object (e.g. a copy of this Jini repo's `.git`), not a fresh
clone:
```
cp -R /path/to/Jini/.git /somewhere/scratch/.git
git --git-dir=/somewhere/scratch/.git fetch \
  /path/to/jini-backups/integrated-478a8557.bundle \
  refs/heads/integrated:refs/heads/integrated
```
That bundle's `integrated` branch (tip `478a85577`, 2026-07-04 14:35) is a
**real, full backup of `apps/daemon`** — it contains the actual merge of
`arch/server-startserver-endgame` (merge commit `ec0d633f8`, 2026-07-04
07:57) plus one more day of decomposition commits on top. Both this bundle
and the live network fetch of the exact cited branch were used below and
cross-checked against each other.

## 2. Re-verification of characterization.test.ts's four cited invariants

All four of the doc-comment's citations against
`apps/daemon/src/runtimes/start-chat-run.ts`,
`apps/daemon/src/runtimes/runs.ts`, and
`apps/daemon/src/run-failure-classification.ts` were checked against the
**actual current source** of the exact branch cited
(`arch/server-startserver-endgame` @ `f1aabe9e5ac24b48894b135031a65f893a443b2d`)
fetched live from GitHub. Result: **all four confirmed, exact line-number
matches, zero discrepancies.**

1. **`'start'` emitted once, first, after `run.status = 'running'`.**
   `start-chat-run.ts` lines 2170-2172, verbatim:
   ```ts
   run.status = 'running';
   run.updatedAt = Date.now();
   send('start', { runId, agentId, bin: userFacingAgentLabel(...), ... });
   ```
   Exact line numbers match the citation.

2. **`summarizeAgentEventForInactivity` field-name shapes.**
   `start-chat-run.ts` lines 1939-1963, verbatim match — `status{label}`,
   `text_delta{delta}`/`thinking_delta`, `tool_use{name}`,
   `tool_result{content}`. Note: this function itself only *summarizes* these
   fields (for an inactivity-watchdog log line); it does not construct the
   full event payloads. The additional fields the test also asserts
   (`tool_use.id`/`.input`, `tool_result.toolUseId`, `usage.usage`) were
   cross-checked separately: `toolUseId` on `tool_result` is real and present
   at `start-chat-run.ts:2804` (`ev.type === 'tool_result' && typeof
   ev.toolUseId === 'string'`); `id`/`input`/`usage` shapes come from the
   agent-runtime stream parsers (already ported per this repo's own
   `packages/agent-runtime/source-map.md`), not from this file — the test's
   own comment scopes this citation to "§3" for a reason.

3. **`runs.ts` `finish()` idempotency guard, lines 199-217.** Exact match,
   verbatim:
   ```ts
   const finish = (run, status, code = null, signal = null) => {
     if (TERMINAL_RUN_STATUSES.has(run.status)) return;
     ...
   };
   ```
   `TERMINAL_RUN_STATUSES = new Set(['succeeded', 'failed', 'canceled'])` at
   line 13.

4. **Resume-on-failure resumes the external CLI session, not the daemon run
   object, lines 1325-1377.** Exact match — confirms the test's own framing
   ("OD's own version resumes the *external CLI session*... a documented
   scope decision, not a literal port") is accurate, not just plausible.

**Cross-check:** the same four regions were also read from the
`integrated-478a8557.bundle` backup (`integrated` branch tip, one day later)
and are byte-identical apart from import-path churn from an intervening
"capability-barrel" refactor. That refactor (`a0db7440a`, 2026-07-03,
*"refactor(daemon): capability-barrel the run domain"*) **renamed**
`apps/daemon/src/run-failure-classification.ts` to
`apps/daemon/src/run/diagnostics/failure.ts` — so if anyone re-verifies this
citation against the `integrated` branch tip instead of
`arch/server-startserver-endgame` directly, look there, not at the old path.

No corrections are needed to `characterization.test.ts` — its citations hold
up against real source, not just against a human's earlier reading of it.
(Per task instructions this session did not edit the test itself.)

## 3. What was recovered as a fixture, and what wasn't

**Recovered:** `chat-run-sse-shapes.golden-test.upstream.txt` in this
directory — a verbatim, byte-for-byte copy of OD's own real
`apps/daemon/tests/chat-run-sse-shapes.test.ts` from the same commit/branch
above. Read that file's own header before using it — **it is real upstream
test source code, not a captured event trace.** It matters because it's OD's
own engineers encoding the same SSE-shape invariants our characterization
test hand-encodes, via a test that actually boots the real `startServer()`
and drives it over real HTTP with a scripted fake-agent binary — strictly
stronger evidence than line-citation, but still source, not a wire capture.

**Not recovered, and why:** an actual byte-for-byte captured SSE trace (raw
`id:`/`event:`/`data:` bytes off a real running response). Producing one
requires actually executing that test — `pnpm install` in a real OD
checkout, then `pnpm vitest run tests/chat-run-sse-shapes.test.ts` (optionally
patched to dump the raw response body to a file before assertions run). This
investigation was explicitly scoped read-only (no `pnpm install`, no service
execution, no touching other in-flight work), so that step was not taken.
**This is now a concretely unblocked, mechanical next step** — not a "needs
network access, none available" dead end like it was previously understood to
be — for whichever session is next authorized to install deps and run a real
process. See `chat-run-sse-shapes.golden-test.upstream.txt`'s header for the
exact command sequence.

**No synthetic/fabricated trace was created.** Everything added here is
either (a) real, verbatim, provenance-cited upstream source, or (b) this
documentation of what was and wasn't verified.
