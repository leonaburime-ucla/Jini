# Eval Design Playbook

Lessons learned from building and iterating the CR eval suite (2026-05-29).
Load this file alongside `bug-taxonomy.md` when creating or revising evals
for any agent.

---

## Core Principle

**Ambiguous to the agent, precise to the evaluator.**

The fixture should feel like a real codebase. The seed-ledger (hidden from
the agent) is where scoring precision lives.

---

## Brief Design

1. **Never name the invariant.** Don't say "must be idempotent before side
   effects." Say "workers restart on deploy, gateway delivers at-least-once."
   Let the agent infer what needs to be safe.

2. **Use operational language.** Describe what the system does, who calls it,
   what happens on failure, what SLAs exist. Don't describe what properties
   it must have.

3. **Include red-herring requirements.** 1-2 requirements that sound important
   but are already satisfied in the fixture. Creates false-positive pressure.

4. **Allow one deliberately vague requirement.** Where "this needs
   clarification" is a valid finding (tests whether the agent asserts a bug
   vs admits uncertainty).

5. **Describe scale and deployment context.** "800 orders/minute across 3
   pods with rolling deploys 2-3x daily" lets the agent infer concurrency
   and crash-recovery risks without naming them.

---

## Fixture Design

1. **500-700 lines for current suite. 1500-5000 for Tier 2/3.**
   Old evals were 200 lines. That's too dense. Real code has noise.

2. **Bug density: 1 per 100-170 lines.** Not 1 per 25.

3. **Zero comments near bugs.** No `# BUG:`, no `# Step 3:`, no
   `# Persist for duplicate detection`, no explanatory comments about
   what the code is *supposed* to do. The absence of the correct behavior
   IS the bug — don't narrate what's missing.

4. **Minimal comments everywhere.** Short factual docstrings only. Large
   didactic section headers and step-by-step narration make the code feel
   eval-authored, not production-authored.

5. **Bugs are omissions, not obviously broken code.** The code should look
   like a competent engineer wrote it with a subtle gap — not like someone
   intentionally wrote a wrong line.

6. **Include 150-300 lines of correct distractor code.** Retry executors,
   metrics classes, validation helpers, adapters — code that looks complex
   and demands attention but has no defect.

7. **The code must compile and run.** Always verify with `python3 -c "import
   module"` before shipping. A syntax error derails the entire eval.

---

## Negative Control Design

1. **No labels.** Never write `# DISTRACTOR`, `# this is correct`, or
   defensive docstrings like "Auth-gated separately."

2. **Adjacent to real bugs.** Put the NC in the same class, same file section,
   or same conceptual pattern as a real bug. The agent must distinguish them.

3. **Share structure with the bug.** If the bug is an unsafe traversal
   (`_walk_delegations`), the NC should be a safe traversal helper
   (`bounded_role_walk`) that looks similar but has the guards.

4. **Every hard fixture needs at least one NC in the same conceptual
   neighborhood as a real bug.**

5. **Correct-but-unusual is ideal.** The NC should make the reviewer hesitate
   and think "is this right?" before concluding it's fine. If it's obviously
   correct, it's too easy.

---

## Scoring Design

1. **Use severity in scoring.** Each seed has an expected severity. Getting
   the severity wrong is partial credit, not full credit.

2. **Score categories:**
   - CAUGHT (correct severity) = full credit
   - CAUGHT_WRONG_SEVERITY = 75% credit
   - PARTIAL (related concern, wrong causal chain) = 50%
   - MISSED = 0%
   - FALSE_POSITIVE = negative (equivalent to missing a Major)

3. **Target 70-85% for a strong model.** If a frontier model scores 100%,
   the eval is too easy. If it scores <50%, the eval may have unsolvable
   seeds or broken fixtures.

---

## Seed Selection

1. **Draw from `bug-taxonomy.md`.** Use the stable IDs for traceability.

2. **Vary categories within each eval.** Don't put 4 cache bugs in one
   fixture. Mix concurrency, state, security, data integrity.

