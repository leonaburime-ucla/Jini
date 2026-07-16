# Seed Ledger — Eval 3: Payment Gateway Adapter

Rewritten against the current Python fixture on `2026-04-29`.
Seed IDs are retained for suite backfill compatibility.

ID: SEED-3A
Category: Security/privacy
Seeded issue: The adapter logs and returns the raw provider error message. If the SDK echoes a card token, PAN fragment, or other sensitive payload in its error string, the adapter forwards that secret directly into logs and caller-visible results.
Expected owner: Programmer
Expected severity: Critical
Expected signal: Sanitize provider error text before logging or returning it.
Evidence path: `src/adapter.py` — `safe_message()`, `charge_card()`, `refund()`, `get_transaction()`
False positive risk: Low

ID: SEED-3B
Category: Typed/stable result
Seeded issue: The outbound result union is typed, but the public request boundary is still plain `dict` input plus `dict` options with `Any` logger types. The adapter contract is cleaner internally than it is at the edge.
Expected owner: Programmer
Expected severity: Required
Expected signal: Add typed request/option contracts for the three public adapter methods.
Evidence path: `src/adapter.py` — `PaymentAdapterOptions`, `charge_card()`, `refund()`, `get_transaction()`
False positive risk: Low

ID: SEED-3C
Category: Resource bounds
Seeded issue: Timeout overrides are accepted without validation. A caller can pass `timeoutMs=0`, a negative timeout, or a non-sensical value and get immediate or unpredictable failures instead of a clean validation error.
Expected owner: Programmer
Expected severity: Required
Expected signal: Validate timeout overrides at construction and per-call entry points.
Evidence path: `src/adapter.py` — timeout selection in `charge_card()`, `refund()`, `get_transaction()`
False positive risk: Low

ID: SEED-3D
Category: Explicit dependencies
Seeded issue: Duration measurement still depends on direct `time.time()` reads, and the default logger writes to global process stdout/stderr. The adapter is only partially dependency-injected.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Inject the clock used for durations and make the default logger explicitly opt-in.
Evidence path: `src/adapter.py` — `time.time()` and `_DefaultLogger`
False positive risk: Low

ID: SEED-3E
Category: Pure logic vs effects
Seeded issue: `map_error_code()` relies on substring matches against freeform exception messages. Stable error classification is coupled to provider wording instead of a structured adapter-owned mapping boundary.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Separate message redaction from error classification and prefer structured provider signals when available.
Evidence path: `src/adapter.py` — `map_error_code()`
False positive risk: Low

ID: SEED-3F
Category: Handoff/reporting
Seeded issue: The inline quality notes acknowledge heuristic drift in error-code mapping, but there is no retained risk note about raw provider message forwarding or secret-bearing error text. The documented risk surface is incomplete.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Add explicit risk disclosure for provider-message redaction and heuristic code mapping.
Evidence path: `src/adapter.py` — module docstring and `@overallScore` notes
False positive risk: Medium

ID: SEED-3G
Category: Test anti-patterns / missing adversarial coverage
Seeded issue: The tests never simulate provider error messages that contain sensitive data, and they never exercise invalid timeout overrides. The happy-path and typed-error coverage misses the riskiest rewritten boundary cases.
Expected owner: Code Review
Expected severity: Required
Expected signal: Add adversarial tests for secret-bearing provider errors and bad timeout inputs.
Evidence path: `tests/test_adapter.py`
False positive risk: Low

ID: SEED-3H
Category: Error boundary clarity
Seeded issue: Error results expose the raw provider message directly as `message`. That makes the caller-visible API depend on provider phrasing and can leak internals even when logs are later sanitized.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Return stable, adapter-owned external messages while preserving detailed provider text only in safe internal telemetry.
Evidence path: `src/adapter.py` — `safe_message()` and error result returns
False positive risk: Low
