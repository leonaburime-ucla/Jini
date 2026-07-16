# Project Memory

Use for stable project-specific nuances and conventions.

> **Routing authority:** Before writing any new entry to this file, read `<AI_DEV_SHOP_ROOT>/framework/governance/knowledge-routing.md`. That file determines which memory file is the correct destination for any given content type. Only content classified as a stable convention, gotcha, constraint, or project-wide pattern belongs here.

## Entries

- YYYY-MM-DD: <fact/convention/gotcha>

- 2026-02-23: [CONVENTION] Inline documentation is required on all newly created functions, methods, classes, and modules — including nested functions, local helpers, and callbacks. Every parameter, return type, and thrown error must be documented. Functions with non-obvious behavior must include an explanation of intent. Use the language's idiomatic format: TypeDoc/JSDoc for TypeScript/JavaScript, docstrings for Python, Rustdoc for Rust, Javadoc for Java, XML doc comments for C#, etc. There are no exceptions for "small" or "obvious" functions.
- 2026-02-28: [CONVENTION] If multiple skills conflict on implementation guidance, agents must follow `harness-engineering/skills-inbox/skill-conflict-resolution.md`: report the conflict, present Option A (boundary-safe) and Option B (tactical), ask the user which to apply, and default to Option A if no choice is provided.
- 2026-02-28: [CONVENTION] React/Next.js tasks must follow `framework/operations/react-skill-operations.md` preflight loading and precedence rules, and use the "React strict mode" shortcut when deterministic skill injection is requested.
- 2026-03-03: [TERMINOLOGY] "Big Four" means coverage metrics in this exact order: `% Stmts | % Branch | % Funcs | % Lines`. "Big Five" means Big Four plus `Uncovered Line #s`.
- 2026-03-04: [CONVENTION] External skill discovery and ingestion is centralized under `Skills Librarian`. Only `Skills Librarian` uses `find-skills` and stages candidates in `harness-engineering/skills-inbox/`; all other agents must route capability-gap requests through Coordinator.
- 2026-03-05: [CONVENTION] CodeBase Analyzer, System Design, Architect, and task-writing work must apply `harness-engineering/quality/test-first-design-policy.md`. Upstream design artifacts are not complete unless they identify test boundaries, observable contracts, dependency-injection seams, and the smallest validating vertical slice. Favor designs that isolate I/O at the edges, keep business logic deterministic, and reduce reliance on brittle end-to-end-only testing.
- 2026-03-05: [PATTERN] Default architecture heuristic: for most long-lived products, prefer a modular monolith at the macro level and vertical slices or strong module ownership for feature delivery. Apply hexagonal boundaries inside slices or modules where external I/O isolation, provider swaps, or business-critical logic justify ports and adapters. For Python services, workers, APIs, and domain-heavy backend code, hexagonal is a strong default. For frontend applications, use `skills/feature-slice-design/SKILL.md` rather than generic hexagonal. For trivial CRUD, scripts, or short-lived work, do not force ports-and-adapters ceremony without a concrete complexity driver.
