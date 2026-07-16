# React Component Testing Policy

## Purpose
UI component testing is often skipped or poorly implemented by LLMs due to complexity. This policy enforces a strict baseline for React component testing using tools like React Testing Library (RTL).

## Component Detection
- If changed files include `*.tsx` or `*.jsx` under UI, component, or page directories, **component tests are explicitly required**.

## Minimum Testing Expectations
Every modified or new React component must include:
1. **Render Test**: Verifies the component mounts without crashing and displays the primary UI elements.
2. **Interaction Test**: Verifies user events (clicks, typing) trigger the correct state changes or callback functions using `userEvent` (not `fireEvent`).
3. **Accessibility (A11y) Assertion**: Verifies standard ARIA roles and labels are present (e.g., testing via `getByRole`).
4. **State/Prop Edge Cases**: Verifies conditional rendering based on different prop states (e.g., loading, error, empty states).

## Skip Policy
- Component tests may **only** be skipped with an explicit, documented reason provided in the handoff (e.g., "This component is purely a wrapper around a third-party library with no internal logic").

## Required Handoff Fields
When handing off a task involving UI components, the following fields must be included in the summary:
- `components_touched`: List of components modified.
- `component_tests_added`: List of tests written.
- `components_uncovered`: Any components intentionally skipped, plus the explicit `reason`.
