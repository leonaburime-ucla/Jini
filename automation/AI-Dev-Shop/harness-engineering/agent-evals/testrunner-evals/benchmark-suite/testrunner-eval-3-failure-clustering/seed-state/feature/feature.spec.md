# Feature Spec — Audit Notifications

## Metadata

- Spec ID: `SPEC-AUD-403`
- Spec Version: `1.7`
- Spec Hash: `sha256:403aaa8a06c3f4f7b8c7d23e59e392e6a5e2af8410a5d21201b4b4f44abf4030`
- Human Approved: `true`

## Requirements

`REQ-403-01`: Publish an audit notification when a privileged admin changes billing settings.

`REQ-403-02`: Notification payload includes `adminId`, `merchantId`, `settingName`, and `changedAt`.

`REQ-403-03`: The spec no longer requires `billingPlan` in the payload; this field was removed in version `1.7`.

`REQ-403-04`: Audit notification tests require `AUDIT_WEBHOOK_SECRET` in the environment.

`REQ-403-05`: Optional smoke test for legacy email notification is out of scope for this feature.
