import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fsMockState = vi.hoisted(() => ({
  statImpl: null as ((...args: unknown[]) => Promise<unknown>) | null,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: (...args: unknown[]) =>
      fsMockState.statImpl ? fsMockState.statImpl(...args) : (actual.stat as (...a: unknown[]) => Promise<unknown>)(...args),
  };
});

import {
  ArtifactRegressionError,
  DEFAULT_ARTIFACT_STUB_GUARD_CONFIG,
  EMPTY_SLUG_FALLBACK_NAME,
  artifactIdentifiersMatch,
  classifyArtifactStubGuard,
  evaluateArtifactStubGuard,
  findPriorArtifactSiblings,
  readArtifactStubGuardConfigFromEnv,
  slugifyArtifactIdentifier,
  type ArtifactStubGuardConfig,
  type PriorArtifactSibling,
} from './stub-guard.js';

describe('slugifyArtifactIdentifier', () => {
  it('lowercases and hyphenates non-alphanumeric runs', () => {
    expect(slugifyArtifactIdentifier('Landing Page')).toBe('landing-page');
  });

  it('strips leading/trailing hyphens and truncates at 60 chars', () => {
    expect(slugifyArtifactIdentifier('  --Hi--  ')).toBe('hi');
    expect(slugifyArtifactIdentifier('a'.repeat(80))).toHaveLength(60);
  });

  it('produces an empty string for all-non-ASCII input', () => {
    expect(slugifyArtifactIdentifier('测试')).toBe('');
  });
});

describe('artifactIdentifiersMatch', () => {
  it('matches identical identifiers', () => {
    expect(artifactIdentifiersMatch('dashboard', 'dashboard')).toBe(true);
  });

  it('bridges a raw identifier and its slug form', () => {
    expect(artifactIdentifiersMatch('Landing Page', 'landing-page')).toBe(true);
    expect(artifactIdentifiersMatch('landing-page', 'Landing Page')).toBe(true);
  });

  it('rejects two distinct identifiers that only match after slugification without one being the slug itself', () => {
    // "A B" and "A_B" both slugify to "a-b", but neither raw identifier IS "a-b".
    expect(artifactIdentifiersMatch('A B', 'A_B')).toBe(false);
  });

  it('rejects when either identifier is empty-slug (e.g. both non-ASCII)', () => {
    expect(artifactIdentifiersMatch('测试', '首页')).toBe(false);
  });

  it('rejects genuinely different identifiers', () => {
    expect(artifactIdentifiersMatch('dashboard', 'settings')).toBe(false);
  });
});

describe('classifyArtifactStubGuard (pure decision function)', () => {
  const config: ArtifactStubGuardConfig = { ...DEFAULT_ARTIFACT_STUB_GUARD_CONFIG };

  it('passes when mode is off', () => {
    expect(classifyArtifactStubGuard([{ name: 'a.html', size: 10000 }], 'id', 1, { ...config, mode: 'off' })).toEqual({
      outcome: 'pass',
    });
  });

  it('passes when identifier is empty', () => {
    expect(classifyArtifactStubGuard([{ name: 'a.html', size: 10000 }], '', 1, config)).toEqual({ outcome: 'pass' });
  });

  it('passes when there are no priors', () => {
    expect(classifyArtifactStubGuard([], 'id', 1, config)).toEqual({ outcome: 'pass' });
  });

  it('passes when the largest prior is below minPriorBytes', () => {
    const priors: PriorArtifactSibling[] = [{ name: 'a.html', size: 100 }];
    expect(classifyArtifactStubGuard(priors, 'id', 1, config)).toEqual({ outcome: 'pass' });
  });

  it('passes when the new size meets the retained-ratio threshold', () => {
    const priors: PriorArtifactSibling[] = [{ name: 'a.html', size: 10000 }];
    expect(classifyArtifactStubGuard(priors, 'id', 3000, config)).toEqual({ outcome: 'pass' });
  });

  it('warns (mode=warn) when the new size is below threshold, picking the largest of several priors', () => {
    const priors: PriorArtifactSibling[] = [
      { name: 'small.html', size: 5000 },
      { name: 'big.html', size: 10000 },
    ];
    const result = classifyArtifactStubGuard(priors, 'id', 100, config);
    expect(result.outcome).toBe('warn');
    expect(result.warning?.priorName).toBe('big.html');
    expect(result.warning?.priorSize).toBe(10000);
    expect(result.warning?.newSize).toBe(100);
    expect(result.warning?.identifier).toBe('id');
    expect(result.warning?.code).toBe('ARTIFACT_REGRESSION');
    expect(result.warning?.message).toContain('big.html');
  });

  it('rejects (mode=reject) when the new size is below threshold', () => {
    const priors: PriorArtifactSibling[] = [{ name: 'big.html', size: 10000 }];
    const result = classifyArtifactStubGuard(priors, 'id', 100, { ...config, mode: 'reject' });
    expect(result.outcome).toBe('reject');
    expect(result.warning).toBeDefined();
  });
});

