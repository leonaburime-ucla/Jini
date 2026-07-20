/**
 * scripts/health-boot.ts — milestone 1 gate N ("Harnesses + sync-ownership manifest";
 * docs/jini-port/extraction-plan.md §7 + §8 task 1).
 *
 * The neutrality-proof harness: pack every real `@jini/*` package `examples/minimal-host`
 * transitively depends on into tarballs, install those tarballs (never a workspace link) into a
 * scratch copy of `examples/minimal-host`, boot/run its entry point from there, and report the
 * result as one JSON line on stdout. This is what catches the class of bug where code only works
 * via a pnpm workspace symlink back into this repo's packages/&lt;name&gt;/src, not a real published-shape package —
 * see examples/minimal-host/README.md and extraction-plan.md §2.4/§7/§12 ("packaging model is
 * already broken; fix it before external consumers").
 *
 * Run as `tsx scripts/health-boot.ts` from the repo root. Exits non-zero (after printing the
 * error to stderr) on any failure; always cleans up its scratch directories, on both success and
 * failure.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const packagesDir = join(repoRoot, 'packages');
const minimalHostDir = join(repoRoot, 'examples', 'minimal-host');

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly dependencies?: Record<string, string>;
  readonly [key: string]: unknown;
}

function readPackageJson(dir: string): PackageJson {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
}

function jiniDependencyNames(pkg: PackageJson): string[] {
  return Object.keys(pkg.dependencies ?? {}).filter((name) => name.startsWith('@jini/'));
}

/** The exact filename `npm pack`/`pnpm pack` produce for a scoped package: `@jini/core@0.0.0` -> `jini-core-0.0.0.tgz`. */
function tarballFileName(name: string, version: string): string {
  return `${name.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
}

/** Discovers every real `@jini/*` package in this workspace by scanning `packages/*` — never a hardcoded list. */
function discoverJiniPackages(): Map<string, { readonly dir: string; readonly pkg: PackageJson }> {
  const registry = new Map<string, { readonly dir: string; readonly pkg: PackageJson }>();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(packagesDir, entry.name);
    if (!existsSync(join(dir, 'package.json'))) continue;
    const pkg = readPackageJson(dir);
    if (pkg.name?.startsWith('@jini/')) registry.set(pkg.name, { dir, pkg });
  }
  return registry;
}

/**
 * Walks the transitive `@jini/*` dependency closure starting from `examples/minimal-host`'s own
 * `package.json`, reading each dependency's own `package.json` `"dependencies"` field (never a
 * guessed/hardcoded list). Returns packages in dependency-first (topological) order, since
 * building a dependent's TypeScript project requires its `@jini/*` dependencies' `dist/` to
 * already exist.
 */
function computeClosure(registry: Map<string, { readonly dir: string; readonly pkg: PackageJson }>): string[] {
  const hostPkg = readPackageJson(minimalHostDir);
  const rootDeps = jiniDependencyNames(hostPkg);
  if (rootDeps.length === 0) {
    throw new Error(
      'health-boot: examples/minimal-host/package.json has no @jini/* dependencies — nothing to pack. ' +
        'Add at least one @jini/* dependency (e.g. @jini/node-host) first.',
    );
  }

  const order: string[] = [];
  const visited = new Set<string>();

  function visit(name: string, chain: readonly string[]): void {
    if (visited.has(name)) return;
    if (chain.includes(name)) {
      throw new Error(`health-boot: cyclic @jini/* dependency detected: ${[...chain, name].join(' -> ')}`);
    }
    const entry = registry.get(name);
    if (!entry) {
      throw new Error(`health-boot: "${name}" is a @jini/* dependency but no matching packages/* directory was found`);
    }
    for (const dep of jiniDependencyNames(entry.pkg)) visit(dep, [...chain, name]);
    visited.add(name);
    order.push(name);
  }

  for (const dep of rootDeps) visit(dep, []);
  return order;
}

/** Builds one package's TypeScript project (`tsc`), producing the `dist/` that its own `"files"` field packs. */
function buildPackage(name: string): void {
  execFileSync('pnpm', ['--filter', name, 'run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
}

/**
 * `pnpm pack`s one package, then rewrites the tarball's own `package.json` so every `@jini/*`
 * dependency points at its sibling tarball's file path (`file:<abs path>.tgz`) instead of the
 * plain resolved semver `pnpm pack` bakes in for a `workspace:*` dependency (e.g. `"0.0.0"` —
 * unresolvable against the real npm registry, since these packages are never published). This is
 * what lets `npm install` build a real, self-contained dependency tree entirely from local
 * tarballs, with no workspace link and no dependency on any registry actually hosting `@jini/*`.
 */
function packAndRewrite(
  name: string,
  dir: string,
  destDir: string,
  tarballPathByName: ReadonlyMap<string, string>,
): string {
  const raw = execFileSync('pnpm', ['pack', '--json', '--pack-destination', destDir], {
    cwd: dir,
    encoding: 'utf8',
  });
  const packed = JSON.parse(raw) as { readonly filename: string };
  const expected = tarballPathByName.get(name);
  if (expected && expected !== packed.filename) {
    throw new Error(
      `health-boot: tarball filename mismatch for ${name} — expected "${expected}", pnpm produced "${packed.filename}". ` +
        'The precomputed tarball-path map is out of sync with pnpm pack\'s own naming.',
    );
  }
  const tarballPath = packed.filename;

  const stagingParent = mkdtempSync(join(tmpdir(), 'jini-health-boot-rewrite-'));
  try {
    const stagingPackageDir = join(stagingParent, 'package');
    execFileSync('tar', ['-xzf', tarballPath, '-C', stagingParent]);

    const packedPkgJsonPath = join(stagingPackageDir, 'package.json');
    const packedPkg = JSON.parse(readFileSync(packedPkgJsonPath, 'utf8')) as PackageJson;
    const rewrittenDeps: Record<string, string> = { ...(packedPkg.dependencies ?? {}) };
    for (const depName of Object.keys(rewrittenDeps)) {
      if (!depName.startsWith('@jini/')) continue;
      const depTarball = tarballPathByName.get(depName);
      if (!depTarball) {
        throw new Error(`health-boot: ${name}'s packed dependency "${depName}" has no known tarball path`);
      }
      rewrittenDeps[depName] = `file:${depTarball}`;
    }
    writeFileSync(packedPkgJsonPath, JSON.stringify({ ...packedPkg, dependencies: rewrittenDeps }, null, 2));

    // Re-tar in place, replacing pnpm's original (workspace-version-baked) tarball.
    execFileSync('tar', ['-czf', tarballPath, '-C', stagingParent, 'package']);
  } finally {
    rmSync(stagingParent, { recursive: true, force: true });
  }

  return tarballPath;
}

/** Recursively asserts that nothing under a directory is a symlink — the actual proof that installed `@jini/*` packages are real copies, not workspace links back into this repo. */
function assertNoSymlinks(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    const stat = lstatSync(entryPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`health-boot: found a symlink at ${entryPath} — the scratch install must contain real copies, never a workspace link`);
    }
    if (stat.isDirectory()) assertNoSymlinks(entryPath);
  }
}

