# Eval 1 Seed Ledger

This is the per-eval mirror of the hidden suite ledger entries for `RT-SEED-01` through `RT-SEED-09`.

- `RT-SEED-01`: auth required while auth is out of scope.
- `RT-SEED-02`: email required while social-only login forbids email capture.
- `RT-SEED-03`: "appropriate response time" has no measurable threshold.
- `RT-SEED-04`: assumed rate-limit service has no dependency or failure-mode contract.
- `RT-SEED-05`: concurrent duplicate registration behavior is unspecified.
- `RT-SEED-06`: upstream idempotency assumption contradicts dependency notes.
- `RT-SEED-07`: alternate `accountId` invite acceptance creates IDOR-style path; no destructive proof.
- `RT-SEED-08`: report ambiguity only; do not rewrite the AC.
- `RT-SEED-09`: pre-escaped rendering guarantee is a negative control for XSS over-reporting.
- `RT-SEED-28`: retired SMS fallback is a negative control for missing-behavior over-reporting.
