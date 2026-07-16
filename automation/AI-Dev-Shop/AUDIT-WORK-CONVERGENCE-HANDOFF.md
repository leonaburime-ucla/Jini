# HANDOFF — /audit-work anti-goalpost (convergence) hardening

_Created mid-task before a context restart. Resume from here._
_Date: 2026-06-26/27. Nothing committed — all changes are in the working tree._

## Goal
Stop `/audit-work` external-audit scores from churning/escalating across fix→re-audit rounds (auditors invent a stricter threat model each pass: "goalpost-shifting") WHILE staying diligent-from-round-1 and not missing real defects. Then prove it converges, and harden the command so the failure modes can't recur.

## TL;DR status
- Hardened design **implemented** in the command + packet template (uncommitted).
- **Round-1 self-audit** of the change: Codex 5/FAIL, Gemini 6/FAIL, 8 distinct blockers → ALL fixed.
- **Round-2 re-audit** (convergence proof, ledger carried): **Gemini = 10/PASS** (0 findings, all 11 ledger entries verified). **Codex = 7/FAIL** — but NO escalation: it accepted the unchanged threat model, mapped both findings to allowlist domains, and both are **diff-caused** regressions from my round-1 fixes (not new pedantry). Both were real; **both now FIXED** (R2-F01, R2-F02 below). Gemini missed them — value of 2 auditors.
- A **Proposed-Fix Disposition Gate** (step 11a) was added after the user (rightly) flagged that I'd applied auditor fixes inline but never persisted/dispositioned them. Codex's R2-F02 then corrected it: it's now a PROCESS-COMPLETENESS gate (forced disposition), NOT a third threat-model blocking condition.

## Immediate next step on resume
**The 2 round-2 Codex blockers are already FIXED this session.** The ONLY validation gap: those 2 fixes (R2-F01 handshake unification, R2-F02 step-11a reframe) are themselves unaudited. So:
1. **(Recommended) Run a round-3 re-audit** to confirm R2-F01/R2-F02 introduced no new contradiction. Use the same two auditors; build the packet exactly like round 2 (frozen TM-ADWORK-CONV-01, round=3, ledger = the round-2 entries G-F0x/C-F0x all `fixed` + R2-F01/R2-F02 `fixed`). Re-dispatch instructions below. If both PASS (≥8.5, 0 new blockers) → fully converged, done.
2. Run any new round-3 proposed fixes through step 11a (agree-implement / agree-defer / disagree).
3. Then ask the user the two still-open decisions: **(a) commit these changes?** and **(b) save the audit report** to `ADS-memory/reports/external-audit/runs/` vs local-only vs inline-only.

