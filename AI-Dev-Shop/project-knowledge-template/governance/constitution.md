# Project Constitution

- Version: 1.0.0
- Ratified: [fill in when you start your project]
- Last Amended: [fill in when you start your project]

This constitution governs all development on this project. The Spec Agent checks compliance before finalizing any spec. The Architect Agent checks compliance before writing any ADR. Unjustified violations are a blocking escalation — same severity as a spec hash mismatch.

---

## Article I — Library-First

Use existing, well-maintained libraries before writing custom implementations. Every custom implementation that replaces a library must justify why no suitable library exists.

**Complies if:** No custom code duplicates functionality available in a library with active maintenance (commit in last 12 months) and reasonable adoption.

**Exception process:** Document in ADR Complexity Justification table: library name, version evaluated, specific reason it was rejected (license, performance, missing feature, security issue).

---

## Article II — Test-First (NON-NEGOTIABLE)

No implementation code is written before the TDD Agent has certified tests against the approved spec. Tests must fail before the Programmer Agent starts.

**Complies if:** TDD Agent has produced a test certification document with spec hash match before any Programmer dispatch.

**Exception process:** None. This article has no exceptions.

---

## Article III — Simplicity Gate

Reject complexity that does not solve a present, documented problem. Every abstraction must have a concrete use case in the current spec.

**Complies if:** Every module, interface, and pattern introduced is directly traceable to a requirement in the active spec.

**Exception process:** Document in Complexity Justification table: which requirement drives the complexity, what the simpler alternative was, and why it was insufficient.

---

## Article IV — Anti-Abstraction Gate

Do not extract abstractions speculatively. Three concrete, similar implementations must exist before a shared abstraction is justified.

**Complies if:** No shared abstractions are introduced for fewer than three concrete uses.

**Exception process:** Document in Complexity Justification table with evidence of three concrete uses or a strong architectural reason (e.g., defined contract boundary).

---

## Article V — Integration-First Testing

Test at the integration boundary first. Unit tests supplement integration tests; they do not replace them. Do not unit-test implementation details.

**Complies if:** Every acceptance criterion has at least one integration-level test. Unit tests exist only for pure logic with no I/O.

**Exception process:** Document why integration testing is not feasible for specific ACs (e.g., third-party API with no sandbox).

---

## Article VI — Security-by-Default

Security Agent review is required before any merge to main. Critical and High findings block shipping. Medium and Low findings are logged and tracked.

**Complies if:** Security Agent has reviewed the full diff and produced a findings report. No Critical/High findings are unresolved.

**Exception process:** Human sign-off required for any Critical/High finding that ships. Must document: finding, mitigation, accepted risk, and owner.

---

## Article VII — Spec Integrity

Specs are ground truth. Code that contradicts the spec is wrong. Specs that contradict intent are revised through the Spec Agent — not patched ad-hoc by the Programmer.

**Complies if:** Every agent output references the active spec version and hash. No agent modifies behavior outside its spec scope.

**Exception process:** If a spec is discovered to be wrong mid-implementation, stop. Route to Spec Agent for revision. Do not work around a wrong spec.

---

## Article VIII — Observability

All production code paths emit structured, queryable signals. No silent failures. Errors are logged with enough context to reproduce without a debugger.

**Complies if:** All error paths produce a structured log entry. All external I/O (API calls, DB writes, file operations) is instrumented.

**Exception process:** Document in ADR or Code Review finding why a path cannot be instrumented (e.g., third-party SDK limitation).

---

## Governance

- This constitution supersedes all other project practices.
- Amendments require: written rationale, human approval, and a migration plan for in-flight work.
- All ADRs must include a Constitution Check section before the architecture body.
- Unjustified violations are a blocking escalation — the Coordinator treats them the same as a spec hash mismatch.

## Amendment Log

| Version | Date | Article | Change | Rationale |
|---------|------|---------|--------|-----------|
| 1.0.0 | — | All | Initial ratification | Default constitution for new projects |
