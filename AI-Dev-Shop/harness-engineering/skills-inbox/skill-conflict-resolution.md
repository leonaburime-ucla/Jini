# Skill Conflict Resolution

- Version: 1.0.0
- Last Updated: 2026-02-28
- Scope: All agents and all skill combinations

Use this policy whenever two or more skills recommend different implementations for the same code path.

## Trigger Conditions

Treat as a conflict when any of these happen:

- One skill says "must" and another says "avoid" for the same decision.
- Architecture boundaries from one skill are bypassed by a tactic from another.
- Security/accessibility/performance guidance points to mutually exclusive choices.
- Runtime/version assumptions differ (for example React 19-only rule on React 18).

## Required Agent Behavior

1. Detect and name the conflicting rules (skill + rule id/title).
2. Explain the tradeoff in one to three sentences.
3. Present exactly two options:
   - Option A: boundary-safe / conservative
   - Option B: tactical / shortcut / optimization-first
4. Ask the user which option to apply before implementing.
5. If user does not choose, default to Option A.
6. Record the user choice in handoff output under `Risks` and `Decision`.

## Standard User Prompt

Use this exact prompt text:

`I found a conflict between skills for this implementation. Do you want Option A (boundary-safe/conservative) or Option B (tactical/optimization-first)?`

## Output Template

Use this format in the agent response when a conflict is found:

```text
Skill Conflict Detected
- Conflict: <skill/rule> vs <skill/rule>
- Why it conflicts: <brief explanation>
- Option A (boundary-safe): <what will be done>
- Option B (tactical): <what will be done>
Question: I found a conflict between skills for this implementation. Do you want Option A (boundary-safe/conservative) or Option B (tactical/optimization-first)?
```

## Priority if User Is Unavailable

If no user response is possible in the current execution path:

1. Security constraints
2. Spec acceptance criteria
3. Architecture boundary rules
4. Accessibility requirements
5. Performance tactics
6. Style/readability preferences

