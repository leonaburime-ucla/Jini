import { describe, expect, it } from 'vitest';
import * as run from '../index.js';

// The run barrel is a pure re-export surface. Importing it here executes its own
// re-export statements (and the core/ + diagnostics/ sub-barrels) under coverage,
// and asserts the public value API is actually present.
describe('run barrel', () => {
  it('re-exports every run-orchestration value', () => {
    const expected = [
      'runResultFromStatus',
      'deriveRunErrorCode',
      'DEFAULT_SAFE_RUN_RETRY_MAX_ATTEMPTS',
      'SAFE_RUN_RETRY_STRATEGY',
      'RATE_LIMIT_RETRY_BASE_DELAY_MS',
      'TRANSIENT_RETRY_BASE_DELAY_MS',
      'RETRY_BACKOFF_MULTIPLIER',
      'MAX_RETRY_BACKOFF_DELAY_MS',
      'computeRetryBackoffMs',
      'decideSafeRunRetry',
      'stderrLineCountBucket',
      'collectStderrTailSummary',
      'collectStdoutTailSummary',
      'summarizeRunDiagnosticsForAnalytics',
    ] as const;
    for (const name of expected) {
      expect(run[name as keyof typeof run]).toBeDefined();
    }
  });
});
