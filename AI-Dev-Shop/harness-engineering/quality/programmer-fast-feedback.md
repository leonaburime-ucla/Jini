# Programmer Ambient Fast-Feedback Testing Policy

Defines how the Programmer agent gets immediate test breakage signals during implementation without turning TestRunner into a continuous process.

## Actor Responsibilities

| Actor | Responsibility |
|-------|---------------|
| **Programmer** | Runs fast local watcher during active implementation. Consumes signal-only summaries. Reacts to stable failures. |
| **TestRunner** | Formal certification gate. Full suite execution, coverage profiles, spec-hash validation. Dispatched by Coordinator at stage boundaries. |

These are separate concerns. The Programmer's watcher is a development aid. TestRunner is a pipeline gate. They do not overlap.

## Watcher Scope

The Programmer runs a fast local watcher covering:

- **Always:** Unit tests for changed files and their direct dependents
- **Optional:** Small integration subset scoped to the changed module boundary
- **Never:** Full E2E suite, performance tests, or external-service integration tests

### What Counts as "Unit" vs "Integration Subset"

- **Unit:** Tests that run in-process with no external I/O (mocked or stubbed dependencies)
- **Integration subset:** Tests that exercise one module boundary (e.g., API route → service → in-memory DB) but do not cross network boundaries or require external services

The boundary is defined by the project's existing test organization. If the project does not separate unit from integration, the watcher runs only tests in files whose names match changed source files.

## Signal-Only Reporting

Raw watcher output (full stdout/stderr, stack traces, log noise) must NOT stream into the agent context.

The watcher produces a compact signal payload only:

```
WATCHER_SIGNAL:
  status: GREEN | RED
  timestamp: <ISO-8601>
  failing_tests:
    - test_id: <test file:test name>
      error: <first 120 characters of error message>
      frame: <first relevant stack frame — file:line only>
  total_run: <count>
  total_failed: <count>
  scope: <changed files that triggered this run>
```

### Payload Limits

- Max `failing_tests` entries per signal: **5** (if more fail, report count and first 5)
- Max `error` length: **120 characters** (truncate with `...`)
- Max `frame` length: **80 characters**
- Max total signal payload: **40 lines**

Signals exceeding these limits are truncated, never expanded.

## Alert Criteria

The watcher does NOT alert on every test run. It alerts only on **stable failures**:

### Debounce

- Minimum quiet period after file save before running: **10 seconds**
- A failure is "stable" only after **2 consecutive failing runs** with the same failing test set

### Alert Budget

- Maximum alerts per 15-minute interval: **3**
- If the budget is exhausted, suppress further alerts until the interval resets
- Budget resets on GREEN signal (all tests passing)

### Changed-File Scope Filtering

- Only run tests related to files changed since the last GREEN signal
- Do not re-run the full watcher scope on every save — scope to the delta
- After dependency/branch changes (e.g., `git checkout`, `npm install`), reset scope to full watcher scope for one run

## Alert Suppression (Recovery State)

After the first stable-failure alert for a specific test:

1. **Suppress** repeat alerts for that same test until it returns GREEN
2. **Alert again** only on a new GREEN→RED regression (a previously passing test starts failing)
3. If a new, different test starts failing while suppression is active, alert for the new failure (independent suppression per test)

This prevents the agent from being repeatedly interrupted by the same known failure while working on the fix.

## Stale Watcher State

The watcher state becomes stale and must reset when:

- Branch changes (`git checkout`, `git switch`)
- Dependency changes (`npm install`, `pip install`, lockfile updates)
- Test configuration changes (jest.config, pytest.ini, etc.)
- More than 30 minutes of inactivity

On reset: clear suppression state, clear alert budget, run full watcher scope once.

## TestRunner Boundary

TestRunner remains the formal gate for:

- Full test suite execution (all tests, not just changed-file subset)
- Coverage profile generation and threshold enforcement
- Spec-hash validation (tests match active spec version)
- Certification artifact generation
- Cross-module integration and E2E verification

The Programmer's watcher output is NOT a substitute for TestRunner certification. A GREEN watcher does not mean "tests pass" in the pipeline sense — it means "no regressions detected in the local working set."

## Integration Points

### Programmer skills.md

Add as a conditional awareness item. The Programmer should:
- Start the watcher at the beginning of implementation (step 5a in the inner loop)
- Check watcher signal between slices (after step 5e, before step 5f)
- Include watcher status in loop-detection tripwire evaluation

### Coordinator

The Coordinator does not dispatch or manage the watcher. It is internal to the Programmer's implementation session. The Coordinator only sees TestRunner results at the gate boundary.

## Deferred Work

- Scripting/automation of the watcher: deferred to a later phase
- CI integration: not in scope (this is local dev-time only)
- Watcher configuration per project type: deferred until patterns emerge from usage

## Non-Goals

- Replacing TestRunner as the pipeline gate
- Running heavy or slow test suites continuously
- Streaming raw test output into agent context
- Making pass/fail decisions that affect pipeline state

## References

- `agents/programmer/skills.md` (inner loop steps 5a-5g)
- `agents/testrunner/skills.md` (formal gate scope)
- `harness-engineering/runtime/tripwires.md` (loop detection)
- `harness-engineering/runtime/context-offloading.md` (payload limits)
