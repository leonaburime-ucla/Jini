# HANDOFF — first-run init hook + slash-command installer (audit loop)

_Created mid-task before a context clear. Resume from here._

## Goal
A first-time initialization hook for when someone loads the AI Dev Shop toolkit into their repo:
1. On first session, create the `ADS-memory/` workspace + write a one-time flag so it does NOT re-run every startup.
2. Work for non-Claude hosts too (Codex/Gemini), not just Claude's SessionStart hook.
3. Slash-command install is **opt-in** (agent asks the user) — never automatic.
4. Before installing, **collision-check**: never clobber a same-named command the host already has (e.g. an existing `/code-review`).

User also required: fix the stale folder misname `AI-Dev-Shop-speckit` → `AI-Dev-Shop` (real repo: github.com/leonaburime-ucla/AI-Dev-Shop). DONE (14 docs renamed; only generated `.tsv` archive still has it).

## Files in play (working tree, NOTHING committed)
- NEW `framework/operations/scripts/ads-initialization.sh` — workspace-only init + sentinel flag. Name-agnostic host resolution: `--host-dir` > `$ADS_HOST_DIR` > `$CLAUDE_PROJECT_DIR` > git toplevel > toolkit root. Does NOT install slash commands.
- NEW `framework/operations/scripts/install-slash-commands.sh` — opt-in, collision-checked installer. `--check`/`--install`/`--overwrite`/`--include-project`/`--only <cmd>`/`--host-dir`.
- NEW `.claude/settings.json` — SessionStart hook (startup|resume|clear) that locates+runs ads-initialization.sh (direct path, else pruned `find -maxdepth 6 -type f`, single-match only).
- MODIFIED `framework/operations/scripts/setup-project-knowledge.sh` — default workspace now resolves to host root (same logic), not parent-of-toolkit (was creating a junk sibling).
- MODIFIED docs: `AGENTS.md` (startup step 6 = host-agnostic init), `CLAUDE.md`, `README.md`, `framework/operations/reminders.md` (slash-commands-setup = collision-checked flow), `.gitignore` (`.claude/.ads-initialized`), + the speckit→AI-Dev-Shop rename across many docs.

## Key facts / gotchas
- Runtime is **macOS bash 3.2** — arrays must be 3.2-safe (`${#arr[@]}` guards; no `${arr[@]}` on empty under `set -u`).
- Workspace lands at `<host_root>/ADS-memory` (inside repo in dev layout; sibling-of-toolkit-inside-host in subfolder layout). `ADS-memory/` is gitignored.
- Two layouts: **dev** (toolkit IS the git repo root — this repo) and **subfolder** (toolkit copied into a host repo as `AI-Dev-Shop/`).

## External-auditor invocation gotchas (IMPORTANT — see also memory `reference_gemini-cli-dead-use-agy`)
- `gemini` CLI is dead (free-tier `IneligibleTierError`). Use **`agy`** (Antigravity): `agy --model "Gemini 3.1 Pro (High)" --dangerously-skip-permissions --print "<prompt>"`. Flag order: `--model` before `--print`.
- `agy --print` **hangs silently if not signed in** (blocks on an invisible sign-in prompt). User signed in; smoke test now returns. Run a tiny smoke test first.
- `codex exec` in **background** must redirect stdin: `codex exec "$P" < /dev/null` — else it blocks on "Reading additional input from stdin...". Codex default model = GPT-5.5 xhigh (no `-m`, per memory `codex-model`).
- Dispatch via harness-managed background Bash (run_in_background) — do NOT use orphaned `( ... ) &` subshells (they get killed). Watch with a bounded background loop.

## Audit history (scores)
- Round 1 (Codex 3/10, Gemini 7/10): fixed ~13 findings incl. the CRITICAL `.claude`-existence path heuristic (broke subfolder layout) + the rename.
- Round 2 (Codex 6/10): fixed regression (hook `maxdepth 4`→6) + symlink/host-validation/setup-fallback items.
- Round 3 (Codex 5/10) and Round 4 (Codex **5.5/10**): score NOT converging — Codex escalates the threat model each pass (dangling-symlink TOCTOU, control-char paths, `link(2)`/`rename(2)` atomicity, hook toolkit-identity). Gemini v4 was still running at handoff time.
- Strategy fix (see top of this file): pin threat model + demand one exhaustive pass + freeze scope/rubric. Use that for the NEXT audit prompt.