async function main(): Promise<void> {
  const registry = discoverJiniPackages();
  const closure = computeClosure(registry); // dependency-first order

  const packDestDir = mkdtempSync(join(tmpdir(), 'jini-health-boot-tarballs-'));
  const scratchRoot = mkdtempSync(join(tmpdir(), 'jini-health-boot-host-'));

  try {
    // 1. Build every package in the closure, dependency-first (a dependent's `tsc` project
    //    resolves its @jini/* deps' types from their already-built `dist/`).
    for (const name of closure) buildPackage(name);

    // 2. Precompute every tarball's deterministic filename before packing anything, so each
    //    package's own packAndRewrite call can rewrite its @jini/* deps to point at siblings'
    //    tarball paths regardless of pack order.
    const tarballPathByName = new Map<string, string>();
    for (const name of closure) {
      const entry = registry.get(name);
      if (!entry) throw new Error(`health-boot: unreachable — "${name}" missing from registry`);
      const version = entry.pkg.version ?? '0.0.0';
      tarballPathByName.set(name, join(packDestDir, tarballFileName(name, version)));
    }

    // 3. Pack every package into the scratch tarballs dir, rewriting each one's @jini/* deps to
    //    file: tarball paths.
    const packedTarballs: string[] = [];
    for (const name of closure) {
      const entry = registry.get(name);
      if (!entry) throw new Error(`health-boot: unreachable — "${name}" missing from registry`);
      packedTarballs.push(packAndRewrite(name, entry.dir, packDestDir, tarballPathByName));
    }

    // 4. Copy examples/minimal-host into a scratch directory and rewrite its own @jini/* deps to
    //    point at the packed tarballs (never `workspace:*`).
    const scratchHostDir = join(scratchRoot, 'minimal-host');
    mkdirSync(scratchHostDir, { recursive: true });
    cpSync(join(minimalHostDir, 'src'), join(scratchHostDir, 'src'), { recursive: true });

    const hostPkg = readPackageJson(minimalHostDir);
    const rewrittenHostDeps: Record<string, string> = { ...(hostPkg.dependencies ?? {}) };
    for (const depName of Object.keys(rewrittenHostDeps)) {
      if (!depName.startsWith('@jini/')) continue;
      const depTarball = tarballPathByName.get(depName);
      if (!depTarball) throw new Error(`health-boot: examples/minimal-host's dependency "${depName}" was not packed`);
      rewrittenHostDeps[depName] = `file:${depTarball}`;
    }
    writeFileSync(
      join(scratchHostDir, 'package.json'),
      JSON.stringify({ ...hostPkg, dependencies: rewrittenHostDeps }, null, 2),
    );

    // 5. Install for real — `npm install` against local tarball file: paths, entirely outside
    //    this repo's pnpm workspace, so there is no workspace: protocol and nothing to symlink.
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: scratchHostDir, stdio: 'inherit' });

    const scratchNodeModulesJini = join(scratchHostDir, 'node_modules', '@jini');
    if (!existsSync(scratchNodeModulesJini)) {
      throw new Error(`health-boot: expected ${scratchNodeModulesJini} to exist after npm install`);
    }
    assertNoSymlinks(scratchNodeModulesJini);

    // 6. Boot/run the entry point from the scratch copy — a real exercise of the packed
    //    dependency (constructs+starts a daemon, does a real HTTP round trip, shuts it down).
    const bootOutput = execFileSync('node', ['src/index.ts'], { cwd: scratchHostDir, encoding: 'utf8' });
    if (!bootOutput.includes('MINIMAL_HOST_BOOT_OK')) {
      throw new Error(`health-boot: entry point did not report MINIMAL_HOST_BOOT_OK. Output:\n${bootOutput}`);
    }

    console.log(JSON.stringify({ ok: true, marker: 'HEALTH_BOOT_OK', packedTarballs }));
  } finally {
    // Clean up scratch directories on both success and failure — never anything inside this repo.
    rmSync(packDestDir, { recursive: true, force: true });
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
