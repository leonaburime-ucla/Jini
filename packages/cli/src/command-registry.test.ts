import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from './command-registry.js';

describe('CommandRegistry', () => {
  it('reports empty when argv has no positional token', async () => {
    const registry = new CommandRegistry();
    const result = await registry.dispatch(['--json']);
    expect(result).toEqual({ kind: 'empty' });
  });

  it('reports not-found for an unregistered command name', async () => {
    const registry = new CommandRegistry();
    const result = await registry.dispatch(['bogus']);
    expect(result).toEqual({ kind: 'not-found', name: 'bogus' });
  });

  it('dispatches to a registered handler with the command name removed', async () => {
    const registry = new CommandRegistry();
    const handler = vi.fn();
    registry.add('run', handler);
    const result = await registry.dispatch(['run', 'start', '--json']);
    expect(result).toEqual({ kind: 'handled' });
    expect(handler).toHaveBeenCalledWith(['start', '--json']);
  });

  it('preserves flags that appear before the command name', async () => {
    const registry = new CommandRegistry();
    const handler = vi.fn();
    registry.add('run', handler);
    const result = await registry.dispatch(['--verbose', 'run', 'start']);
    expect(result).toEqual({ kind: 'handled' });
    expect(handler).toHaveBeenCalledWith(['--verbose', 'start']);
  });

  it('awaits an async handler', async () => {
    const registry = new CommandRegistry();
    let resolved = false;
    registry.add('slow', async () => {
      await Promise.resolve();
      resolved = true;
    });
    await registry.dispatch(['slow']);
    expect(resolved).toBe(true);
  });

  it('replaces an existing registration when re-registering the same name', async () => {
    const registry = new CommandRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.add('run', first);
    registry.add('run', second);
    await registry.dispatch(['run']);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('has() reflects registered command names', () => {
    const registry = new CommandRegistry();
    expect(registry.has('run')).toBe(false);
    registry.add('run', () => {});
    expect(registry.has('run')).toBe(true);
  });

  it('names() lists every registered command in insertion order', () => {
    const registry = new CommandRegistry();
    registry.add('a', () => {});
    registry.add('b', () => {});
    expect(registry.names()).toEqual(['a', 'b']);
  });

  it('usageFor() returns the registered usage text', () => {
    const registry = new CommandRegistry();
    registry.add('run', () => {}, { usage: 'Usage: run ...' });
    expect(registry.usageFor('run')).toBe('Usage: run ...');
  });

  it('usageFor() returns undefined when no usage was registered', () => {
    const registry = new CommandRegistry();
    registry.add('run', () => {});
    expect(registry.usageFor('run')).toBeUndefined();
  });

  it('usageFor() returns undefined for an unregistered command', () => {
    const registry = new CommandRegistry();
    expect(registry.usageFor('bogus')).toBeUndefined();
  });
});