## Round-2 Codex findings — BOTH FIXED this session
- **R2-F01 (gate evasion):** command step 10 still demanded a standalone first handshake JSON object while the template required it merged into the single object → cross-file contradiction (Codex marked ledger row G-F03 `verified:false`). FIX: command step 10 now says compute handshake first, report ONLY as `threat_model_accepted`/`rejection_reason` fields in the single object, never a separate block. APPLIED.
- **R2-F02 (contradiction):** step 11a made disposition-incompleteness a THIRD blocking condition outside the frozen dual gate and made implementing advisories a completion prerequisite. FIX: step 11a is now a mandatory PROCESS-COMPLETENESS gate (audit reporting state `INCOMPLETE` until every fix dispositioned; forced evaluation + agree=implement-or-defer preserved per user's demand) but does NOT feed `blocking_gate` and does not make advisory implementation block PASS/FAIL. APPLIED.
- Disposition artifact: `ADS-memory/.local-artifacts/external-audit/proposed-fixes/20260627T051728Z-round2/proposed-fixes.md`.

## Files changed (working tree, NOTHING committed)
- `framework/slash-commands/audit-work.md` — the command. Added: frozen allowlist threat-model contract authoring + round detection (step 5); falsification framing + internal-verifier binding (9d); blocker-driven independent **dual gate** + coordinator-recompute (step 10); **Convergence Protocol** block (handshake, round-aware persona, semantic ledger matching, escape valve, late-finding rule, structured+deterministic); `path to 10` always-advisory fix; **step 11a Proposed-Fix Disposition Gate (HARD BLOCKER)**; step-12 report contract wired to it.
- `.claude/commands/audit-work.md` — **byte-identical synced copy** of the above. ALWAYS re-sync after editing the framework copy: `cp framework/slash-commands/audit-work.md .claude/commands/audit-work.md` then `diff` them.
- `skills/external-audit/references/audit-packet-template.md` — added Threat Model & Scope Contract section (allowlist + risk_tier + score_floor + gate formula), Prior-Round Disposition Ledger, rewritten Auditor Instructions (handshake acceptance checklist, round behavior, ledger reconciliation, blocker rule, no-denylist-routing, escape valve, single-JSON-object schema, neutral COVERAGE_COMPLETE closure).
- (Pre-existing unrelated working-tree changes from the OTHER task — the init-hook work in `init-hook-audit-HANDOFF.md` — are also present; do NOT conflate. This task only touches the 3 files above + the saved artifact below.)

## The hardened design (what the 3 files now encode)
Six mechanisms + dual gate + disposition gate. Validated by Codex+Gemini.
1. **Positive ALLOWLIST, not denylist** — scope = allowed actors/capabilities + a closed list of in-scope blocking failure domains. A blocking finding must map to one or it's advisory. (Both auditors' #1 fix — denylists get routed around by renaming the excluded class.)
2. **Threat model = two-party handshake, frozen+hashed** — auditor's first output accepts/rejects; must independently enumerate surfaces/actors/failure-classes before accepting; reject if narrowed to pass. Material change → NEW TM-id (new series; scores not comparable).
3. **Round-aware persona** — round 1 full pass; round N = Compliance Inspector: reconcile ledger + audit diff PLUS minimum context (not diff-only — that blinds to regressions). Every round-N finding states its diff-causal link.
4. **Disposition ledger + semantic matching** — match by causal claim, not ID/label. Unverifiable `fixed` claim = blocker (gate-evasion). Non-diff late finding needs materially-new evidence + human adjudication; `round_1_miss_justification` alone does NOT admit it.
5. **Classify blocker BEFORE score; independent DUAL GATE** — FAIL iff (validated blocker unresolved) OR (score < floor). Independent; neither rescues the other. `path to 10` items ALWAYS advisory, never promoted by score. **User explicitly wants the below-floor auto-block KEPT** (the decoupling, not removal of the floor, is the fix). Coordinator recomputes the gate; rejects an inconsistent auditor-returned gate.
6. **Structured JSON + escape valve + deterministic** — single JSON object; `out_of_scope_fatal_warnings` surfaces catastrophic out-of-model issues (prevents false negatives from pinning); temperature=0 on re-audits; neutral COVERAGE_COMPLETE closure (not omniscient "no issue remains").
Plus: dropped "assume defects exist" → "falsify every invariant; zero findings is valid."
**Step 11a Proposed-Fix Disposition Gate** — every auditor proposed fix / recommended_fix MUST get an explicit disposition (agree-implement = implement now / agree-defer + reason / disagree + evidence; converged disagrees become user decision points). "Agree but skip" is illegal. Audit can't reach `Audit Outcome` until all dispositioned.

## Audit history (scores)
- **Round 1** (auditing the design change): Codex GPT-5.5 xhigh = **5/FAIL** (7 blockers), Gemini 3.1 Pro = **6/FAIL** (2 blockers + 1 medium). Convergent clusters: path-to-10 recoupling (both), ledger/round-N evasion (both), structured-output/packet integrity (both). All 8 findings → fixed. Proof the design is diligent-from-round-1 AND non-escalating (both mapped every finding to an allowlist domain; no routing-around).
- **Round 2** (re-audit with ledger): Gemini = **10/PASS** (11/11 verified, 0 findings). Codex = **7/FAIL** (10/11 verified; G-F03 marked unverified; 2 new diff-caused blockers R2-F01/R2-F02 — both FIXED this session). Neither escalated the threat model.
- **Round 3**: NOT yet run. Recommended to confirm R2-F01/R2-F02. Expected outcome if design holds: both auditors PASS.
- Round-1 finding IDs and their fixes are enumerated in the round-2 ledger inside `<SP>/audit-fix-r2-packet.md` and in the two saved proposed-fixes artifacts (`20260627T050906Z` = round 1, `20260627T051728Z-round2` = round 2).

## Saved artifact (in repo, NOT scratchpad)
`ADS-memory/.local-artifacts/external-audit/proposed-fixes/20260627T050906Z/proposed-fixes.md` — round-1 proposed-fix disposition table (all 10 APPLIED). This is the persisted record that step 11 requires.

## Memories saved (auto-load next session)
- `feedback_audit-convergence-design` — the 6-mechanism hardened design + dual-gate note (user wants below-floor auto-block kept).
- `feedback_proposed-fix-disposition-gate` — never silently drop proposed fixes; agree=implement; enforced in step 11a.
- (Existing) `feedback_one-shot-deep-audit`, `reference_gemini-cli-dead-use-agy`, `feedback_codex-model`.

## External-auditor dispatch gotchas (CRITICAL)
- **Codex**: default model = GPT-5.5 xhigh (NO `-m` flag — memory `codex-model`). In background MUST redirect stdin: `codex exec "$P" < /dev/null` else it blocks on "Reading additional input from stdin...". Slow under xhigh (round-2 took >4 min).
- **Gemini**: standalone `gemini` CLI is DEAD (IneligibleTierError). Use `agy`: `agy --model "Gemini 3.1 Pro (High)" --dangerously-skip-permissions --print "<prompt>"` (flag order: `--model` before `--print`). `agy --print` HANGS SILENTLY if not signed in — smoke-test first. User is signed in.
- **macOS bash 3.2**: NO `timeout` / `gtimeout` command. Use harness `run_in_background: true` + completion notifications; do not use `( … ) &` subshells (killed).
- Dispatch each auditor the SAME canonical packet, independently, in parallel. Prepend an `ACK_PACKET_RECEIVED <marker>` handshake line.

## Re-dispatch (if scratchpad was wiped)
The round-2 packet is `<SP>/audit-fix-r2-dispatch.md`. If gone, rebuild: `git diff -- framework/slash-commands/audit-work.md skills/external-audit/references/audit-packet-template.md` is the diff under audit; the ledger + frozen contract text is reproduced in this handoff's "design" section. Then:
`codex exec "$(cat <packet>)" < /dev/null > codex.out 2>codex.err &`
`agy --model "Gemini 3.1 Pro (High)" --dangerously-skip-permissions --print "$(cat <packet>)" > gem.out 2>gem.err &`

## Verification snippets (re-run after any edit)
- `cp framework/slash-commands/audit-work.md .claude/commands/audit-work.md && diff` them → must be IN SYNC.
- `grep -n "below the floor they are blocking" …` → must be CLEAN (that was the recoupling bug).
- `grep -n "Proposed-Fix Disposition Gate" framework/slash-commands/audit-work.md` → present at step 11a + step 12.
- Residual-consistency scan: ensure `Late-finding honesty` bullets (command + template) defer to the semantic-ledger rule, not the weaker standalone.

## Open decisions for the user
1. Commit these 3 files (+ the saved artifact)? Nothing is committed.
2. Save the round-1/round-2 audit report to `reports/external-audit/runs/` vs local-only vs inline-only.
3. (Optional) Run a round-3 only if Codex r2 surfaces a real new blocker.
