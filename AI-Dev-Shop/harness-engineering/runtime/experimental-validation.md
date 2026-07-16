# Experimental Validation — Disclosure Mandate

**Enforcement level:** disclosure (recognize + offer). Not an execution mandate.

## Trigger

When an agent identifies **2 or more testable behavioral configurations** where:
- the decision is **material** (architectural, policy, enforcement mechanism, or system-level behavior)
- the alternatives produce **measurable output differences** (scorable by a judge)
- a bounded experiment is **feasible** (N configs × M prompts × K judges, completable in one session)

the agent MUST include the following section header in its response:

### Empirical Validation Available

The agent MUST then invoke `skills/experimental-validation/SKILL.md` for payload structure beneath that header.

## Skip-Reason Accountability

When recommending among testable options WITHOUT offering validation, the agent MUST include this exact grep-able skip format:

```markdown
> (skip: [reason — brief justification])
```

Use concrete reasons such as "trivial difference", "not bounded", or "user already decided".

## Negative Constraint

NEVER offer validation for: stylistic choices, naming conventions, single-file refactors, standard CRUD, or decisions the user has already explicitly made.

## Reference

Mechanism and guardrails: `skills/experimental-validation/SKILL.md`
