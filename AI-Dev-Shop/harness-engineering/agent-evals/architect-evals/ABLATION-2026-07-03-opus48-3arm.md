# Architect Eval — 3-Arm Skills Ablation (Opus 4.8)

**Date:** 2026-07-03
**Suite / eval:** `architect-evals/benchmark-suite` · `arch-eval-1-billing-ledger-migration` (33 seeds)
**Model (all arms + both graders):** Claude Opus 4.8 (`claude-opus-4-8`)
**Execution mode:** `repo_persona_subagent` (3 isolated subagents, one per arm)
**Run IDs:** `run-bare-opus48`, `run-format-opus48`, `run-full-opus48`
**Note:** run directories (the ADRs) are gitignored per repo convention; this report is
the committed, self-contained evidence. Scores are persisted in the suite's
`run-manifest.tsv` (3 rows) and `run-results.tsv` (99 rows, self-grade canonical, judge
result in `reviewer_notes`).

## Purpose

Isolate how much the Software Architect **skills** actually lift architecture-judgment
quality, separated from the lift provided merely by the structured task **brief**. Three
arms, identical fixture, identical model:

| Arm | Gets the brief? | Loads the skill files? | Measures |
|-----|-----------------|------------------------|----------|
| **bare**   | No (seed-state docs only) | No | raw Opus judgment |
| **format** | Yes (`project-brief.md`: ADR format + embedded rules) | No | + scaffold/brief |
| **full**   | Yes | Yes (`software-architect/skills.md` + base + conditional SKILLs) | + skills |

`format − bare` = value of the structured brief. `full − format` = value of the heavy
skill files *beyond what the brief already summarizes*. Grading the bare arm on substance
(prose counts if it meets a seed's CAUGHT criteria) keeps the comparison fair; the third
arm exists specifically to prevent crediting the skills for lift that is really just
"having a scorecard template."

## Grading

Every arm graded against the hidden 33-seed oracle
(`arch-eval-1-billing-ledger-migration/seed-ledger.md`) twice: by the coordinator
(self, grader of record) and by an independent **blind** Opus 4.8 judge subagent that
received the three ADRs under shuffled neutral labels (adr-X/Y/Z) and did not know which
arm produced which. Scoring: CAUGHT / CORRECT_SKIP = 1.0, PARTIAL = 0.5, MISSED = 0.

## Results

| Arm | Self | Judge |
|-----|------|-------|
| **bare**   | 26.0/33 = **78.8%** | 26.5/33 = **80.3%** |
| **format** | 30.0/33 = **90.9%** | 30.5/33 = **92.4%** |
| **full**   | 31.5/33 = **95.5%** | 31.0/33 = **93.9%** |

Both graders: identical ranking (full > format > bare), no arm hit the 60% gated cap
(all three CAUGHT the two fatal seeds SEED-ARCH-01 and SEED-ARCH-04).

### Deltas

| Comparison | Self | Judge |
|------------|------|-------|
| **format − bare** (brief/scaffold lift) | **+12.1 pts** | **+12.1 pts** |
| **full − format** (skills lift beyond brief) | **+4.5 pts** | **+1.5 pts** |

## Findings

1. **The structured brief is the dominant lever (+12.1 pts, identical for both graders).**
   Forcing the ADR format — Pattern Evaluation table, Quality Attribute Scorecard with
   confidence labels, explicit blocking-rules audit — is what converts strong prose
   judgment into scored, disciplined output. This lift is robust across graders to the
   decimal.

2. **The heavy skill files add a small, grader-sensitive increment (+1.5 to +4.5 pts).**
   The skills' marginal value over the brief is real but modest and concentrated in three
   seeds: conditional-skill discipline (SEED-ARCH-10: explicit "load data-engineering, not
   rag-ai-integration"), customer-cohort rollout (SEED-ARCH-30), and HIPAA
   infrastructure-validation / BAA framing (SEED-ARCH-32). Because the brief already
   front-loads the methodology rules (adaptability-first scope, don't-mark-assumed,
   blocking checks), the skills have less headroom to add.

3. **Raw Opus 4.8 judgment is very high (~79–80% bare).** Even with no brief and no
   skills it independently produced the constitution exception, the exactly-once→
   effectively-once reframing, the connection-pooler blocker, the HIPAA flag, and a
   data-driven migration with reconciliation + single-writer authority. The bare arm did
   **not** score near-zero — it lost points almost entirely on **format-dependent seeds**
   (confidence-label calibration SEED-06, operability-score calibration SEED-16, hot/cold
   tiering SEED-20) and two checklist-shaped items (skills report SEED-10, cohort rollout
   SEED-30). This confirms the confound the 3-arm design was built to expose: without the
   format arm, that +12 would have been mis-attributed to the skills.

4. **Grader agreement is high: 94.9% (5 disagreements / 99 gradings), all one-step
   adjacent** (never CAUGHT-vs-MISSED). Disagreements clustered on genuinely borderline
   "is prose enough to count" seeds: SEED-06 and SEED-10 (judge more generous to the bare
   arm), SEED-32 (judge stricter on the full/bare arms). The judge scored the full arm
   slightly *below* the format arm's self-score, i.e. the two graders bracket the skills
   lift at +1.5 to +4.5 — both agree it is small.

5. **Shared blind spots across all three arms** (both graders): actor-identity propagation
   through migration-introduced boundaries (SEED-ARCH-31, all PARTIAL) and formal
   current-state baseline evaluation (SEED-ARCH-34, all PARTIAL). These are skill-gap
   candidates — the methodology does not reliably induce them even when fully loaded.
   Performance-confidence calibration for an unproven new schema (SEED-ARCH-17) was also
   PARTIAL across all three.

## Implications

- **For the eval:** SEED-ARCH-17, -31, -34 are the discriminating seeds (missed even by
  the full arm) — the suite's real signal lives there. SEED-06 and -16 discriminate
  format-vs-bare but not full-vs-format.
- **For the skills:** the software-architect skill files earn their keep mainly on
  conditional-skill routing discipline and a few checklist behaviors, not on core pattern
  judgment (which Opus 4.8 already has). If token budget were a concern, most of the
  scorecard discipline could be delivered by the brief alone. The gaps at SEED-31/34 are
  candidates for a targeted skill addition, then re-ablate to confirm lift.
- **For methodology:** grading prose on substance worked — the bare arm was scoreable and
  the 3-arm split cleanly separated scaffold lift from skills lift. Reusable pattern.

## Reproduction

- Prep: `python3 harness-engineering/quality/scripts/prepare_eval_run.py <suite> <run-id> --eval arch-eval-1-billing-ledger-migration --force` (bare arm additionally has `project-brief.md` removed from its run dir).
- The bare arm gets a neutral "recommend an architecture" directive with no brief; format gets the brief but is fenced off from all skill/methodology files; full loads `agents/software-architect/skills.md` + base + triggered conditional SKILLs.
- All arms are fenced from the oracle (`seed-ledger`, `seed-catalog`, `controls`, `coverage-matrix`).
- Judge grades blind from shuffled `/tmp/arch-ablation/adr-{X,Y,Z}.md` (X=full, Y=bare, Z=format).
