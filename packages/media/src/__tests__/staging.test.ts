import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFsAttachmentStaging } from '../staging.js';

let cwd: string;
let outside: string;

beforeEach(async () => {
  cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jini-media-staging-cwd-'));
  outside = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jini-media-staging-outside-'));
});

afterEach(async () => {
  await fs.promises.rm(cwd, { recursive: true, force: true });
  await fs.promises.rm(outside, { recursive: true, force: true });
});

describe('createFsAttachmentStaging', () => {
  it('returns [] for an empty or non-array input', async () => {
    const staging = createFsAttachmentStaging(cwd);
    expect(await staging.stage([])).toEqual([]);
    expect(await staging.stage(undefined as unknown as string[])).toEqual([]);
  });

  it('uses a path already inside cwd as-is (no copy)', async () => {
    const inside = path.join(cwd, 'already-here.png');
    await fs.promises.writeFile(inside, 'x');
    const staging = createFsAttachmentStaging(cwd);
    const staged = await staging.stage([inside]);
    expect(staged).toEqual([await fs.promises.realpath(inside)]);
  });

  it('copies a path outside cwd into the staging directory', async () => {
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'external-bytes');
    const staging = createFsAttachmentStaging(cwd);
    const [staged] = await staging.stage([externalFile]);
    expect(staged).toBeDefined();
    expect(staged!.startsWith(path.join(cwd, '.media-attachments'))).toBe(true);
    expect(await fs.promises.readFile(staged!, 'utf8')).toBe('external-bytes');
    // original untouched
    expect(await fs.promises.readFile(externalFile, 'utf8')).toBe('external-bytes');
  });

  it('respects a custom stagingDirName option', async () => {
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    const staging = createFsAttachmentStaging(cwd, { stagingDirName: '.custom-staging' });
    const [staged] = await staging.stage([externalFile]);
    expect(staged!.startsWith(path.join(cwd, '.custom-staging'))).toBe(true);
  });

  it('rejects a path outside uploadRoot when uploadRoot is supplied', async () => {
    const uploadRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jini-media-staging-upload-'));
    try {
      const outsideUploadRoot = path.join(outside, 'not-allowed.png');
      await fs.promises.writeFile(outsideUploadRoot, 'x');
      const staging = createFsAttachmentStaging(cwd);
      expect(await staging.stage([outsideUploadRoot], uploadRoot)).toEqual([]);
    } finally {
      await fs.promises.rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('accepts a path inside uploadRoot when uploadRoot is supplied', async () => {
    const uploadRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jini-media-staging-upload-'));
    try {
      const allowed = path.join(uploadRoot, 'allowed.png');
      await fs.promises.writeFile(allowed, 'x');
      const staging = createFsAttachmentStaging(cwd);
      const staged = await staging.stage([allowed], uploadRoot);
      expect(staged).toHaveLength(1);
    } finally {
      await fs.promises.rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('treats a nonexistent uploadRoot as no restriction check passing (realpath fails -> null)', async () => {
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    const staging = createFsAttachmentStaging(cwd);
    const staged = await staging.stage([externalFile], path.join(outside, 'does-not-exist'));
    expect(staged).toHaveLength(1);
  });

  it('skips a blank-string path', async () => {
    const staging = createFsAttachmentStaging(cwd);
    expect(await staging.stage(['   '])).toEqual([]);
  });

  it('skips a non-string entry', async () => {
    const staging = createFsAttachmentStaging(cwd);
    expect(await staging.stage([123 as unknown as string])).toEqual([]);
  });

  it('skips a path that does not exist', async () => {
    const staging = createFsAttachmentStaging(cwd);
    expect(await staging.stage([path.join(outside, 'missing.png')])).toEqual([]);
  });

  it('skips a directory path (not a file)', async () => {
    const dir = path.join(outside, 'a-directory');
    await fs.promises.mkdir(dir);
    const staging = createFsAttachmentStaging(cwd);
    expect(await staging.stage([dir])).toEqual([]);
  });

  it('prunes staged files older than maxAgeMs on a later call', async () => {
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    const staging = createFsAttachmentStaging(cwd, { maxAgeMs: 1 });
    const [staged] = await staging.stage([externalFile]);
    expect(fs.existsSync(staged!)).toBe(true);

    // Backdate the staged file's mtime so the next call's prune sees it as stale.
    const past = new Date(Date.now() - 10_000);
    await fs.promises.utimes(staged!, past, past);

    const externalFile2 = path.join(outside, 'photo2.png');
    await fs.promises.writeFile(externalFile2, 'y');
    await staging.stage([externalFile2]);

    expect(fs.existsSync(staged!)).toBe(false);
  });

  it('prune treats a readdir failure as nothing-to-prune (best-effort)', async () => {
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    const staging = createFsAttachmentStaging(cwd);
    const readdirSpy = vi.spyOn(fs.promises, 'readdir').mockRejectedValueOnce(new Error('boom'));
    const staged = await staging.stage([externalFile]);
    // mkdir still ran, then prune's readdir failed and was swallowed, then staging itself still succeeds.
    expect(staged).toHaveLength(1);
    readdirSpy.mockRestore();
  });

  it('prune treats a per-entry stat failure as best-effort and continues', async () => {
    const staleFile = path.join(outside, 'stale.png');
    await fs.promises.writeFile(staleFile, 'x');
    const staging = createFsAttachmentStaging(cwd, { maxAgeMs: 1 });
    const [staged] = await staging.stage([staleFile]);
    expect(staged).toBeDefined();

    const statSpy = vi.spyOn(fs.promises, 'stat').mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const externalFile2 = path.join(outside, 'photo2.png');
    await fs.promises.writeFile(externalFile2, 'y');
    // The prune pass hits the mocked stat failure for the pre-existing staged file (best-effort,
    // swallowed) before staging photo2.png for real.
    const staged2 = await staging.stage([externalFile2]);
    expect(staged2).toHaveLength(1);
    statSpy.mockRestore();
  });

  it('prune skips a non-file entry (e.g. a stray subdirectory) in the staging dir', async () => {
    const staging = createFsAttachmentStaging(cwd);
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    await staging.stage([externalFile]);
    await fs.promises.mkdir(path.join(cwd, '.media-attachments', 'a-stray-dir'));

    const externalFile2 = path.join(outside, 'photo2.png');
    await fs.promises.writeFile(externalFile2, 'y');
    const staged2 = await staging.stage([externalFile2]);
    expect(staged2).toHaveLength(1);
    expect(fs.existsSync(path.join(cwd, '.media-attachments', 'a-stray-dir'))).toBe(true);
  });

  it('is a no-op prune when the staging directory does not exist yet', async () => {
    const staging = createFsAttachmentStaging(cwd);
    // No prior stage() call, so the staging dir has never been created; stage([]) short-circuits
    // before mkdir/prune, so drive a real file through it to exercise the readdir-catch path once,
    // then delete the dir and stage again to hit "readdir fails -> return" on a fresh instance.
    const staging2 = createFsAttachmentStaging(path.join(cwd, 'does-not-exist-yet'));
    const externalFile = path.join(outside, 'photo.png');
    await fs.promises.writeFile(externalFile, 'x');
    const staged = await staging2.stage([externalFile]);
    expect(staged).toHaveLength(1);
  });
});