describe('ArtifactRegressionError', () => {
  it('carries the regression details', () => {
    const err = new ArtifactRegressionError('shrunk', {
      identifier: 'id',
      newSize: 10,
      priorSize: 5000,
      priorName: 'a.html',
    });
    expect(err.code).toBe('ARTIFACT_REGRESSION');
    expect(err.identifier).toBe('id');
    expect(err.newSize).toBe(10);
    expect(err.priorSize).toBe(5000);
    expect(err.priorName).toBe('a.html');
    expect(err.name).toBe('ArtifactRegressionError');
  });
});

describe('readArtifactStubGuardConfigFromEnv', () => {
  it('falls back to defaults when env vars are unset', () => {
    expect(readArtifactStubGuardConfigFromEnv({})).toEqual(DEFAULT_ARTIFACT_STUB_GUARD_CONFIG);
  });

  it('reads a valid mode/ratio/minPriorBytes from env', () => {
    const config = readArtifactStubGuardConfigFromEnv({
      ARTIFACT_STUB_GUARD: 'reject',
      ARTIFACT_STUB_GUARD_MIN_RATIO: '0.5',
      ARTIFACT_STUB_GUARD_MIN_PRIOR_BYTES: '2048',
    });
    expect(config.mode).toBe('reject');
    expect(config.minRetainedRatio).toBe(0.5);
    expect(config.minPriorBytes).toBe(2048);
  });

  it('accepts "warn" and "off" modes too', () => {
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD: 'warn' }).mode).toBe('warn');
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD: 'off' }).mode).toBe('off');
  });

  it('falls back to the default mode for an unrecognized value', () => {
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD: 'bogus' }).mode).toBe(
      DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.mode,
    );
  });

  it('falls back to the default ratio for out-of-range or non-numeric values', () => {
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_RATIO: '0' }).minRetainedRatio).toBe(
      DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.minRetainedRatio,
    );
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_RATIO: '1.5' }).minRetainedRatio).toBe(
      DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.minRetainedRatio,
    );
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_RATIO: 'nope' }).minRetainedRatio).toBe(
      DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.minRetainedRatio,
    );
    expect(readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_RATIO: '1' }).minRetainedRatio).toBe(1);
  });

  it('falls back to the default minPriorBytes for a non-positive or non-integer value', () => {
    expect(
      readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_PRIOR_BYTES: '0' }).minPriorBytes,
    ).toBe(DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.minPriorBytes);
    expect(
      readArtifactStubGuardConfigFromEnv({ ARTIFACT_STUB_GUARD_MIN_PRIOR_BYTES: '1.5' }).minPriorBytes,
    ).toBe(DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.minPriorBytes);
  });

  it('uses process.env by default', () => {
    const config = readArtifactStubGuardConfigFromEnv();
    expect(config.mode).toBe(DEFAULT_ARTIFACT_STUB_GUARD_CONFIG.mode);
  });

  it('preserves siblingExtensions from the supplied defaults', () => {
    const customDefaults: ArtifactStubGuardConfig = {
      ...DEFAULT_ARTIFACT_STUB_GUARD_CONFIG,
      siblingExtensions: ['.md'],
    };
    expect(readArtifactStubGuardConfigFromEnv({}, customDefaults).siblingExtensions).toEqual(['.md']);
  });
});

