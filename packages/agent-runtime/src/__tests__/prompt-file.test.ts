import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { preparePromptFileForAgent } from '../prompt-file.js';
import type { RuntimeAgentDef } from '../types.js';

function makeDef(overrides: Partial<RuntimeAgentDef> = {}): RuntimeAgentDef {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    bin: 'test-agent',
    versionArgs: ['--version'],
    buildArgs: () => [],
    fallbackModels: [],
    streamFormat: 'plain',
    ...overrides,
  } as RuntimeAgentDef;
}

describe('preparePromptFileForAgent', () => {
  it('returns null when the def is nullish', async () => {
    expect(await preparePromptFileForAgent(null, 'hello', 'label')).toBeNull();
    expect(await preparePromptFileForAgent(undefined, 'hello', 'label')).toBeNull();
  });

  it('returns null when the def does not declare promptViaFile', async () => {
    const def = makeDef();
    expect(await preparePromptFileForAgent(def, 'hello', 'label')).toBeNull();
  });

  it('writes the prompt to a temp file and returns a cleanup handle', async () => {
    const def = makeDef({ promptViaFile: true });
    const prepared = await preparePromptFileForAgent(def, 'the prompt body', 'my-label');
    expect(prepared).not.toBeNull();
    expect(prepared!.path).toContain('agent-runtime-test-agent-my-label-');
    expect(prepared!.path.endsWith('prompt.md')).toBe(true);

    const contents = await fs.readFile(prepared!.path, 'utf8');
    expect(contents).toBe('the prompt body');

    await prepared!.cleanup();
    await expect(fs.access(prepared!.path)).rejects.toThrow();
  });

  it('sanitizes unsafe characters out of the label and truncates to 80 chars', async () => {
    const def = makeDef({ promptViaFile: true });
    const longLabel = 'a/b c!@#$%^&*()' + 'x'.repeat(100);
    const prepared = await preparePromptFileForAgent(def, 'body', longLabel);
    expect(prepared).not.toBeNull();
    const dirName = prepared!.path.split('/').slice(-2, -1)[0]!;
    expect(dirName).not.toMatch(/[^a-zA-Z0-9_.-]/);
    await prepared!.cleanup();
  });

  it('falls back to "prompt" when the label is empty', async () => {
    const def = makeDef({ promptViaFile: true });
    const prepared = await preparePromptFileForAgent(def, 'body', '');
    expect(prepared).not.toBeNull();
    expect(prepared!.path).toContain('agent-runtime-test-agent-prompt-');
    await prepared!.cleanup();
  });

  it('cleanup() tolerates being called when the directory is already gone', async () => {
    const def = makeDef({ promptViaFile: true });
    const prepared = await preparePromptFileForAgent(def, 'body', 'label');
    await prepared!.cleanup();
    await expect(prepared!.cleanup()).resolves.toBeUndefined();
  });
});
