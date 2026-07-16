# Templates

This directory contains the foundational document templates used by the AI Dev Shop multi-agent pipeline. Agents use these templates to structure their output, ensuring consistency, enforceability, and smooth handoffs between pipeline stages.

Provider note:
- the active upstream planning provider is resolved from `framework/spec-providers/active-provider.md`
- provider-owned planning templates live under `framework/spec-providers/<provider>/`
- do not assume any file in this directory is the planning surface for the active run unless the provider contract says so

## Subdirectories

- **`bootstrap/`**: Contains initialization templates intended to be copied into a new project's workspace (e.g., the base constitution template) rather than used directly in the pipeline.
- **`self-validation/`**: Stack-specific runtime validation templates for downstream repos that need app boot, log inspection, and critical-path checks before handoff.

## Active Templates

- **`adr-template.md`**: Used by the Software Architect Agent to record Architecture Decision Records (ADRs). Includes forced sections for constitution compliance and complexity justification.
- **`context-offload-template.md`**: Used when large logs, traces, or raw outputs should be saved to a durable file instead of staying inline in chat or handoffs.
- **`evaluator-contract-template.md`**: Used when a long-running build needs an explicit generator/evaluator contract before coding starts.
- **`evaluator-report-template.md`**: Used when a retained evaluator run should record scope check, findings, blocking outcome, and next action for the generator.
- **`handoff-template.md`**: The mandatory contract format used by every agent at the end of their execution. It ensures the next agent in the pipeline receives the correct input hashes, context, and risk warnings.
- **`implementation-outline-template.md`**: Used by the Software Architect for the conditional post-ADR, pre-tasks implementation outline or explicit SKIP record. Includes module maps, public/exported contract maps, wiring, data boundaries, and critical invariants.
- **`known-flaky-tests-template.md`**: Used by the Coordinator to initialize the human-approved flaky-test exclusion registry when the first flaky test is detected.
- **`load-bearing-harness-audit-template.md`**: Used for retained maintenance audits that test whether older harness components are still needed on current models and hosts.
- **`red-team-template.md`**: Used by the Red-Team Agent to output vulnerability, ambiguity, and logic-flaw findings against a proposed spec.
- **`research-template.md`**: Used by the Software Architect Agent when evaluating multiple potential solutions or external libraries before committing to an ADR.
- **`system-blueprint-template.md`**: Used by the System Design Agent during macro-level planning to map out component domains before detailed feature specs are written.
- **`tasks-template.md`**: Used by the Coordinator to break down an approved ADR and spec into parallelizable implementation tasks for the TDD and Programmer agents.
- **`tdd-coverage-triage-template.md`**: Used during the test gap-fill loop to categorize missing coverage and assign priority to unhandled edge cases.
- **`test-certification-template.md`**: Used by the TDD Agent to prove that tests have been written against the active spec hash, certifying readiness for the Programmer Agent to begin implementation.
- **`verification-packet-template.md`**: Used by the Coordinator to summarize accepted TestRunner/certification evidence before Code Review receives it.
- **`self-validation/*.md`**: Used for downstream runtime smoke-validation loops by stack (generic web app, Node API, Python service, Supabase).
