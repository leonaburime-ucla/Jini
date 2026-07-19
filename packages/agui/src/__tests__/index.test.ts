import { describe, expect, it } from 'vitest';
import * as agui from '../index.js';

// Exercises the public root barrel.
describe('@jini/agui public barrel', () => {
  it('re-exports createAguiEncoder', () => {
    expect(agui.createAguiEncoder).toBeDefined();
    expect(typeof agui.createAguiEncoder).toBe('function');
  });

  it('createAguiEncoder produces a working encoder end to end', () => {
    const encoder = agui.createAguiEncoder();
    const result = encoder.encode({ id: 'e1', event: 'start', data: { runId: 'run-1' } }, { runId: 'run-1', now: () => 1 });
    expect(result).toEqual({ kind: 'run.lifecycle', status: 'started', runId: 'run-1', ts: 1 });
  });
});
