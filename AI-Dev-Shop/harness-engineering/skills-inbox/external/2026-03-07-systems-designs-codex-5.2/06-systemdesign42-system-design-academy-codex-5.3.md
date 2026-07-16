# Distilled Learnings: systemdesign42 / system-design-academy (codex-5.2, deep pass)

Source repo: https://github.com/systemdesign42/system-design-academy

## 1) What This Source Adds
- Massive index-style curriculum across:
  - company case studies
  - technology fundamentals
  - interview resources
  - white papers
- Especially useful for comparative learning: the same pattern seen across different company contexts.

## 2) Distilled Learnings

### 2.1 Architecture literacy improves through comparison, not isolation
- Company case studies reveal how similar problems diverge by scale and constraints.
- Technology fundamentals anchor why those divergences are rational.

Skill gate:
- Require one baseline design and one “at-scale variant” comparison.

### 2.2 Whitepapers should be used as constraints, not cargo-cult blueprints
- Whitepapers often optimize for specific workload assumptions.
- Reusing conclusions without matching assumptions produces bad architecture.

Skill gate:
- If citing whitepaper guidance, include assumption alignment check.

### 2.3 Interview and production thinking should share one method
- The same disciplined decomposition works for both:
  - scope -> estimate -> architecture -> risks -> tradeoffs.

Skill gate:
- Use one output schema for interview and production design responses.

## 3) Concrete Reuse Pattern
- Step A: select representative company case.
- Step B: extract one key architecture move.
- Step C: translate into decision rule with trigger conditions.
- Step D: document when not to apply the move.

Example:
- Case move: aggressive caching.
- Rule: apply for read-heavy hot-key workloads.
- Do not apply blindly when correctness/freshness tolerance is low.

## 4) Anti-Patterns and Fixes
- Anti-pattern: catalog reading without synthesis.
  - Fix: force “pattern -> trigger -> caveat” extraction.
- Anti-pattern: direct copy of named-company architecture.
  - Fix: require constraint-delta analysis versus your workload.
- Anti-pattern: whitepaper citation without operational cost model.
  - Fix: require complexity and ownership impact notes.

## 5) Decision Matrix (Skill-Ready)

| Source Type | Best Use | Must Add |
|---|---|---|
| Company case study | pattern inspiration | scale/context deltas |
| Technology fundamentals | mechanism understanding | workload-fit criteria |
| Whitepaper | deep constraint reasoning | implementation complexity/risk |
| Interview note | communication structure | production caveats |

## 6) Drop-In Skill Contract Additions
```md
## Comparative Reasoning
- Baseline design
- At-scale variant
- Source-derived pattern used
- Why it applies here
- Why one obvious alternative was rejected
```

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/systemdesign42/system-design-academy
- Primary source file: https://raw.githubusercontent.com/systemdesign42/system-design-academy/main/README.md
