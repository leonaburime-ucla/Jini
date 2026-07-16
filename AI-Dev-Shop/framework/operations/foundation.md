# Foundation Philosophy

Source reading that explains why this pipeline is structured the way it is. Agents should load this when they need context on the reasoning behind design decisions.

---

## Article 1: Meta-Coding — A New Paradigm for Building Software with AI

- Link: https://medium.com/@leonaburime/meta-coding-a-new-paradigm-for-building-software-with-ai-eb2dbc72ce10
- Archive: https://archive.ph/in2r5

A discipline for AI-assisted software delivery built on specs, tests, and architecture rather than ad hoc prompting. Introduces ASTRA: **(A)I + (S)pecs + (T)DD + (R)eference (A)rchitecture**.

The core shift: you are no longer prompting, you are **directing**. Blueprints (specs) define what to build. The Foreman (architectural pattern) defines how. The AI executes within those constraints.

Key practices:
- **Specs as ground truth**: Every requirement is precise, versioned, and testable. Vague specs produce confident wrong output. A spec with a SHA-256 hash pins what every downstream agent was working against.
- **TDD before implementation**: Tests encode the spec before any code exists. If you cannot write a test for a requirement, the requirement is not well-defined. Tests also serve as the convergence signal — when they pass, the implementation satisfies the spec.
- **Pattern Priming**: Before scaling implementation, validate the architecture by building one complete vertical slice end-to-end. This catches architectural mismatches early, when they are cheap to fix.
- **Reference Architecture**: The architectural pattern (Clean Architecture, Hexagonal, CQRS, etc.) is selected deliberately based on system drivers — not defaulted to. The pattern defines boundaries every agent must respect.

Why it matters for this pipeline: specs are ground truth, tests are the convergence signal, and the architecture is a hard constraint — not a suggestion.

---

## Article 2: Meta-Coding with Multi-Agent AI Systems

- Link: https://medium.com/@leonaburime/meta-coding-with-multi-agent-ai-systems-c8ac0c06c12d
- Archive: https://archive.ph/uLuMM

Extends Meta-Coding into multi-agent orchestration with role specialization, coordinator routing, and convergence controls.

Key concepts:
- **skills.md as versioned SOP**: Each agent's operating procedure is a file, not a prompt you retype each session. It defines role, required inputs, workflow, output format, quality checklist, failure modes, and escalation rules. When an agent repeatedly makes the same mistake, a human updates the skills.md — the fix propagates permanently to all future dispatches of that agent.
- **Coordinator owns all routing (pipeline default)**: In Pipeline Mode, agents do not talk to each other directly. The Coordinator receives outputs, validates handoff contracts, and dispatches the next agent with the right context. In Agent Direct Mode, a named agent can request clarification context from another non-Coordinator agent, but handoffs still return through the human/Coordinator boundary rather than hidden side channels. This preserves an auditable routing path and limits context pollution.
- **Project knowledge files**: `project_memory.md` (conventions, gotchas), `learnings.md` (failure log), `project_notes.md` (open questions). No individual skills.md covers project-specific knowledge — these files do.
- **Spec hash traceability**: Every spec has a content hash. Every test certifies which spec version and hash it was written against. CI flags drift when hashes diverge. This is the mechanism that prevents "tests passing against a spec that no longer exists."
- **Convergence threshold**: progression to code review requires every Coordinator-selected, certification-bearing test to pass or be explicitly quarantined through the known-flaky-test registry. Coverage gaps and non-quarantined failures do not advance on percentage thresholds; they route back through Coordinator for TDD recertification, implementation repair, spec revision, waiver review, or human checkpoint. Iteration budget (5 total retries; escalate any cluster at 3) prevents infinite loops. Stubborn failures signal spec/architecture problems — escalate, don't retry.
- **Human checkpoints**: Spec approval, architecture sign-off, convergence escalation, final security sign-off. These are blocking. The pipeline stops and waits.

Why it matters: this is the operational model this entire folder implements. Every design decision in AGENTS.md, skills/, and framework/workflows/ traces back to these principles.

---

## Article 3: Software Architecture Patterns Explained

- Link: https://medium.com/@leonaburime/software-architecture-patterns-explained-a-practical-guide-for-building-modern-applications-30d965c7249c
- Archive: https://archive.ph/foxdD

A practical pattern-selection guide covering DDD vocabulary and the major architecture patterns used in this pipeline's pattern library.

DDD vocabulary used throughout this system:
- **Bounded context**: The explicit boundary within which a domain model is defined and applicable
- **Entity**: An object with a unique identity that persists across state changes
- **Value object**: An immutable object defined entirely by its attributes, no identity
- **Aggregate**: A cluster of entities/value objects treated as a single unit for data changes; the root enforces invariants
- **Domain event**: A record of something significant that happened in the domain (past tense, immutable)
- **Repository**: Abstraction over data access; decouples domain from persistence
- **Port**: Interface the application exposes (inbound) or requires (outbound)
- **Adapter**: Concrete implementation of a port; swappable without touching the core

Pattern selection principle: **match pattern to problem, depend on interfaces not implementations, start simple and extract only when the problem demands it**.

- **Clean/Hexagonal/Onion**: Dependencies point inward, core has no external dependencies, swap anything behind an interface. Choose when domain logic is complex and must be independently testable.
- **Vertical Slice**: Organize by feature, not layer. Each slice owns its full stack. Choose for feature teams and parallel delivery.
- **CQRS**: Separate read and write models for asymmetric workloads. Choose when read patterns differ significantly from write patterns.
- **Event Sourcing**: Store events not state, derive current state by replay. Full audit trail, time-travel queries. Choose when audit is a hard requirement.
- **Modular Monolith**: Start here. Single deployment with strict module boundaries. Extract to microservices only when you have a specific problem a monolith cannot solve.
- **Event-Driven/Pub-Sub**: Loose coupling through events, multiple subscribers react independently. Default to async for inter-service side effects.
- **Microservices**: Independent deployable services per capability. Use after product-market fit when you have a specific scaling or team-independence problem.

Why it matters: the Software Architect Agent's pattern library (`<AI_DEV_SHOP_ROOT>/skills/design-patterns/references/`) is built from these patterns. The examples throughout the pattern files are illustrative — adapt them to your project's language and conventions.
