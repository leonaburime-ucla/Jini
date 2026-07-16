# Orchestrator Contract Spec: <feature-name>

SPEC PACKAGE FILE: `framework/spec-providers/speckit/templates/spec-system/orchestrator.spec.md`

- Spec ID: `SPEC-<NNN>`
- Feature: `FEAT-<NNN>-<short-feature-name>`
- Version: `<semver>`
- Content Hash: `<sha256>`
- Last Edited: `<ISO-8601 UTC>`

## Purpose
Defines orchestration inputs, outputs, lifecycle behavior, and operation contracts in a language-neutral way.

## 1) Orchestrator Identity
- Name: `<FeatureName>Orchestrator`
- Responsibility: `<one sentence>`

## 2) Input Contract
| Input | Required | Type | Default | Validation/Bounds | Notes |
|---|---|---|---|---|---|
| `parentId` | yes | `string (uuid)` | none | must be UUID | Scope anchor |
| `pageSize` | no | `integer` | `20` | `1..100` | Clamp or reject (specify) |
| `autoFetch` | no | `boolean` | `true` | n/a | Initial load behavior |
| `onItemCreated` | no | `callback(item)` | none | n/a | Post-create hook |
| `onItemDeleted` | no | `callback(itemId)` | none | n/a | Post-delete hook |
| `onError` | no | `callback(error)` | none | n/a | Side-channel error hook |

## 3) Output State Contract
| Field | Type | Nullability | Source | Notes |
|---|---|---|---|---|
| `items` | `array<Item>` | never null | derived | Sorted newest-first |
| `selectedItem` | `Item` | nullable | derived | Current selection |
| `isLoading` | `boolean` | non-null | derived | Any op in-flight |
| `loadingStates` | `object` | non-null | derived | Per-operation flags |
| `error` | `Error` | nullable | derived | Most recent error |
| `errors` | `object` | non-null | derived | Per-operation error slots |
| `hasMoreItems` | `boolean` | non-null | derived | Pagination indicator |
| `isReady` | `boolean` | non-null | derived | First successful load complete |

## 4) Action Contracts
| Action | Inputs | Returns | Side Effects | Failure Codes |
|---|---|---|---|---|
| `loadItems` | none | `Result<array<Item>>` | replace item list | `UPSTREAM_ERROR, INTERNAL_ERROR` |
| `loadMoreItems` | none | `Result<array<Item>>` | append item list | `UPSTREAM_TIMEOUT, INTERNAL_ERROR` |
| `createItem` | `CreateItemParams` | `Result<Item>` | optimistic add + confirm/rollback | `VALIDATION_ERROR, RESOURCE_CONFLICT` |
| `updateItem` | `itemId, changes` | `Result<Item>` | optimistic update + confirm/rollback | `RESOURCE_NOT_FOUND, RESOURCE_STALE` |
| `deleteItem` | `itemId` | `Result<void>` | optimistic remove + confirm/rollback | `RESOURCE_NOT_FOUND, FORBIDDEN` |
| `selectItem` | `itemId|null` | `void` | update selection | none |
| `resetErrors` | `scope(optional)` | `void` | clear error slots | none |

## 5) Lifecycle Hooks
| Hook | Trigger | Ordering | Failure Behavior |
|---|---|---|---|
| `onInitialize` | orchestrator start | first | non-fatal logging only |
| `onBeforeAction` | before each action | before network call | action may be cancelled |
| `onAfterSuccess` | after successful action | after state update | non-fatal logging only |
| `onAfterFailure` | after failed action | after error state update | non-fatal logging only |

## 6) Invariants
- [ ] `isLoading` equals logical OR of all `loadingStates.*`.
- [ ] Failed optimistic actions roll back to last confirmed state.
- [ ] `error` mirrors most recent non-null entry in `errors`.
- [ ] `hasMoreItems=false` prevents further page fetch calls.

## 7) Acceptance Checklist
- [ ] Inputs/outputs/actions are fully documented.
- [ ] Failure codes align with `errors.spec.md`.
- [ ] Entity field names align with `state.spec.md` and `ui.spec.md`.
