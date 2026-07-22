import { describe, expect, it } from 'vitest';
import { createTurnEndGuard } from '../turn-end-guard.js';

describe('createTurnEndGuard', () => {
  it('starts not-ended', () => {
    const guard = createTurnEndGuard<{ reason: string }>(() => {}, (reason) => ({ reason }));
    expect(guard.hasEnded()).toBe(false);
  });

  it('emits the end event on the first call and flips hasEnded to true', () => {
    const events: Array<{ reason: string }> = [];
    const guard = createTurnEndGuard<{ reason: string }>((e) => events.push(e), (reason) => ({ reason }));
    guard.emitEnd('stop');
    expect(events).toEqual([{ reason: 'stop' }]);
    expect(guard.hasEnded()).toBe(true);
  });

  it('is a no-op on every subsequent call, regardless of reason — this is the duplicate-end-event fix', () => {
    const events: Array<{ reason: string }> = [];
    const guard = createTurnEndGuard<{ reason: string }>((e) => events.push(e), (reason) => ({ reason }));
    guard.emitEnd('contaminated');
    guard.emitEnd('stop');
    guard.emitEnd('error');
    guard.emitEnd('max_tool_turns');
    expect(events).toEqual([{ reason: 'contaminated' }]);
  });
});
