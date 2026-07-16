# External Audit Report — Slash-Command Protocol Changes

- **Packet:** `AUDIT-DEBATE-PROTO-20260712T195746Z` (TM-DEBATE-PROTO-01, round 1)
- **Scope:** debate.md, peer-llm-dispatch.md, consensus.md, cowork.md, audit-work.md protocol edits; `.claude/commands/` re-sync; new `validate_slash_command_parity.py` guard; F1 agy-staging fix.
- **suggest_changes:** notes · **risk_tier:** medium · **score_floor:** 8.5
- **Transport:** self-contained stdin (both peers)

## Auditor Matrix

| Auditor | CLI / Resolved Model | Score | Gate (as returned) | Blockers raised |
|---|---|---|---|---|
| Internal verifier | Claude Opus (subagent, Code Review persona) | 9/10 | PASS | 0 (2 advisories) |
| codex | codex-cli 0.144.0 / GPT-5.5 xhigh | 8/10 | FAIL | 1 (parity-guard, med conf) |
| gemini | agy / Gemini 3.1 Pro (High) | 6/10 | FAIL | 2 (contradiction; parity-guard) |

## Per-Auditor Scope Checks
- **codex:** audited packet only, no repo reads; treated filesystem state as asserted.
- **gemini:** audited all five diffs + Addendum (agy fix, `.claude` re-sync, parity guard) against domains 1–7 / INV1–7.
- Both accepted the threat model (no rejection).

## Cross-Auditor Synthesis

Two distinct issues, both traced to their true root cause by the coordinator against the REAL artifacts:

### 1. Parity-guard "crash" — BOTH auditors (codex F1 + gemini F2) — FALSE POSITIVE on the delivered code
Both flagged that the validator "Full source" in the packet references `Path` without importing `pathlib` and is pseudocode → would `NameError` or always exit 0.
**Coordinator verification of the REAL file** `harness-engineering/validators/validate_slash_command_parity.py`:
- `from pathlib import Path` present (line 23); full `main()` + `sys.exit(main())` (lines 38, 96).
- Runs clean (exit 0) on synced state; returns exit 1 on an injected stale `plan.md` edit with FIX telemetry.
- Wired into `run-all.sh` hard checks (line 24) AND precommit (line 46); documented in validators README.
**Root cause:** coordinator PACKET DEFECT — Addendum C mislabeled a condensed pseudocode excerpt as "Full source." The delivered artifact is correct, tested, and wired. Because two auditors independently converged, this is surfaced as a Decision Point rather than silently dismissed.

### 2. debate.md Routing Guard contradiction — gemini F1 — VALID (real wording imprecision) → FIXED
"External peers are mandatory… a run that drops them… is invalid" read as an absolute, clashing with the Replacement exception ("skip external dispatch").
**Coordinator agrees** the absolute phrasing was imprecise. **Disagrees** with gemini's fix (delete Replacement) — the Replacement override pre-dates this session and is intended user-invoked behavior; the session goal was to ADD Addition, not remove Replacement.
**Fix applied:** qualified to "External peers are mandatory **by default: absent an explicit user request to do otherwise (the Replacement exception below)**, a run that drops them… is invalid." Re-validated: `validate_debate_routing_guard.py` PASS, parity PASS.
**Note on packet INV2:** the packet's INV2 ("additive only, never a replacement") was itself too absolute — it mischaracterized the command, which is additive-by-default with explicit-replacement allowed. That over-strong invariant amplified the finding.

## Coordinator Response → Agree
- debate.md absolute-"mandatory" phrasing was imprecise (fixed).
- agy staging should reference only staged paths, not original repo paths (fixed).
- Packet mislabeled the validator excerpt as "Full source" (packet-hygiene defect; acknowledged).

## Coordinator Response → Change (implemented this session)
1. **debate.md** — "mandatory by default: absent an explicit user request…" qualifier added; installed copy synced; routing-guard + parity validators re-pass.
2. **peer-llm-dispatch.md** — agy rule now: "Reference ONLY the staged paths… never the original repo paths (unreadable dangling reference)."

## Coordinator Response → Disagree
- **gemini F1 fix "remove Replacement entirely":** DISAGREE. Evidence: the `instead of Swarm Consensus` override existed before this session and is intended user-invoked behavior; removing it would delete a valid capability. Resolved the underlying imprecision by qualifying "mandatory," not by deleting the exception.
- **codex/gemini "the validator is broken/crashes":** DISAGREE as to the delivered file (verified working + wired). AGREE only that the packet excerpt was mislabeled.

## Coordinator Response → Proposed Fix Handling (Disposition Gate)

| # | Auditor | Proposed fix | Disposition | Rationale / evidence |
|---|---------|--------------|-------------|----------------------|
| 1 | gemini F1 | Remove Replacement exception from debate.md | **disagree** | Replacement is intended pre-existing user override; deleting breaks capability. |
| 2 | gemini F1 (underlying) | Resolve mandatory-vs-Replacement contradiction | **agree-implement** ✓ | Qualified "mandatory by default…"; synced; re-validated PASS. |
| 3 | codex F1 / gemini F2 | Add `pathlib` import + implement validator logic | **disagree (code) / agree-implement (packet)** ✓ | Real file already imports Path + implements + tested + wired; packet excerpt corrected in this report. 2-auditor convergence → Decision Point below. |
| 4 | codex path_to_10 #2 | Evidence run-all invokes validator (hard+precommit) | **agree-implement** ✓ | Confirmed run-all.sh lines 24 (hard) + 46 (precommit). |
| 5 | codex path_to_10 #3 | agy: reference only staged paths, not repo paths | **agree-implement** ✓ | Added to peer-llm-dispatch.md agy rule. |

All proposed fixes dispositioned; no undispositioned items → audit COMPLETE (process-state).

## Audit Outcome
**PASS (post-remediation), with a coordinator packet-hygiene defect acknowledged.**
- Peers returned FAIL on the packet-as-sent, driven by (a) my mislabeled validator excerpt [false positive on real code, verified] and (b) one real debate.md wording imprecision [now fixed].
- After remediation: the delivered artifacts are sound — validator verified correct + wired; debate.md contradiction resolved; agy staging hardened. Both blocking domains resolve against the real artifacts.
- Honesty note: I am NOT claiming the peers passed the packet; they failed it, largely because of my packet defect. The delivered *work* is sound after one substantive fix.

## Decision Points For User
1. **Two-auditor convergence on the "broken validator":** both peers believed the guard was non-functional because the packet showed pseudocode. The real file is verified working and wired. Nothing to fix in code — but it shows the value of shipping real source (not excerpts) to auditors. **No action needed unless you want me to re-dispatch the corrected packet for a clean cross-auditor PASS.**
2. **Path-to-10 residual (advisory):** add a one-line direct Solution-Slate pointer in debate.md so `/debate` doesn't rely solely on delegation to consensus.md (internal-verifier advisory). Optional hardening.
3. **agy model-identity trap discovered:** `--print` must come AFTER `--model`, else agy swallows `--model` as the prompt and silently falls back to Claude Sonnet 4.6. Worth codifying in the agy dispatch rules / memory.

## Degraded Coverage
None — both planned external auditors (codex, gemini) + internal verifier all returned valid structured results.
