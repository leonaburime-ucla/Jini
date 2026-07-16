# Testability Anti-Patterns

Use this catalog when writing, rewriting, or reviewing code.

## Required Human Reporting Rule

If any anti-pattern below is found during implementation/refactor/review:

1. Log it in the current handoff summary.
2. Tell the human explicitly:
   - what anti-pattern was found,
   - where it appears,
   - why it hurts testability,
   - the recommended remediation route.

Do not silently proceed on repeat anti-patterns.

## Catalog

| Anti-Pattern | Why It Hurts Testing | Typical Remediation |
|---|---|---|
| Hidden global state and implicit singletons | Causes order-dependent and flaky tests | Inject dependencies; isolate state per test |
| Mixed concerns in one unit (I/O + domain logic + formatting) | Hard to unit-test behavior in isolation | Extract pure logic; isolate side-effect boundaries |
| Time/random/network directly called in core logic | Nondeterministic outputs | Use clock/RNG/network adapters and mocks at boundaries |
| Over-mocking implementation internals | Brittle tests tied to structure, not behavior | Assert observable outcomes; mock only external boundaries |
| Long methods with many branches and flags | Poor branch coverage and hard failure diagnosis | Split into small composable functions with explicit inputs |
| Feature logic embedded in framework lifecycle hooks only | Difficult targeted testing without full stack boot | Move logic into testable services/use-cases |
| Hard-coded environment paths/IDs/toggles | Tests fail across environments | Centralize config; pass via typed config objects |
| Shared mutable fixtures across tests | Test pollution and sequence coupling | Create fresh fixtures per test; remove shared mutability |
| Async fire-and-forget without observability hooks | Races and unassertable side effects | Return awaitable handles/events; expose completion signals |
| Dead defensive code paths without spec mapping | Coverage noise, unclear ownership | Remove or route to spec/refactor decision |

## Surface Template

Use this in handoffs/review notes:

```text
Testability Anti-Pattern Found
- Pattern: <name>
- Location: <file:line>
- Impact: <how this degrades test reliability/coverage>
- Recommended Route: <TDD | Refactor | Spec clarification>
```
