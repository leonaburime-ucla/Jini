import { describe, expect, it } from 'vitest';
import { openLedgerDb } from '../../ledger/db.js';
import { ProjectRunnerLedger } from '../../ledger/ledger.js';
import { verifyDagFreshness } from '../../dag/verify-freshness.js';
import { PlanHashDriftError } from '../../errors.js';

describe('verifyDagFreshness', () => {
  it('does nothing for a dag that has never been recorded', () => {
    const ledger = new ProjectRunnerLedger({ db: openLedgerDb({ path: ':memory:' }) });
    expect(() =>
      verifyDagFreshness({ ledger, dagId: 'unknown-dag', currentPlanHash: 'sha256:aaa' }),
    ).not.toThrow();
  });

  it('does nothing when the recorded hash matches the current hash', () => {
    const ledger = new ProjectRunnerLedger({ db: openLedgerDb({ path: ':memory:' }) });
    ledger.recordDagMeta({ dagId: 'dag-1', planHash: 'sha256:aaa' });
    expect(() =>
      verifyDagFreshness({ ledger, dagId: 'dag-1', currentPlanHash: 'sha256:aaa' }),
    ).not.toThrow();
  });

  it('throws PlanHashDriftError when the source doc has drifted from the recorded hash', () => {
    const ledger = new ProjectRunnerLedger({ db: openLedgerDb({ path: ':memory:' }) });
    ledger.recordDagMeta({ dagId: 'dag-1', planHash: 'sha256:aaa' });
    expect(() =>
      verifyDagFreshness({ ledger, dagId: 'dag-1', currentPlanHash: 'sha256:bbb' }),
    ).toThrow(PlanHashDriftError);
  });
});
