# UI Contract Spec: <feature-name>

SPEC PACKAGE FILE: `framework/spec-providers/speckit/templates/spec-system/ui.spec.md`

- Spec ID: `SPEC-<NNN>`
- Feature: `FEAT-<NNN>-<short-feature-name>`
- Version: `<semver>`
- Content Hash: `<sha256>`
- Last Edited: `<ISO-8601 UTC>`

## Purpose
Defines UI component contracts, interaction events, rendering conditions, and accessibility requirements independent of frontend framework.

## 1) Component Registry
| Component | Responsibility | Inputs Ref | Events Ref |
|---|---|---|---|
| `FeatureContainer` | Top-level feature wiring | Section 2.1 | Section 3.1 |
| `ItemList` | Presents item collection | Section 2.2 | Section 3.2 |
| `ItemCard` | Presents single item | Section 2.3 | Section 3.3 |
| `CreateItemForm` | Captures create input | Section 2.4 | Section 3.4 |
| `ConfirmActionDialog` | Confirms destructive action | Section 2.5 | Section 3.5 |
| `EmptyState` | Renders no-data state | Section 2.6 | n/a |
| `ErrorBanner` | Renders recoverable errors | Section 2.7 | Section 3.7 |

## 2) Input Contracts (Props/Inputs)
### 2.1 FeatureContainer
| Input | Required | Type | Default | Notes |
|---|---|---|---|---|
| `parentId` | yes | `string (uuid)` | none | passed to orchestrator |
| `onItemCreated` | no | `callback(itemSummary)` | none | optional external hook |
| `onItemDeleted` | no | `callback(itemId)` | none | optional external hook |
| `className` | no | `string` | none | layout-level only |
| `pageSize` | no | `integer` | `20` | forwarded to orchestrator |

### 2.2 ItemList
| Input | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | `array<ItemSummary>` | empty list allowed |
| `isLoading` | yes | `boolean` | shows loading skeleton |
| `hasMoreItems` | yes | `boolean` | controls load-more visibility |
| `selectedItemId` | no | `string|null` | selected row styling |
| `isLoadingMore` | no | `boolean` | load-more spinner |

### 2.3-2.7 Additional Components
Define equivalent input tables for `ItemCard`, `CreateItemForm`, `ConfirmActionDialog`, `EmptyState`, and `ErrorBanner`.

## 3) Event Contracts (Outputs)
### 3.1 Container-Level
| Event | Payload | Trigger | Expected Outcome |
|---|---|---|---|
| `onItemCreated` | `itemSummary` | successful create | parent notified once |
| `onItemDeleted` | `itemId` | successful delete | parent notified once |

### 3.2 ItemList Events
| Event | Payload | Trigger |
|---|---|---|
| `onItemSelect` | `itemId` | row click / Enter key |
| `onItemDeleteRequest` | `itemId` | delete control activation |
| `onLoadMore` | none | load-more control activation |

### 3.3-3.7 Additional Components
Document events for remaining components with payload and trigger conditions.

## 4) Rendering and Interaction Rules
- [ ] Empty state renders when `items.length == 0` and `isReady == true`.
- [ ] Loading skeleton renders while initial load is in-flight.
- [ ] Load-more control renders only when `hasMoreItems == true` and not loading.
- [ ] Disabled states are deterministic for all in-flight mutations.
- [ ] Error banner displays latest recoverable error and retry affordance.

## 5) Accessibility Requirements
| Area | Requirement |
|---|---|
| Semantic roles | Interactive elements use correct roles (`button`, `dialog`, `list`, etc.). |
| Labels | All controls have accessible names. |
| Keyboard | Full keyboard operation with visible focus states. |
| Status updates | Async state changes announced via ARIA live region (or equivalent). |
| Error clarity | Validation and API errors are announced and associated with fields/controls. |

## 6) Composition Rules
- `FeatureContainer` is the only public entry component.
- `ItemCard` is rendered only within `ItemList`.
- `ConfirmActionDialog` may be rendered only when a destructive action is pending.
- Internal helper components are implementation detail and excluded from this contract.

## 7) Acceptance Checklist
- [ ] Each public component has explicit input and event contracts.
- [ ] Rendering conditions are deterministic.
- [ ] Accessibility requirements are testable.
- [ ] Entity names and statuses align with `orchestrator.spec.md` and `state.spec.md`.