describe('findPriorArtifactSiblings / evaluateArtifactStubGuard (filesystem-backed)', () => {
  let scanDir: string;

  beforeEach(async () => {
    scanDir = await mkdtemp(path.join(tmpdir(), 'stub-guard-'));
  });

  afterEach(async () => {
    await rm(scanDir, { recursive: true, force: true });
    fsMockState.statImpl = null;
  });

  const config: ArtifactStubGuardConfig = DEFAULT_ARTIFACT_STUB_GUARD_CONFIG;

  it('returns [] for an empty identifier or an unreadable directory', async () => {
    expect(await findPriorArtifactSiblings(scanDir, '', config)).toEqual([]);
    expect(await findPriorArtifactSiblings(path.join(scanDir, 'nope'), 'id', config)).toEqual([]);
  });

  it('returns [] when siblingExtensions is empty', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(5000));
    expect(await findPriorArtifactSiblings(scanDir, 'dashboard', { ...config, siblingExtensions: [] })).toEqual([]);
  });

  it('finds a same-name sibling by exact identifier match', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(5000));
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings).toEqual([{ name: 'dashboard.html', size: 5000 }]);
  });

  it('finds a collision-suffixed sibling (dashboard-2.html)', async () => {
    await writeFile(path.join(scanDir, 'dashboard-2.html'), 'x'.repeat(3000));
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings.map((s) => s.name)).toEqual(['dashboard-2.html']);
  });

  it('finds a sibling via its slug form (Landing Page -> landing-page.html)', async () => {
    await writeFile(path.join(scanDir, 'landing-page.html'), 'x'.repeat(3000));
    const siblings = await findPriorArtifactSiblings(scanDir, 'Landing Page', config);
    expect(siblings.map((s) => s.name)).toEqual(['landing-page.html']);
  });

  it('the empty-slug fallback name widens the readdir filename filter, but artifactIdentifiersMatch still rejects an all-non-ASCII search identifier (matches artifactIdentifiersMatch\'s own documented empty-slug-vs-empty-slug caution)', async () => {
    await writeFile(path.join(scanDir, `${EMPTY_SLUG_FALLBACK_NAME}-2.html`), 'x'.repeat(3000));
    // "artifact-2.html" passes the readdir regex pre-filter (built with the
    // EMPTY_SLUG_FALLBACK_NAME token, since slugifyArtifactIdentifier('测试')
    // is empty) — but the final artifactIdentifiersMatch('测试', 'artifact')
    // check short-circuits false whenever the search identifier's own slug
    // is empty, so nothing is ever returned via this path. Intentional per
    // artifactIdentifiersMatch's own doc comment (avoids two distinct
    // non-ASCII identifiers being falsely bridged); this proves the
    // pre-filter widening doesn't accidentally bypass that guard.
    const siblings = await findPriorArtifactSiblings(scanDir, '测试', config);
    expect(siblings).toEqual([]);
  });

  it('ignores non-file entries (directories) and non-matching extensions', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(scanDir, 'dashboard.html'));
    await writeFile(path.join(scanDir, 'dashboard.css'), 'x');
    expect(await findPriorArtifactSiblings(scanDir, 'dashboard', config)).toEqual([]);
  });

  it('prefers the sidecar .artifact.json identifier over filename inference, avoiding a false-positive filename collision', async () => {
    // "weird-2.html" filename-matches a search for "weird" (identifier +
    // "-2" collision suffix) — but the sidecar says this file's real
    // identifier is unrelated, so the sidecar overrides the naive
    // filename-only guess and the match is correctly rejected.
    await writeFile(path.join(scanDir, 'weird-2.html'), 'x'.repeat(3000));
    await writeFile(
      path.join(scanDir, 'weird-2.html.artifact.json'),
      JSON.stringify({ metadata: { identifier: 'totally-unrelated' } }),
    );
    expect(await findPriorArtifactSiblings(scanDir, 'weird', config)).toEqual([]);
  });

  it('ignores a sidecar with a malformed/missing identifier and falls back to filename inference', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(3000));
    await writeFile(path.join(scanDir, 'dashboard.html.artifact.json'), 'not json {{');
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings.map((s) => s.name)).toEqual(['dashboard.html']);
  });

  it('ignores a sidecar whose identifier field is not a non-empty string', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(3000));
    await writeFile(
      path.join(scanDir, 'dashboard.html.artifact.json'),
      JSON.stringify({ metadata: { identifier: 42 } }),
    );
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings.map((s) => s.name)).toEqual(['dashboard.html']);
  });

  it('tries both legacy-candidate interpretations for an ambiguous name like phase-2.html', async () => {
    await writeFile(path.join(scanDir, 'phase-2.html'), 'x'.repeat(3000));
    // Interpretation A: identifier "phase" + collision suffix "-2".
    expect((await findPriorArtifactSiblings(scanDir, 'phase', config)).map((s) => s.name)).toEqual(['phase-2.html']);
    // Interpretation B: the standalone identifier "phase-2".
    expect((await findPriorArtifactSiblings(scanDir, 'phase-2', config)).map((s) => s.name)).toEqual(['phase-2.html']);
  });

  it('does not match an unrelated identifier sharing only a filename substring', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(3000));
    expect(await findPriorArtifactSiblings(scanDir, 'board', config)).toEqual([]);
  });

  it('evaluateArtifactStubGuard end-to-end: pass, warn, and off short-circuits', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(10000));
    const warn = await evaluateArtifactStubGuard({
      scanDir,
      identifier: 'dashboard',
      newSize: 10,
      config,
    });
    expect(warn.outcome).toBe('warn');

    const pass = await evaluateArtifactStubGuard({
      scanDir,
      identifier: 'dashboard',
      newSize: 9000,
      config,
    });
    expect(pass.outcome).toBe('pass');

    const off = await evaluateArtifactStubGuard({
      scanDir,
      identifier: 'dashboard',
      newSize: 1,
      config: { ...config, mode: 'off' },
    });
    expect(off.outcome).toBe('pass');
  });

  it('evaluateArtifactStubGuard short-circuits on an empty identifier without touching the filesystem', async () => {
    const result = await evaluateArtifactStubGuard({
      scanDir: path.join(scanDir, 'does-not-exist'),
      identifier: '',
      newSize: 1,
      config,
    });
    expect(result.outcome).toBe('pass');
  });

  it('ignores a dangling symlink matching the name pattern rather than throwing', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(3000));
    const { symlink } = await import('node:fs/promises');
    // A symlink's own dirent reports isFile() === false (Node reflects the
    // link's own type, not its target's), so this is filtered out by the
    // `!entry.isFile()` check before ever reaching `stat()` — verifies the
    // scan doesn't crash on (or wrongly include) a broken symlink.
    await symlink(path.join(scanDir, 'nonexistent-target'), path.join(scanDir, 'dashboard-2.html'));
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings.map((s) => s.name)).toEqual(['dashboard.html']);
  });

  it('skips a matching entry whose stat() call fails, without throwing (e.g. a real readdir/stat race)', async () => {
    await writeFile(path.join(scanDir, 'dashboard.html'), 'x'.repeat(3000));
    await writeFile(path.join(scanDir, 'dashboard-2.html'), 'x'.repeat(3000));
    fsMockState.statImpl = async (...args: unknown[]) => {
      const target = String(args[0]);
      if (target.endsWith('dashboard-2.html')) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      const { stat: realStat } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      return realStat(target);
    };
    const siblings = await findPriorArtifactSiblings(scanDir, 'dashboard', config);
    expect(siblings.map((s) => s.name)).toEqual(['dashboard.html']);
  });
});
