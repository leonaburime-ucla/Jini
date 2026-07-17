// Ambient augmentation so vitest's `expect(...)` picks up jest-dom's DOM
// matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) during typecheck.
// The runtime registration lives in `vitest.setup.ts` (outside `src/`, so it
// doesn't reach `tsc`'s program on its own) — this file is what makes the
// augmentation visible to `tsc -p tsconfig.json` as well.
import '@testing-library/jest-dom/vitest';
