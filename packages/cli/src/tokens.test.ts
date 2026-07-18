import { describe, expect, it } from 'vitest';
import { CommandRegistryToken } from './tokens.js';

describe('CommandRegistryToken', () => {
  it('is a one-cardinality token identifying the CommandRegistry service', () => {
    expect(CommandRegistryToken.id).toBe('jini.cli.commandRegistry');
    expect(CommandRegistryToken.cardinality).toBe('one');
    expect(CommandRegistryToken.version).toBe(1);
  });
});
