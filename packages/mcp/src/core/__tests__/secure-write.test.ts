import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `stat` is intercepted so the fail-closed "the OS didn't honor mode 0600"
// path can be exercised deterministically without needing a real filesystem
// that misbehaves. Every other fs/promises call delegates to the real
// implementation.
const hoisted = vi.hoisted(() => ({ statMode: 'ok' as 'ok' | 'group-readable' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: async (p: fs.PathLike) => {
      const real = await actual.stat(p);
      if (hoisted.statMode === 'group-readable' && String(p).includes('.tmp')) {
        (real as unknown as { mode: number }).mode = (real.mode & ~0o777) | 0o644;
      }
      return real;
    },
  };
});

import { writeSecretFileAtomic } from '../secure-write.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-mcp-secure-write-'));
  tmpDirs.push(d);
  return d;
}
beforeEach(() => {
  hoisted.statMode = 'ok';
});
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('writeSecretFileAtomic', () => {
  it('writes the content and survives the atomic rename, leaving no temp file behind', async () => {
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await writeSecretFileAtomic(file, '{"a":1}');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}');
    expect(fs.readdirSync(dir)).toEqual(['secret.json']);
  });

  it('creates the file with owner-only (0600) permissions from the first byte (POSIX)', async () => {
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await writeSecretFileAtomic(file, 'x');
    if (process.platform !== 'win32') {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it('creates missing parent directories', async () => {
    const dir = tmp();
    const file = path.join(dir, 'nested', 'deep', 'secret.json');
    await writeSecretFileAtomic(file, 'x');
    expect(fs.readFileSync(file, 'utf8')).toBe('x');
  });

  it('overwrites a prior write via a fresh temp name each time, leaving only the final file', async () => {
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await writeSecretFileAtomic(file, 'first');
    await writeSecretFileAtomic(file, 'second');
    expect(fs.readFileSync(file, 'utf8')).toBe('second');
    expect(fs.readdirSync(dir)).toEqual(['secret.json']);
  });

  it('fails closed and removes the temp file when the on-disk mode is not owner-only (POSIX)', async () => {
    hoisted.statMode = 'group-readable';
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await expect(writeSecretFileAtomic(file, 'x')).rejects.toThrow(/owner-only/);
    expect(fs.existsSync(file)).toBe(false); // never renamed into place
    expect(fs.readdirSync(dir)).toEqual([]); // temp file cleaned up
  });

  it('does not clobber a prior valid file when a later write fails closed', async () => {
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await writeSecretFileAtomic(file, 'good');
    hoisted.statMode = 'group-readable';
    await expect(writeSecretFileAtomic(file, 'bad')).rejects.toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('good');
  });

  it('skips the POSIX mode check when platform is overridden to win32', async () => {
    hoisted.statMode = 'group-readable'; // would fail closed on POSIX
    const dir = tmp();
    const file = path.join(dir, 'secret.json');
    await writeSecretFileAtomic(file, 'x', { platform: 'win32' });
    expect(fs.readFileSync(file, 'utf8')).toBe('x');
  });
});
