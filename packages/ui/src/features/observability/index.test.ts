// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises). Catches an
// export silently dropped from the barrel without touching runtime behavior.
import { describe, expect, it } from 'vitest';
import * as ObservabilityFeature from './index.js';

describe('observability index barrel', () => {
  it('re-exports the ports, installers, and helpers it advertises', () => {
    const runtimeExports = [
      'noopSafetyEventReporter',
      'installWebObservability',
      'installBootTimingObserver',
      'installLongTaskObserver',
      'installResourceErrorObserver',
      'installVisibilityObserver',
      'installWhiteScreenDetector',
      'trackIframeLoad',
      'trackRunStart',
      'trackRunProgress',
      'trackRunTerminal',
      '__resetStuckRunWatchdogForTests',
    ] as const;

    for (const name of runtimeExports) {
      expect(ObservabilityFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
