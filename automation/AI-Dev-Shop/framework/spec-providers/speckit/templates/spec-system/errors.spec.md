# Error Code Registry Spec: <feature-name>

SPEC PACKAGE FILE: `framework/spec-providers/speckit/templates/spec-system/errors.spec.md`

- Spec ID: `SPEC-<NNN>`
- Feature: `FEAT-<NNN>-<short-feature-name>`
- Version: `<semver>`
- Content Hash: `<sha256>`
- Last Edited: `<ISO-8601 UTC>`

## Purpose
Canonical error registry for this feature, independent of stack/language.

## 1) Error Envelope (Base Payload)
All errors MUST include:

```yaml
code: string
message: string
occurredAt: string   # ISO-8601 UTC
correlationId: string|null
details: object|null
```

## 2) Error Code Registry
| Code | Category | Layer (`api|orchestrator|ui|integration`) | HTTP Status | Retryable | User Message Guidance |
|---|---|---|---:|---|---|
| `RESOURCE_NOT_FOUND` | resource | `api` | 404 | no | "Resource not found." |
| `RESOURCE_CONFLICT` | resource | `api` | 409 | no | "Resource already exists." |
| `VALIDATION_ERROR` | validation | `api` | 400 | no | "Please correct highlighted fields." |
| `UNAUTHENTICATED` | auth | `api` | 401 | maybe | "Please sign in again." |
| `FORBIDDEN` | authz | `api` | 403 | no | "You do not have permission." |
| `RATE_LIMIT_EXCEEDED` | throttling | `api` | 429 | yes | "Too many requests. Try again shortly." |
| `UPSTREAM_TIMEOUT` | dependency | `integration` | 504 | yes | "Temporary service timeout." |
| `UPSTREAM_ERROR` | dependency | `integration` | 502 | yes | "Temporary service issue." |
| `INTERNAL_ERROR` | internal | `api` | 500 | maybe | "Unexpected server error." |
| `REQUEST_CANCELLED` | client | `ui` | 499 | no | Usually silent/no toast |
| `NETWORK_OFFLINE` | client | `ui` | 0 | yes | "No internet connection." |
| `CLIENT_TIMEOUT` | client | `ui` | 0 | yes | "Request timed out. Retry." |

## 3) Per-Code Details Schema
Add only when needed for deterministic handling.

```yaml
VALIDATION_ERROR:
  details:
    fieldErrors:
      type: array
      items:
        field: string
        reason: string

RATE_LIMIT_EXCEEDED:
  details:
    retryAfterSeconds: integer

UPSTREAM_ERROR:
  details:
    dependencyName: string
    upstreamStatus: integer
```

## 4) Ownership and Source Rules
| Code | Produced By | Surfaced By | Notes |
|---|---|---|---|
| `VALIDATION_ERROR` | API validator | API + UI | UI maps field-level errors |
| `UPSTREAM_TIMEOUT` | API integration layer | API + orchestrator | Retry path required |
| `REQUEST_CANCELLED` | UI/orchestrator | UI only | Not a failure metric |

## 5) Acceptance Checklist
- [ ] Every error emitted by feature code appears in Section 2.
- [ ] Every code has clear retry behavior.
- [ ] Every code used in `api.spec.md` appears here.
- [ ] User-safe message guidance is provided.
