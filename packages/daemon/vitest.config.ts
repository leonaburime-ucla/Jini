import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // Scoped to this task's new file (Part 3 of the
      // agent-protocol/ToolExecutor/daemon-core port) rather than the whole
      // package — run-lifecycle.ts/event-log.ts/close-status.ts predate this
      // coverage gate (their own port task made no coverage-threshold
      // commitment) and are out of this task's scope.
      include: ['src/tool-executor.ts'],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
