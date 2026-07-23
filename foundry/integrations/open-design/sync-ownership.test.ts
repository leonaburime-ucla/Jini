// Milestone 1 red-spec ("Harnesses + sync-ownership manifest") — gate O:
// "a known upstream daemon patch applies via the path transform"
// (foundry/docs/jini-port/extraction-plan.md §4.3, §8 task 1).
//
// Nothing under test here exists yet — this file PINS the target behavior
// for `m1-impl` and must go green without editing these assertions:
//
//   1. `foundry/integrations/open-design/sync-ownership.manifest.json` maps upstream
//      OD daemon paths to `product-owned` | `delegated-to-jini`.
//   2. `scripts/patch-canary.ts` exports `transformUpstreamPath(path): string`
//      rewriting `apps/daemon/...` -> `foundry/integrations/open-design/daemon/...`,
//      and runnable as `tsx scripts/patch-canary.ts --patch <file> --repo <dir>`,
//      printing `PATCH_CANARY_OK` on a clean `git apply` of the transformed patch.
//
// See `foundry/integrations/open-design/reference/fixtures/README.md` for why the
// fixture patch is synthetic rather than a real upstream commit.
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const manifestPath = path.join(repoRoot, 'foundry/integrations/open-design/sync-ownership.manifest.json');
const patchCanaryScript = path.join(repoRoot, 'scripts/patch-canary.ts');
const fixturePatch = path.join(
  repoRoot,
  'foundry/integrations/open-design/reference/fixtures/upstream-daemon-sample.patch',
);

const FIXTURE_UPSTREAM_PATH = 'apps/daemon/src/routes/health.ts';
const MIRRORED_PATH = 'foundry/integrations/open-design/daemon/src/routes/health.ts';

describe('milestone 1 gate O — sync-ownership manifest + patch canary', () => {
  it('ships a sync-ownership manifest classifying the fixture path', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.entries?.[FIXTURE_UPSTREAM_PATH]).toMatch(/^(product-owned|delegated-to-jini)$/);
  });

  it('ships the fixture patch used to prove the path transform', () => {
    expect(existsSync(fixturePatch)).toBe(true);
  });

  it('ships a patch-canary harness exposing transformUpstreamPath()', async () => {
    if (!existsSync(patchCanaryScript)) {
      throw new Error(
        'scripts/patch-canary.ts does not exist yet — milestone 1 impl must add the OD ' +
          'path-transform + patch-apply harness. See extraction-plan.md §4.3 + §8 task 1.',
      );
    }
    const mod: any = await import(pathToFileURL(patchCanaryScript).href);
    expect(typeof mod.transformUpstreamPath).toBe('function');
    expect(mod.transformUpstreamPath(FIXTURE_UPSTREAM_PATH)).toBe(MIRRORED_PATH);
  });

  it('applies a known upstream daemon patch cleanly via the path transform', () => {
    if (!existsSync(patchCanaryScript)) {
      throw new Error('scripts/patch-canary.ts missing — see the harness-exposure test above.');
    }

    // Exercise the harness end-to-end in a scratch git repo so this never
    // mutates the real foundry/integrations/open-design tree.
    const scratch = mkdtempSync(path.join(tmpdir(), 'jini-patch-canary-'));
    execFileSync('git', ['init', '-q'], { cwd: scratch });
    execFileSync('git', ['config', 'user.email', 'canary@jini.test'], { cwd: scratch });
    execFileSync('git', ['config', 'user.name', 'canary'], { cwd: scratch });
    mkdirSync(path.join(scratch, path.dirname(MIRRORED_PATH)), { recursive: true });
    writeFileSync(path.join(scratch, '.gitkeep'), '');
    execFileSync('git', ['add', '-A'], { cwd: scratch });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: scratch });

    const output = execFileSync(
      'tsx',
      [patchCanaryScript, '--patch', fixturePatch, '--repo', scratch],
      { encoding: 'utf8' },
    );

    expect(output).toContain('PATCH_CANARY_OK');
    expect(existsSync(path.join(scratch, MIRRORED_PATH))).toBe(true);
  });
});
