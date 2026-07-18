import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // The v8 text table silently drops rows once there are many files —
      // json-summary/json are what a coverage-driven pass should actually
      // read (see docs/jini-port's Phase 6.5 method).
      reporter: ['text', 'json-summary', 'json'],
      // Scoped to this task's ported files (Part 2 of the
      // agent-protocol/ToolExecutor/daemon-core port) rather than the whole
      // package — pre-existing files (command.ts, process.ts, proxy-env.ts,
      // fs.ts, http.ts, toolchain.ts, asset-cache.ts) predate this coverage
      // gate and are out of this task's scope.
      include: [
        'src/home-expansion.ts',
        'src/sandbox-env.ts',
        'src/resource-paths.ts',
        'src/terminal.ts',
      ],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
