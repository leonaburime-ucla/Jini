# Expected Output: TestRunner Agent / CSV Invoice Export

A strong result should include:

- unit / integration / E2E / acceptance status as applicable
- explicit coverage-gate reporting rather than a vague "tests passed"
- failure clusters mapped to likely owner when not green
- a route recommendation that tells Coordinator whether to send work back to Programmer, TDD, or another stage

Weak results:

- summarize without exact pass/fail status
- ignore coverage gates
- collapse all failures into one undifferentiated bucket
