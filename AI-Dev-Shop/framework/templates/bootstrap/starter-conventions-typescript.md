# Starter Conventions: TypeScript Projects

When starting a TypeScript project with this toolkit, copy the entries below into `<ADS_MEMORY_ROOT>/knowledge/project_memory.md`. They capture TypeScript-specific conventions that the Programmer Agent and Code Review Agent should enforce across the codebase.

---

## Entries to copy into project_memory.md

```
- YYYY-MM-DD: [CONVENTION] Object parameter ordering: required fields must come first, optional fields must come second. This applies to all TypeScript interfaces, type aliases, and function parameter destructuring patterns throughout the codebase. Required fields are those without a `?` modifier or a default value. Optional fields are those with a `?` modifier or a default value. Mixing required and optional fields arbitrarily is a code review deficiency.

- YYYY-MM-DD: [CONVENTION] TypeScript function signatures use a two-object paradigm. First argument: required key-value pairs `{ param1, param2 }: { param1: Type1; param2: Type2 }`. Second argument: optional key-value pairs with defaults `{ opt1 = default, opt2 }: { opt1?: Type3; opt2?: Type4 } = {}`. Rationale: adding or renaming optional parameters never requires touching callsites.

- YYYY-MM-DD: [CONVENTION] Page orchestrator prop defaults to the concrete orchestrator used internally. When a page component accepts an orchestrator as a prop (for testability or dependency injection), the prop must be typed as the interface or abstract type, and the default value must be the concrete orchestrator instance used in production. Pattern: `{ orchestrator = concreteOrchestratorInstance }: { orchestrator?: OrchestratorInterface } = {}`. This enables tests to inject a mock while production pages require no explicit prop.

- YYYY-MM-DD: [CONVENTION] No `any` types. All types must be specific. If a value's type is genuinely unknown, use `unknown` and narrow it explicitly before use. `any` is a code review deficiency.
```

---

## Notes

- Replace `YYYY-MM-DD` with the date you start the project.
- These conventions are enforced by the Programmer Agent (self-check before handoff) and the Code Review Agent (Required finding if violated).
- For similar starter conventions in other languages, see `project-knowledge-template/` for any `starter-conventions-<language>.md` files.
