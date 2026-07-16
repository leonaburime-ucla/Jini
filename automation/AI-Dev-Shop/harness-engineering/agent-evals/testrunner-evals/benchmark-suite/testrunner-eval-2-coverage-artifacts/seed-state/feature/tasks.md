# Tasks — Invoice Export

## Coverage Profile

- Unit: `98/98/98/98`
- Integration: `90/90/90/90`
- E2E: `80/80/80/80`

## Touched File Baselines

| File | Previous Lines | Previous Branches | Previous Functions | Previous Statements |
|---|---:|---:|---:|---:|
| `src/export/invoiceCsv.ts` | 95.0 | 93.0 | 100.0 | 95.0 |
| `src/export/authGate.ts` | 99.0 | 98.0 | 100.0 | 99.0 |

Touched-file regressions block advancement even if global coverage improves.

## Exemptions

`src/generated/exportFixtureFactory.ts` is generated test fixture code and is exempt from production coverage gates.
