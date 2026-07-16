import { describe, expect, it } from 'vitest';
import { AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE, TERMINAL_WORK_ITEM_STATES } from '../../domain/types.js';
import type { WorkItemState } from '../../domain/types.js';

const ALL_WORK_ITEM_STATES: readonly WorkItemState[] = [
  'queued',
  'leased',
  'running',
  'succeeded',
  'retry_scheduled',
  'waiting_for_human',
  'failed',
  'cancelled',
];

describe('AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE', () => {
  it('maps every WorkItemState to a non-empty AI-Dev-Shop status', () => {
    for (const state of ALL_WORK_ITEM_STATES) {
      expect(AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE[state]).toBeTruthy();
    }
  });

  it('has exactly one mapping per state (no drift between the type and the const)', () => {
    expect(Object.keys(AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE).sort()).toEqual(
      [...ALL_WORK_ITEM_STATES].sort(),
    );
  });
});

describe('TERMINAL_WORK_ITEM_STATES', () => {
  it('contains exactly succeeded, failed, cancelled', () => {
    expect([...TERMINAL_WORK_ITEM_STATES].sort()).toEqual(['cancelled', 'failed', 'succeeded']);
  });
});
