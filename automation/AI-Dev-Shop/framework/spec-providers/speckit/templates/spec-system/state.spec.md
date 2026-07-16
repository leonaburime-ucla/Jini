# State Contract Spec: <feature-name>

SPEC PACKAGE FILE: `framework/spec-providers/speckit/templates/spec-system/state.spec.md`

- Spec ID: `SPEC-<NNN>`
- Feature: `FEAT-<NNN>-<short-feature-name>`
- Version: `<semver>`
- Content Hash: `<sha256>`
- Last Edited: `<ISO-8601 UTC>`

## Purpose
Defines persistent and derived state, legal transitions, selectors, and invariants in a language-neutral format.

## 1) State Shape
| Field | Type | Nullable | Initial Value | Description |
|---|---|---|---|---|
| `items` | `array<FeatureItem>` | no | `[]` | Resource list |
| `selectedItemId` | `string` | yes | `null` | Current selection |
| `loading` | `LoadingState` | no | all `false` | Per-operation load flags |
| `errors` | `ErrorState` | no | all `null` | Per-operation errors |
| `nextPageCursor` | `string` | yes | `null` | Pagination cursor |
| `allItemsLoaded` | `boolean` | no | `false` | No more pages flag |
| `lastFetchedAt` | `string (date-time)` | yes | `null` | Last successful list fetch |

## 2) Entity Contracts
```yaml
FeatureItem:
  id: string (uuid)
  name: string
  status: enum[pending, active, completed, failed, archived]
  createdAt: string (date-time)
  updatedAt: string (date-time)
  localVersion: integer

LoadingState:
  fetchingItems: boolean
  fetchingItem: boolean
  creatingItem: boolean
  updatingItem: boolean
  deletingItem: boolean

ErrorState:
  fetchItems: Error|null
  fetchItem: Error|null
  createItem: Error|null
  updateItem: Error|null
  deleteItem: Error|null
```

## 3) Action Catalog
| Action | Payload | Precondition | State Changes | Failure Handling |
|---|---|---|---|---|
| `FETCH_ITEMS_REQUEST` | optional cursor | none | `loading.fetchingItems=true` | clear/retain error (specify) |
| `FETCH_ITEMS_SUCCESS` | items + nextCursor | request in-flight | replace/append items, update cursor/timestamp | clear `errors.fetchItems` |
| `FETCH_ITEMS_FAILURE` | error | request in-flight | `loading.fetchingItems=false` | set `errors.fetchItems` |
| `CREATE_ITEM_REQUEST` | create params | valid form input | optimistic insert | set `loading.creatingItem=true` |
| `CREATE_ITEM_SUCCESS` | confirmed item | create in-flight | reconcile optimistic item | clear `errors.createItem` |
| `CREATE_ITEM_FAILURE` | error | create in-flight | rollback optimistic insert | set `errors.createItem` |
| `UPDATE_ITEM_*` | `itemId + changes` | item exists | optimistic update / reconcile / rollback | set/clear `errors.updateItem` |
| `DELETE_ITEM_*` | `itemId` | item exists | optimistic remove / confirm / rollback | set/clear `errors.deleteItem` |
| `SELECT_ITEM` | `itemId|null` | none | update `selectedItemId` | none |
| `RESET_STATE` | none | none | reset to initial values | clear all errors/loading |

## 4) Selector Contracts
| Selector | Input | Output | Null/Empty Behavior |
|---|---|---|---|
| `selectItems` | full state | `array<FeatureItem>` | empty array when no data |
| `selectSelectedItem` | full state | `FeatureItem|null` | null when no selection or missing item |
| `selectIsLoading` | full state | `boolean` | OR of loading flags |
| `selectCanLoadMore` | full state | `boolean` | false when `allItemsLoaded=true` |
| `selectLastError` | full state | `Error|null` | latest operation error or null |

## 5) State Invariants
- [ ] `allItemsLoaded=true` implies `nextPageCursor=null`.
- [ ] `selectedItemId` is null or exists in `items`.
- [ ] Any `*_REQUEST` action sets only its matching loading flag.
- [ ] Any `*_SUCCESS`/`*_FAILURE` clears its matching loading flag.
- [ ] Rollback paths restore pre-request item values.

## 6) Acceptance Checklist
- [ ] All actions have explicit before/after behavior.
- [ ] Selectors are deterministic and side-effect free.
- [ ] Entity fields and enums align with `api.spec.md`, `orchestrator.spec.md`, `ui.spec.md`.
