import { describe, expect, it } from 'vitest';
import { ToolInputError } from '@jini-ai/core';

import {
  decorateWithSchema,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireInputRecord,
  requireNoInput,
  requireNumber,
  requireObject,
  requireString,
  withSchemaOnRejection,
} from '../registration-kit.js';

/**
 * @file Every input reader in this kit throws `@jini-ai/core`'s `ToolInputError` — the marker
 * `@jini-ai/daemon`'s `ToolExecutor` reads to tag a `'failed'` execution `errorKind: 'validation'`,
 * which is what lets a transport (e.g. `@jini-ai/http-kit`'s `delegated-tools.ts`) answer a malformed
 * call with a real 400 instead of folding it into a redacted 500. Regression coverage for the
 * theme_list_files "wrong parameter name" bug: before this, `requireString` threw a plain `Error`,
 * indistinguishable from a genuine internal failure once it reached the transport.
 */
describe('registration-kit input readers throw ToolInputError, not a plain Error', () => {
  it('requireInputRecord', () => {
    expect(() => requireInputRecord('nope')).toThrow(ToolInputError);
  });

  it('requireString — missing key', () => {
    expect(() => requireString({}, 'themeId')).toThrow(ToolInputError);
  });

  it('requireString — wrong type', () => {
    expect(() => requireString({ themeId: 42 }, 'themeId')).toThrow(ToolInputError);
  });

  it('requireNumber', () => {
    expect(() => requireNumber({}, 'count')).toThrow(ToolInputError);
  });

  it('requireObject', () => {
    expect(() => requireObject({ filters: 'nope' }, 'filters')).toThrow(ToolInputError);
  });

  it('optionalString — wrong type', () => {
    expect(() => optionalString({ tier: 3 }, 'tier')).toThrow(ToolInputError);
  });

  it('optionalNumber — wrong type', () => {
    expect(() => optionalNumber({ limit: 'ten' }, 'limit')).toThrow(ToolInputError);
  });

  it('optionalBoolean — wrong type', () => {
    expect(() => optionalBoolean({ flag: 'yes' }, 'flag')).toThrow(ToolInputError);
  });

  it('requireNoInput — rejects a populated object', () => {
    expect(() => requireNoInput({ unexpected: true })).toThrow(ToolInputError);
  });

  it('a well-formed call does not throw', () => {
    expect(requireString({ themeId: 'plain' }, 'themeId')).toBe('plain');
  });
});

describe('decorateWithSchema / withSchemaOnRejection preserve the ToolInputError marker on domain shape rejections', () => {
  class FakeThemeNotFoundError extends Error {}

  it('decorateWithSchema returns a ToolInputError', () => {
    const decorated = decorateWithSchema({
      toolId: 'theme_read_file',
      catalog: new Map([['theme_read_file', { name: 'theme_read_file', description: 'x', sideEffects: 'none', authorization: { permission: 'theme.set' }, inputSchema: { type: 'object' } }]]),
      message: "theme 'nope' was not found",
    });
    expect(decorated).toBeInstanceOf(ToolInputError);
    expect(decorated.message).toContain("theme 'nope' was not found");
  });

  it('withSchemaOnRejection re-throws a recognized shape rejection as a ToolInputError', async () => {
    const catalog = new Map([['theme_read_file', { name: 'theme_read_file', description: 'x', sideEffects: 'none' as const, authorization: { permission: 'theme.set' }, inputSchema: { type: 'object' } }]]);
    await expect(
      withSchemaOnRejection(
        { toolId: 'theme_read_file', catalog, isShapeRejection: (e) => e instanceof FakeThemeNotFoundError },
        async () => {
          throw new FakeThemeNotFoundError("theme 'nope' was not found");
        },
      ),
    ).rejects.toThrow(ToolInputError);
  });

  it('withSchemaOnRejection leaves an UNrecognized rejection as whatever it originally was — not promoted to ToolInputError', async () => {
    const catalog = new Map();
    await expect(
      withSchemaOnRejection({ toolId: 'x', catalog, isShapeRejection: () => false }, async () => {
        throw new Error('a genuine internal failure');
      }),
    ).rejects.not.toBeInstanceOf(ToolInputError);
  });
});
