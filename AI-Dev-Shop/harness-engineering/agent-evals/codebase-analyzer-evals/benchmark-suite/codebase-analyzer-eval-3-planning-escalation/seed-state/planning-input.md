# Planning Input

Current state candidates:

- Billing route mixes HTTP and business logic.
- Payments module has zero tests and is marked revenue critical.
- The codebase is a simple CRUD monolith with a degraded layered structure, not a distributed platform.
- A migration plan must include a Coverage Caveat because the analysis is sampled.
- Any structural work on payments must start with characterization tests before seam extraction.
- In the negative-control variant, all critical modules have existing characterization tests and no TESTABILITY plan trigger is present.