3. **No repetitive filler across evals.** "Metrics missing dimensions" and
   "tests don't cover X" must not appear in every eval. Max 2 instances
   of any pattern across the full suite.

4. **Include at least one T3/T4 seed per eval.** Something that requires
   understanding lifecycle, rollout, or distributed behavior — not just
   reading one function.

5. **Difficulty distribution per eval:** 20% T1, 40% T2, 30% T3, 10% T4.

---

## Process

0. **BLOCKING: Read the agent's skills.md first.** Before designing any
   eval for an agent, read `agents/<name>/skills.md` in full. Map the
   agent's workflow steps, required outputs, decision types, and
   conditional skills. Design seeds that test THOSE specific behaviors —
   not generic domain knowledge. A "software architect" eval that tests
   system design ability instead of scorecard judgment is a wasted eval.
   Also identify gaps: what SHOULD this agent do that its skills don't
   cover? Evals surface skill gaps, then skills close them.

1. **Write one eval first as a canary.** Don't write all 9 in parallel
   before validating the shape. Write one, run a test agent against it,
   score, iterate on the design, THEN replicate.

2. **Run the test agent before auditing.** The agent test reveals whether
   bugs are findable without signposts. Auditing design quality without
   a test run is guesswork.

3. **Audit with multiple models.** Use at least 2 different model families
   to audit eval design quality. Each model catches different leakage
   patterns. (Codex caught answer-key comments Claude missed.)

4. **Verify the fixture compiles.** Always `python3 -c "import module"`
   after writing. Both Gemini 2.5 and 3.1 hallucinated syntax errors that
   didn't exist — but real syntax errors would be worse.

5. **Never hardcode the model flag** when the CLI already defaults to the
   latest. Check `--debug` routing first.

6. **Pipe only relevant files to auditors.** System reminders and path
   content in piped input cause hallucinated findings about non-existent
   decorators and syntax errors.

---

## Cross-Model Testing

1. **Run the same eval against 3+ model families.** Claude, Gemini, GPT.
   Each misses different categories.

2. **Track per-category miss rates across models.** If ALL models miss
   outbox-pattern bugs, that's a skill gap to address. If only one model
   misses tenant isolation, that's model-specific.

3. **Build skills targeting systematic misses.** When a category has <50%
   catch rate across all models, create a skill or guard that addresses it.

4. **Re-run after skill changes.** The eval exists to measure improvement.
   Run the same seeds after adding skills to verify the skill actually helps.

---

## Skill Validation Protocol

When eval results reveal systematic misses, the fix is a new skill added
to the agent's `skills.md`.

### Process

1. Run eval WITHOUT the skill → baseline score
2. Add skill to agent's `skills.md` under `## Eval-Driven Skills`
3. Re-run same eval WITH the skill → measure delta
4. Keep if delta is positive, remove if zero or negative

### In the agent's skills.md

Add a section header to separate eval-driven additions from the original
design:

```markdown
## Eval-Driven Skills (Gap Closures)

[skill content here]
```

That's it — just the header as a marker, then the skills. The before/after
evidence lives in the eval `run-results.tsv`, not in the skills file.

---

## Adversarial Difficulty Design (Hard-Mode / Tier 2-3)

When designing fixtures that must resist frontier LLMs, start from the
adversarial perspective: what cognitive strategies does the solver use, and
how does this fixture defeat each one?

### LLM Code Review Strategies to Defeat

| # | Strategy | What it does | How to defeat it |
|---|----------|-------------|-----------------|
| 1 | Missing-validation scan | Finds unused params, unchecked fields, missing guards | Every param IS used; every field IS checked; every guard IS present |
| 2 | Control flow sequencing | Checks operations happen in correct order | The order IS correct for the common case; fails only under a specific failure mode |
| 3 | Semantic mismatch detection | Flags when name/comment says X but code does Y | Names and behavior DO match locally; the mismatch is between protocol semantics and implementation semantics |
| 4 | Cross-reference consistency | Checks callers match callee contracts | Callers DO match; the bug is that the contract itself is subtly wrong for its usage context |
| 5 | Known-bad-pattern recognition | Spots TOCTOU, check-then-act, float-for-money | Code doesn't match ANY known-bad pattern; the issue is in protocol-level composition |

