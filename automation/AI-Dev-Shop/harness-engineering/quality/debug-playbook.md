# Debug Playbook

## Purpose
This playbook defines the systematic approach agents must take when encountering failing tests, runtime errors, or flaky behavior. Guessing or blindly modifying code without a verified hypothesis is an anti-pattern.

## When to Debug
- A test fails during the TDD or implementation cycle.
- A runtime error is encountered during application execution.
- Flaky or inconsistent behavior is observed.

## The Debug Loop
Agents must follow this strict loop when debugging:

1. **Reproduce**: Run the specific command or test to reproduce the error locally. Do not proceed until the error is consistently reproducible.
2. **Isolate**: Narrow the scope. If a full test suite fails, run only the failing test. If a large function fails, identify the specific line or sub-routine.
3. **Instrument**: Add targeted `console.log`, `print`, or tracer statements to observe the internal state, inputs, and outputs of the isolated section.
4. **Run & Capture**: Execute the targeted command again and capture the output of your instrumentation.
5. **Form Hypothesis**: Based on the observed output, state a clear hypothesis about *why* the failure is happening (e.g., "The variable `id` is undefined because the API response structure changed").
6. **Verify Fix**: Apply the fix and run the exact same reproduction command to verify the hypothesis was correct.

## Trace Requirements
When reporting a debugging session (especially in handoffs or escalations), include the following fields:
- **Step / Action**: The command executed.
- **Observed Output**: The actual error or log trace.
- **Hypothesis**: Why it failed.
- **Next Action**: How to fix or further isolate it.

## Escalation Rule
- **Stop and Escalate** to the Coordinator (or human) after 3 failed hypotheses for the same issue. Do not endlessly thrash or rewrite unrelated code.
