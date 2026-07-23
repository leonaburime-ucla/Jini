import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupSandbox, createSandbox } from '../../sandbox/sandbox.js';

describe('sandbox', () => {
  let sandboxRoot: string;

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), 'project-runner-sandbox-test-'));
  });

  afterEach(async () => {
    await rm(sandboxRoot, { recursive: true, force: true });
  });

  it('creates an isolated, namespaced directory per work item and attempt', async () => {
    const { path } = await createSandbox({ sandboxRoot, workItemId: 'm1-impl', attemptNumber: 1 });
    expect(path).toBe(join(sandboxRoot, 'm1-impl', 'attempt-1'));
    expect(existsSync(path)).toBe(true);
  });

  it('never collides two different attempts of the same WorkItem (adversarial: retry reuse)', async () => {
    const attempt1 = await createSandbox({ sandboxRoot, workItemId: 'm1-impl', attemptNumber: 1 });
    await writeFile(join(attempt1.path, 'evidence.txt'), 'attempt 1 evidence');

    const attempt2 = await createSandbox({ sandboxRoot, workItemId: 'm1-impl', attemptNumber: 2 });

    expect(attempt2.path).not.toBe(attempt1.path);
    const attempt1Files = await readdir(attempt1.path);
    expect(attempt1Files).toContain('evidence.txt'); // attempt 1's evidence must survive attempt 2 starting
  });

  it('cleanupSandbox removes the directory and its contents', async () => {
    const { path } = await createSandbox({ sandboxRoot, workItemId: 'm1-impl', attemptNumber: 1 });
    await writeFile(join(path, 'output.txt'), 'partial work');
    await cleanupSandbox({ path });
    expect(existsSync(path)).toBe(false);
  });

  it('cleanupSandbox does not throw for a path that does not exist', async () => {
    await expect(cleanupSandbox({ path: join(sandboxRoot, 'never-created') })).resolves.toBeUndefined();
  });
});