### Bug Variety Distribution (min 3 distinct types per fixture)

Do not repeat one bug pattern (e.g., "missing check") across all seeds. A
well-varied hard fixture requires at least 3 of these reasoning strategies:

**Type A: Correct implementation of subtly broken protocol.**
Code faithfully implements a protocol design that is itself flawed under
a specific distributed failure scenario. Finding the bug requires protocol
simulation, not code inspection.
- Example: quorum reconfiguration that works under stable membership but
  allows split-brain during membership change

**Type B: Emergent composition failure.**
Each component is correct in isolation. The composition produces failure
under specific interleavings because the components' assumptions about
execution context conflict.
- Example: drain counter reaches zero while migration read is between
  fetch and write (migration ops aren't counted as "in-flight")

**Type C: Optimization with hidden precondition violation.**
A fast-path exists that is correct for the common case (and has tests).
The precondition is violated during a rare-but-possible failure scenario
in a way not detectable from local analysis.
- Example: self-lease renewal fast-path skips validation because "I just
  issued this to myself" — but issuer's epoch state is stale after partition

**Type D: Correct patterns compose into semantic regression.**
Three individually-correct mechanisms (state machine + idempotency +
retry) combine to allow state to regress because none captures the
*direction* of protocol progress.
- Example: retry with fresh idempotency key proposes a new valid
  transition from current state instead of the intended transition

**Type E: Linearizable operations with write-skew.**
Each operation is individually linearizable and correctly fenced. But the
fence granularity doesn't match the shared resource granularity, creating
a write-skew window invisible from any single component.
- Example: per-cohort lease fence on region-wide capacity reservation

**Type F: Safety depends on violated liveness assumption.**
A safety mechanism (no split-brain) depends on a liveness property
(heartbeats arrive within timeout) that is violated during exactly the
scenario where safety matters most.
- Example: failure detector assumes fail-stop but the real failure mode
  is network partition; peer reports conflated with actual failures

### Negative Control Design for Hard-Mode

In hard-mode, negative controls must be **the correct defense** against the
class of bug present elsewhere in the fixture:

- If D2 is a composition gap (drain doesn't count migrations), then
  NC-17' should be a *different* re-verification that correctly catches a
  similar composition gap — the reviewer must distinguish the correct
  defense from the missing one.

- If D5 is a write-skew from wrong fence granularity, then NC-18' should
  be a pessimistic capacity hold that looks like over-reservation but is
  actually the correct serialization technique.

The best negative control is one that a reviewer who correctly identifies
a real defect might *also* flag by pattern-matching on the same concept.

### Difficulty Calibration Targets

- **Tier 2/3 target: 30-50% CAUGHT rate for frontier model on first run.**
  If a frontier model scores >70%, the fixture is not hard enough.
- **Each defect should be independently difficult.** Don't rely on fixture
  length to dilute signal — each bug must resist a focused single-bug hunt.
- **Test with "find bugs in this one class" prompts.** If a focused prompt
  finds the bug, it's not structurally hard — only hidden by volume.
- **The brief's weak-spec angle must be load-bearing.** If you can find the
  bug without reading the brief, the brief doesn't matter and the fixture
  doesn't test invariant inference.

---

## Anti-Patterns (Don't Do This)

- Don't write `# BUG:` or `# FIXME:` in eval source code
- Don't label negative controls as "DISTRACTOR" or "this is correct"
- Don't add defensive docstrings explaining why correct code is correct
- Don't put ACs that name the exact invariant to check
- Don't use step-by-step numbered comments in the saga flow
- Don't include `@overallScore` or quality annotations (that's programmer eval)
- Don't make every eval the same shape (vary fixture structure)
- Don't plant bugs only in the "main" class (spread across helpers too)
- Don't test only recall (add precision pressure via NCs and bug-free fixtures)
- Don't ship without running a test agent first
