# Model Routing Policy

Each agent role has different cognitive demands. Routing every agent to the same model tier wastes budget on mechanical tasks and under-serves complex reasoning tasks.

## Routing Table

| Agent | Recommended Tier | Rationale |
|-------|-----------------|-----------|
| Spec Agent | Frontier | Requires nuanced requirement extraction, ambiguity detection, and precise natural language. Mistakes here propagate through the entire pipeline. |
| Red-Team Agent | Frontier | Adversarial reasoning requires strong inference. Weak models miss subtle contradictions and untestable requirements. |
| Software Architect Agent | Frontier | Pattern selection and tradeoff reasoning are complex. ADR quality determines all downstream work. |
| TDD Agent | Frontier or Mid-tier | Encoding spec logic into precise assertions requires careful reasoning. Use frontier for complex domains; mid-tier for CRUD-heavy features. |
| Programmer Agent | Frontier or Mid-tier | Complex implementation → frontier. Routine implementation tasks (boilerplate, standard CRUD) → mid-tier. |
| Code Review Agent | Mid-tier | Pattern matching against known anti-patterns. Well-defined rubric reduces need for frontier reasoning. |
| Security Agent | Frontier | Threat modeling requires lateral thinking. Missing a threat is worse than missing a refactor. |
| Refactor Agent | Mid-tier | Proposal generation against explicit findings. Rubric-driven; frontier not required. |
| TestRunner Agent | Fast | Mechanical: parse test output, cluster failures, report. No reasoning required. |
| Observer Agent | Mid-tier | Pattern detection across logs. Anomaly detection benefits from good summarization but not frontier reasoning. |
| CodeBase Analyzer | Mid-tier | Grep-and-summarize pattern. Frontier is overkill unless the codebase is unusually complex. |
| Coordinator | Fast | Routing decisions are rule-based. Dispatch logic, convergence checks, and state updates are mechanical. |

## Tiers

| Tier | Examples (as of early 2026) | Use When |
|------|-----------------------------|----------|
| Frontier | Claude Opus 4.x, GPT-4o, Gemini Ultra | High-stakes reasoning, spec/architecture/security decisions |
| Mid-tier | Claude Sonnet 4.x, GPT-4o-mini | Pattern matching, code generation, summarization |
| Fast | Claude Haiku 4.x, GPT-3.5-turbo | Mechanical tasks, routing, parsing, output formatting |

## When to Bump Up

Override the default tier when:
- **Spec is unusually complex** (multi-service, ambiguous domain, regulatory requirements) → bump TDD and Programmer to frontier
- **Security-critical code** (auth, payments, PII handling) → bump Code Review to frontier
- **First run on an unfamiliar codebase** → bump CodeBase Analyzer to mid-tier or frontier
- **Repeated failures on the same cluster** → bump Programmer to frontier; the current tier may be missing something

## When to Drop Down

Drop to a lower tier when:
- **Standard CRUD feature** with well-defined spec → Programmer can use mid-tier
- **Mechanical test suite** (simple validation, standard CRUD tests) → TDD can use mid-tier
- **Small codebase** (<5k LOC, well-structured) → CodeBase Analyzer can use fast

## Coordinator Dispatch Instructions

When dispatching an agent, include the recommended model tier in the dispatch context:

```
Model tier: [Frontier | Mid-tier | Fast]
Rationale: [one sentence — e.g., "Security-critical auth flow; use frontier"]
```

If the user's environment does not support tier selection (single-model deployments), ignore this field. The routing table is a recommendation, not a requirement.
