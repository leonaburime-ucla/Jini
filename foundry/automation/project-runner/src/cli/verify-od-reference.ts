import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const OD_REMOTE = 'https://github.com/nexu-io/open-design.git';
const REQUIRED_CANARY_PATHS = [
  'apps/web/src/features/memory',
  'apps/web/src/providers/memory',
  'apps/web/tests/features/memory',
  'docs/adr/0002-frontend-vertical-slice-decomposition.md',
  'apps/AGENTS.md',
  'scripts/check-web-slice-boundaries.ts',
] as const;

function git(directory: string, args: string[]): string {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function usage(): never {
  throw new Error(
    'Usage: verify-od-reference <apps/web source path> <expected SHA> <remote ref>',
  );
}

/** Proves a vendored component matches a pinned live OD ref plus the canary. */
async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const [target, expectedSha, ref] = args;
  if (!target || !expectedSha || !ref || !target.startsWith('apps/web/')) usage();

  const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const referenceDir = await mkdtemp(join(tmpdir(), 'jini-od-reference-'));
  try {
    git(referenceDir, ['init', '--quiet']);
    git(referenceDir, ['remote', 'add', 'origin', OD_REMOTE]);
    git(referenceDir, ['fetch', '--quiet', '--depth=1', 'origin', ref]);
    git(referenceDir, ['sparse-checkout', 'init', '--cone']);
    git(referenceDir, ['sparse-checkout', 'set', target, ...REQUIRED_CANARY_PATHS]);
    git(referenceDir, ['checkout', '--quiet', 'FETCH_HEAD']);

    const resolvedSha = git(referenceDir, ['rev-parse', 'HEAD']);
    if (resolvedSha !== expectedSha) {
      throw new Error(`OD reference moved: expected ${expectedSha}, received ${resolvedSha}`);
    }
    for (const requiredPath of [target, ...REQUIRED_CANARY_PATHS]) {
      await access(join(referenceDir, requiredPath));
    }

    const vendoredPath = resolve(
      repoRoot,
      'foundry/integrations/open-design/reference/components-original',
      basename(target),
    );
    const [vendored, live] = await Promise.all([
      readFile(vendoredPath),
      readFile(join(referenceDir, target)),
    ]);
    if (!vendored.equals(live)) {
      throw new Error(`${vendoredPath} does not match the pinned live OD source.`);
    }

    console.log(JSON.stringify({ ok: true, odRemote: OD_REMOTE, odRef: ref, odSha: resolvedSha, target, vendoredTargetMatches: true }, null, 2));
  } finally {
    await rm(referenceDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
