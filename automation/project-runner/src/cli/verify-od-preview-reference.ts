import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const OD_REMOTE = 'https://github.com/nexu-io/open-design.git';
const OD_REF = 'refs/pull/5228/head';
const OD_SHA = 'd695f1e0f2b85a032aa7ce4895a3eb764cb1b65d';
const REQUIRED_PATHS = [
  'apps/web/src/components/PreviewDrawOverlay.tsx',
  'apps/web/src/features/memory',
  'apps/web/src/providers/memory',
  'apps/web/tests/features/memory',
  'docs/adr/0002-frontend-vertical-slice-decomposition.md',
  'apps/AGENTS.md',
  'scripts/check-web-slice-boundaries.ts',
] as const;

function git(directory: string, args: string[]): string {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

/** Resolves the Jini repo root regardless of which package's directory this
 *  script is invoked from (e.g. `pnpm --filter` runs with cwd set to the
 *  package, not the repo root). */
function jiniRepoRoot(): string {
  return git(process.cwd(), ['rev-parse', '--show-toplevel']);
}

/**
 * Verifies the exact external reference required by the PreviewDrawOverlay
 * extraction before a cloud task is launched. This prevents a hosted task
 * from silently treating Jini's stale vendored tree as its live OD checkout.
 */
async function main(): Promise<void> {
  const referenceDir = await mkdtemp(join(tmpdir(), 'jini-od-preview-reference-'));
  try {
    git(referenceDir, ['init', '--quiet']);
    git(referenceDir, ['remote', 'add', 'origin', OD_REMOTE]);
    git(referenceDir, ['fetch', '--quiet', '--depth=1', 'origin', OD_REF]);
    git(referenceDir, ['sparse-checkout', 'init', '--cone']);
    git(referenceDir, ['sparse-checkout', 'set', ...REQUIRED_PATHS]);
    git(referenceDir, ['checkout', '--quiet', 'FETCH_HEAD']);

    const resolvedSha = git(referenceDir, ['rev-parse', 'HEAD']);
    if (resolvedSha !== OD_SHA) {
      throw new Error(`OD reference moved: expected ${OD_SHA}, received ${resolvedSha}`);
    }

    for (const requiredPath of REQUIRED_PATHS) {
      await access(join(referenceDir, requiredPath));
    }

    const vendoredPath = resolve(
      jiniRepoRoot(),
      'integrations/open-design/reference/components-original/PreviewDrawOverlay.tsx',
    );
    const livePath = join(referenceDir, 'apps/web/src/components/PreviewDrawOverlay.tsx');
    const [vendored, live] = await Promise.all([readFile(vendoredPath), readFile(livePath)]);
    if (!vendored.equals(live)) {
      throw new Error(
        'components-original/PreviewDrawOverlay.tsx does not match the pinned live OD source; refresh provenance before dispatching.',
      );
    }

    console.log(JSON.stringify({
      ok: true,
      odRemote: OD_REMOTE,
      odRef: OD_REF,
      odSha: resolvedSha,
      target: 'apps/web/src/components/PreviewDrawOverlay.tsx',
      vendoredTargetMatches: true,
      referenceDir,
    }, null, 2));
  } finally {
    await rm(referenceDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
