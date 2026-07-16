# API Contract Spec: <feature-name>

SPEC PACKAGE FILE: `framework/spec-providers/speckit/templates/spec-system/api.spec.md`

- Spec ID: `SPEC-<NNN>`
- Feature: `FEAT-<NNN>-<short-feature-name>`
- Version: `<semver>`
- Content Hash: `<sha256>`
- Last Edited: `<ISO-8601 UTC>`

## Purpose
This file is the source of truth for API behavior for this feature, independent of implementation language.

## 1) Endpoint Registry
| Endpoint ID | Method | Path | Purpose | Auth Profile | Rate Limit Profile |
|---|---|---|---|---|---|
| `EXAMPLE_ACTION` | `POST` | `/api/v1/<resource>` | `<one-line purpose>` | `AUTH_WRITE` | `WRITE_STANDARD` |
| `EXAMPLE_GET` | `GET` | `/api/v1/<resource>/:id` | `<one-line purpose>` | `AUTH_READ` | `READ_STANDARD` |

## 2) Authentication and Authorization Profiles
| Profile ID | Auth Required | Credential Type | Required Scopes | Permitted Roles | Notes |
|---|---|---|---|---|---|
| `AUTH_WRITE` | `true` | `Bearer JWT` | `feature:write` | `admin, editor` | `<notes>` |
| `AUTH_READ` | `true` | `Bearer JWT` | `feature:read` | `admin, editor, viewer` | `<notes>` |

## 3) Rate Limit Profiles
| Profile ID | Window Seconds | Max Requests | Burst Allowance | Keyed By (`userId|apiKey|ip|tenantId`) | Notes |
|---|---:|---:|---:|---|---|
| `WRITE_STANDARD` | `60` | `30` | `5` | `userId` | `<notes>` |
| `READ_STANDARD` | `60` | `300` | `50` | `userId` | `<notes>` |

## 4) Request Contracts
Define request contracts in a language-neutral shape (JSON Schema/OpenAPI/protobuf-like structure).

### Endpoint: `EXAMPLE_ACTION` (`POST /api/v1/<resource>`)
- Path Params:
```yaml
{}
```
- Query Params:
```yaml
{}
```
- Headers:
```yaml
Authorization: "Bearer <token>"
Content-Type: "application/json"
```
- Body:
```yaml
parentId:
  type: string
  format: uuid
  required: true
name:
  type: string
  minLength: 1
  maxLength: 255
  required: true
options:
  type: object
  required: false
  properties:
    notifyOnComplete:
      type: boolean
      default: true
    maxRetries:
      type: integer
      minimum: 0
      maximum: 5
      default: 3
```

### Endpoint: `EXAMPLE_GET` (`GET /api/v1/<resource>/:id`)
- Path Params:
```yaml
id:
  type: string
  format: uuid
  required: true
```
- Query Params:
```yaml
includeDeleted:
  type: boolean
  default: false
fields:
  type: string
  example: "id,name,status"
```

## 5) Response Contracts
### Success Responses
| Endpoint ID | HTTP Status | Body Contract | Notes |
|---|---:|---|---|
| `EXAMPLE_ACTION` | `201` | `ExampleActionResponse` | Returns full created resource |
| `EXAMPLE_GET` | `200` | `ExampleGetResponse` | Returns requested resource |

### Contract Definitions
```yaml
ExampleResource:
  id: { type: string, format: uuid }
  parentId: { type: string, format: uuid }
  name: { type: string }
  status: { type: string, enum: [pending, active, completed, failed, archived] }
  createdAt: { type: string, format: date-time }
  updatedAt: { type: string, format: date-time }

ExampleActionResponse:
  data: { $ref: ExampleResource }
  createdAt: { type: string, format: date-time }

ExampleGetResponse:
  data: { $ref: ExampleResource }
```

## 6) Error Mapping
Reference canonical codes in `errors.spec.md`.

| Endpoint ID | HTTP Status | Error Codes |
|---|---:|---|
| `EXAMPLE_ACTION` | `400` | `VALIDATION_ERROR, INVALID_NAME, VALUE_OUT_OF_RANGE` |
| `EXAMPLE_ACTION` | `401` | `UNAUTHENTICATED` |
| `EXAMPLE_ACTION` | `403` | `FORBIDDEN` |
| `EXAMPLE_ACTION` | `409` | `RESOURCE_CONFLICT` |
| `EXAMPLE_ACTION` | `429` | `RATE_LIMIT_EXCEEDED` |
| `EXAMPLE_ACTION` | `500` | `INTERNAL_ERROR` |
| `EXAMPLE_GET` | `404` | `RESOURCE_NOT_FOUND` |

## 7) Contract Acceptance Checklist
- [ ] Every endpoint in Section 1 has request and response contracts.
- [ ] Every endpoint has auth and rate-limit profiles.
- [ ] Every error code used here exists in `errors.spec.md`.
- [ ] Names and enums align with `state.spec.md`, `orchestrator.spec.md`, and `ui.spec.md`.