## Codex v4 findings (ADS-INIT-AUDIT-04) — status
CLOSED: V3-4 (sentinel dir false-success), V3-6 (unique backups), V3-8 (dangling user symlink), V3-12 (overwrite wording).
Cheap fixes APPLIED this session after v4 (verify they're present):
- `is_real_dir_or_absent` now treats dangling symlink as not-absent (V3-1/V3-2). DONE.
- `sentinel_valid` now also greps the recorded `"workspace"` equals expected (V3-3). DONE.
Cheap fixes STILL TODO (planned, not yet applied):
- V3-5: validate each `--only` name with an exact array loop (current `avail` substring check can pass a two-word value).
- Finding 13: `install_new_noclobber` returns 2 on ANY `ln` failure; after failure, re-check existence — return 2 only if target now exists, else 1.
- Finding 15: destination components (`.claude`, `commands`) — reject existing non-directory, not just symlink.
- V3-11 (partial): also control-char-check `ads_root` (not just `host_dir`).
DEEPER / DECISION REQUIRED (likely needs a small Python helper, or accept as out-of-scope under a single-user threat model):
- V3-7 / Finding 14: true atomic no-clobber + sentinel publish against a target that races to dir/symlink-dir mid-run → needs `os.link`/`os.rename` exact-path semantics (shell `ln`/`mv` apply directory-operand semantics). 
- V3-9: hook executes by path-suffix match only — add toolkit-identity validation (e.g. confirm resolved root has AGENTS.md + framework/slash-commands) and reject symlinked ancestors.
- V3-10: subfolder hook `find` can be slow on big monorepos — cache a verified toolkit path at install time.

## Open decision for the user
Hit ≥8.5 from Codex by adding a tiny **Python helper** for atomic link/rename + JSON (closes V3-7/14/11) and hook-identity (V3-9)? OR accept the pragmatic bash hardening and declare the residual TOCTOU/control-char items out-of-scope for a single-user bootstrap script (then re-audit with a PINNED threat model so the score reflects that scope)?

## Verification snippets (re-run after changes; macOS bash 3.2)
- `bash -n` both scripts.
- init: `--status`, `--force`, symlinked `.claude` → exit 2, empty sentinel → re-inits, schema marker present.
- subfolder sim: temp git repo, toolkit subfolder, no `$CLAUDE_PROJECT_DIR` → installer Target must be HOST/.claude/commands.
- installer: `--only` exact + bad name exit 2, NEW hardlink install, 2 unique `*.ads-bak.*` on repeated `--overwrite`, dangling user symlink → USER-UNSAFE.

## Scratchpad artifacts (this session; may be cleared)
Packets/outputs under `…/scratchpad/` : `dispatch-v4.txt` (current packet), `offloads4/codex.stdout` (Codex v4), `gemini-v4.stdout` (Gemini v4, was running).

---

## RESUME 2026-06-27 — pinned threat model + re-audit DONE (round 1 under TM-INIT-SU-01)

Took the "pin single-user threat model + re-audit" path. **Convergence achieved** — escalation stopped: all three reviewers accepted the frozen contract; Codex endorsed the N1 single-user boundary and stopped escalating TOCTOU/atomicity.

- **5 code fixes applied** (all verified, `bash -n` clean): V3-5 exact `--only` loop; F13 `ln`-failure return code; F15 reject non-dir `.claude`/`commands` component; V3-11 `ads_root`+installer control-char checks; **R1-1 sentinel_valid** now whole-line `grep -Fxc` exactly-once (closes the unanchored-grep decoy/transplant I4 gap — decoy + duplicate exploit tests pass).
- **Round-1 scores:** internal verifier PASS 9.0 (0 blockers), Gemini 3.1 Pro PASS 10 (0 findings), Codex GPT-5.5 xhigh 8.2 FAIL (1 blocker R1-1, now fixed).
- **Frozen packet:** `TM-INIT-SU-01` hash `sha256:323997c16e404de9` at `ADS-memory/.local-artifacts/external-audit/packets/20260627T161208Z-audit-packet.md`. Report + proposed-fixes under the sibling `runs/` and `proposed-fixes/` dirs.
- **Codex dispatch that works** (3 prior attempts returned empty — see memory `codex-exec-empty-output`): `codex exec --json -c features.multi_agent=false -c 'hooks.SessionStart=[]' "$P" < /dev/null`, parse the `agent_message` from JSONL.

### Open decisions (Task #5)
1. **Round-2 diff-only re-audit** of the R1-1 `sentinel_valid` fix (expected Codex PASS → fully converged) — OR accept the local exploit-test evidence.
2. **Commit?** Nothing committed; branch off `main` if yes (3 new artifacts + the 5 fixes).
3. **Report retention:** keep in `.local-artifacts/` (default) or move to `reports/external-audit/`.
