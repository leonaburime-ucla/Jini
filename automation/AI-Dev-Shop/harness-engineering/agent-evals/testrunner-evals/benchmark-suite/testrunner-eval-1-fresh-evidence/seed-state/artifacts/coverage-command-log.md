# Coverage Command Log

Command: `npm run coverage:all`

```text
coverage: collecting unit coverage
coverage: collecting integration coverage
coverage: collecting e2e coverage
coverage: merge complete
exit code: 0
```

Expected artifacts:

- `coverage/unit/coverage-final.json`: present
- `coverage/integration/coverage-final.json`: present
- `coverage/e2e/coverage-final.json`: present
- `coverage/merged/coverage-summary.json`: missing

The coverage command exited successfully but did not produce the merged artifact required for gate evaluation.
