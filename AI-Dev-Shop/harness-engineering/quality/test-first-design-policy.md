# Test-First Design Policy

Use this policy when doing codebase analysis, system blueprinting, architecture planning, and task breakdown. The goal is not "more tests"; the goal is code that is naturally easy to test because boundaries, responsibilities, and side effects are explicit.

## Core Rule

Every design-stage artifact must answer: "How will we prove this works before implementation details exist?"

If an artifact cannot name the test boundary, the observable behavior, and the injected dependencies, the design is not ready.

## Design Heuristics

- Push business rules into deterministic functions or use-cases with typed inputs and outputs.
- Keep I/O at the edges: database, network, filesystem, time, randomness, framework lifecycle, and environment access must sit behind explicit boundaries.
- Prefer composition over inheritance-heavy designs; test seams should be obvious from constructor/function arguments.
- Use interfaces only at real boundaries or where tests need substitution. Do not create speculative abstractions.
- Model modules around behaviors the test suite can assert, not around framework folders alone.
- Favor narrow modules with one reason to change. If one test needs extensive fixture setup or many mocks, the module boundary is probably wrong.

## Agent Expectations

### CodeBase Analyzer

Must report:
- where domain logic is mixed with I/O or framework code,
- where hidden dependencies exist (globals, singletons, env reads, direct time/random/network use),
- where tests are forced to mock internals instead of external boundaries,
- candidate extraction points for pure logic, adapters, orchestrators, and integration seams,
- highest-risk testability anti-patterns before new feature work starts.

Analyzer output should include a short "Testability Map" section with:
- stable integration boundaries,
- pure logic candidates,
- flaky or over-coupled areas,
- recommended refactor-before-feature hotspots.

### System Design

Must produce a system shape that is testable at multiple levels:
- acceptance/integration tests map to user-visible workflows and slice boundaries,
- module boundaries expose observable inputs/outputs,
- external systems sit behind adapters or ports,
- shared infrastructure does not leak into domain logic,
- proposed decomposition reduces the need for brittle end-to-end-only coverage.

Blueprint output should include a "Testability Strategy" section with:
- primary test layers per subsystem,
- boundary ownership,
- dependency-injection seams,
- cross-module contract test candidates,
- areas where a vertical slice should be built first to validate the architecture.

### Architect

Must reject architectures that are only theoretically clean but operationally hard to test.

ADR evaluation must explicitly cover:
- what gets tested at integration level first,
- what pure logic deserves unit coverage,
- what dependencies are injected and why,
- what observable contracts exist between modules,
- what anti-patterns are being avoided,
- what failure modes the design makes easy to simulate.

ADR output should include a "Testability Check" section with:
- boundary diagram in words,
- test pyramid or test-mix rationale for this feature,
- required adapters/fakes/fixtures,
- one vertical slice that proves the architecture before broad implementation.

## Task Writing Rule

Tasks should be written so the programmer can implement behavior in small, testable increments.

Good task shape:
- define one behavior,
- name the test layer first,
- identify the module or boundary to change,
- keep adapter work separate from domain-logic work when possible.

Bad task shape:
- "build entire feature end-to-end",
- "wire UI, API, DB, and validation in one task",
- "refactor for cleanliness" without a failing test or explicit anti-pattern.

## Review Questions

Use these before approving analysis, blueprint, ADR, or tasks:

1. Can the main behavior be verified without booting the whole stack?
2. Are side effects isolated behind explicit interfaces or adapters?
3. Would tests assert outputs and contracts rather than internal calls?
4. Does any module require excessive mocks, fixtures, or shared state?
5. Is there a clear first vertical slice that validates the design?
6. Are we introducing abstractions because tests need them now, or because they feel architecturally nice?

## Escalation Triggers

Escalate before implementation if any of these are true:
- core logic depends directly on framework/runtime primitives,
- the design requires mocking internals across multiple layers,
- the only credible verification route is slow end-to-end coverage,
- module boundaries are unclear enough that tests cannot be assigned confidently,
- tasks combine multiple responsibilities that will fail together.
