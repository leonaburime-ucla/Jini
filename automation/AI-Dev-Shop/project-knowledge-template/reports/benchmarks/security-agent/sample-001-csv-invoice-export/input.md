# Input: Security Agent / CSV Invoice Export

Review the CSV invoice export feature for security and abuse-risk issues.

Use these artifacts:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/adr.md`

Assume the changed surface includes:

- a user-triggered export endpoint
- CSV content derived from invoice fields
- filename generation and download response headers

Minimum bar:

- map the threat surface
- classify findings by severity
- include exploit scenario, mitigation, and verification steps
- call out any human sign-off requirement
