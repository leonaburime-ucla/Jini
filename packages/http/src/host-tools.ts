/**
 * @module host-tools
 *
 * Generic "open a working directory in a local host tool" surface, ported
 * from the routes-classification table's `host-tools.ts` MIXED row (see
 * `source-map.md`): the editor catalogue, `$PATH`/mac-bundle probing, and
 * guarded detached-spawn machinery have zero OD dependency and are ported
 * here in full. Only `GET /api/editors` (which uses solely this machinery)
 * is mounted as a route; `POST /api/projects/:id/open-in` additionally
 * resolves a project's working directory via OD's project store and is
 * explicitly not ported — see the source-map's note on this file.
 *
 * The probing functions take an injectable `HostToolProbeEnv` (filesystem
 * `access`, `env`, `platform`) rather than reading `process.env`/`fs`
 * directly, so every platform/found/missing branch is exercisable from a
 * single-OS test runner without touching the real filesystem.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { access as fsAccess, constants as fsConstants } from 'node:fs/promises';
import { createCommandInvocation } from '@jini/platform';
import type { Express } from 'express';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { ok } from './types.js';

export type RealPlatform = 'darwin' | 'win32' | 'linux';
export type Platform = RealPlatform | 'unknown';

export interface CatalogueEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** CLI shim name to probe on `$PATH`. Mutually exclusive in practice with `macOpenBundle`, though both may be set as a fallback pair. */
  readonly command?: string;
  readonly commandArgs?: (workingDir: string) => string[];
  /** macOS-only fallback: when the CLI shim is missing, look for an app bundle by name and launch it via `open -a "<name>"`. */
  readonly macOpenBundle?: string | readonly string[];
  readonly macOpenArgs?: (bundleName: string, workingDir: string) => string[];
  readonly platforms?: readonly RealPlatform[];
  readonly excludedPlatforms?: readonly RealPlatform[];
}

const MAC_OPEN_COMMAND = '/usr/bin/open';

/** The cross-platform-staple + macOS-bundle editor/tool catalogue, unchanged from the origin. */
export const CATALOGUE: readonly CatalogueEntry[] = [
  { id: 'cursor', label: 'Cursor', icon: 'sparkles', command: 'cursor', macOpenBundle: 'Cursor' },
  { id: 'vscode', label: 'VS Code', icon: 'file-code', command: 'code', macOpenBundle: 'Visual Studio Code' },
  { id: 'windsurf', label: 'Windsurf', icon: 'sparkles', command: 'windsurf', macOpenBundle: 'Windsurf' },
  { id: 'zed', label: 'Zed', icon: 'edit', command: 'zed', macOpenBundle: 'Zed' },
  { id: 'qoder', label: 'Qoder', icon: 'sparkles', command: 'qoder', macOpenBundle: ['Qoder', 'QoderWork'] },
  { id: 'antigravity', label: 'Antigravity', icon: 'orbit', command: 'antigravity', macOpenBundle: ['Antigravity', 'Google Antigravity'] },
  { id: 'webstorm', label: 'WebStorm', icon: 'edit', command: 'webstorm', macOpenBundle: 'WebStorm' },
  { id: 'idea', label: 'IntelliJ IDEA', icon: 'edit', command: 'idea', macOpenBundle: 'IntelliJ IDEA' },
  { id: 'xcode', label: 'Xcode', icon: 'file-code', macOpenBundle: ['Xcode', 'Xcode-beta', 'Xcode Beta'], platforms: ['darwin'] },
  { id: 'finder', label: 'Finder', icon: 'folder', command: MAC_OPEN_COMMAND, commandArgs: (workingDir) => ['-R', workingDir], platforms: ['darwin'] },
  { id: 'explorer', label: 'Explorer', icon: 'folder', command: 'explorer', platforms: ['win32'] },
  { id: 'file-manager', label: 'File Manager', icon: 'folder', command: 'xdg-open', platforms: ['linux'] },
  { id: 'terminal', label: 'Terminal', icon: 'sliders', macOpenBundle: 'Terminal', platforms: ['darwin'] },
  // darwin-only: Warp cold-starts ignore the cwd argument on win32/linux, so the
  // "open in Warp" UX is broken on those platforms (origin's #4544).
  { id: 'warp', label: 'Warp', icon: 'sliders', macOpenBundle: 'Warp', platforms: ['darwin'] },
];

/** Maps Node's `process.platform` to this module's tri-state `Platform`; anything else (aix, freebsd, sunos, ...) is `'unknown'`. */
export function currentPlatform(nodePlatform: NodeJS.Platform = process.platform): Platform {
  switch (nodePlatform) {
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'win32';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

export function applicableForPlatform(entry: CatalogueEntry, platform: Platform): boolean {
  if (platform === 'unknown') return false;
  if (entry.platforms && !entry.platforms.includes(platform)) return false;
  if (entry.excludedPlatforms && entry.excludedPlatforms.includes(platform)) return false;
  return true;
}

/**
 * Everything the probing functions below need from the outside world, gathered into one
 * injectable value. Production code gets {@link defaultProbeEnv}; tests inject a fake `access`
 * (so "found"/"missing" is a table, not a real filesystem) and any `platform`/`env` they want to
 * exercise, independent of the OS actually running the test.
 */
export interface HostToolProbeEnv {
  readonly access: (path: string, mode: number) => Promise<void>;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: Platform;
}

export function defaultProbeEnv(): HostToolProbeEnv {
  return { access: fsAccess, env: process.env, platform: currentPlatform() };
}

/**
 * `$PATH` directories to probe, plus the common macOS/Linux locations a login shell would have
 * that a GUI-launched daemon's thin inherited `PATH` often lacks (no `/usr/local/bin`, no
 * `/opt/homebrew/bin`) — without these, CLI shims installed via an editor's "Install command"
 * action are invisible to a daemon launched by double-clicking an app bundle.
 */
export function pathDirs(probeEnv: HostToolProbeEnv): string[] {
  const raw = probeEnv.env.PATH ?? '';
  const sep = probeEnv.platform === 'win32' ? ';' : ':';
  const home = probeEnv.env.HOME ?? '';
  const extras =
    probeEnv.platform === 'darwin'
      ? ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', `${home}/.local/bin`]
      : probeEnv.platform === 'linux'
        ? ['/usr/local/bin', '/usr/bin', '/bin', `${home}/.local/bin`]
        : [];
  return [...raw.split(sep), ...extras].filter((dir) => dir.length > 0);
}

export async function probeCommandOnPath(command: string, probeEnv: HostToolProbeEnv): Promise<string | null> {
  if (command.includes('/')) {
    try {
      await probeEnv.access(command, fsConstants.X_OK);
      return command;
    } catch {
      return null;
    }
  }
  const dirs = pathDirs(probeEnv);
  const suffixes = probeEnv.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of dirs) {
    for (const suffix of suffixes) {
      const candidate = `${dir}/${command}${suffix}`;
      try {
        await probeEnv.access(candidate, fsConstants.X_OK);
        return candidate;
      } catch {
        // not here
      }
    }
  }
  return null;
}

async function resolveMacOpenCommand(probeEnv: HostToolProbeEnv): Promise<string> {
  try {
    await probeEnv.access(MAC_OPEN_COMMAND, fsConstants.X_OK);
    return MAC_OPEN_COMMAND;
  } catch {
    return (await probeCommandOnPath('open', probeEnv)) ?? MAC_OPEN_COMMAND;
  }
}

export async function probeMacBundle(
  name: string | readonly string[],
  probeEnv: HostToolProbeEnv,
): Promise<{ name: string; path: string } | null> {
  if (probeEnv.platform !== 'darwin') return null;
  const names = Array.isArray(name) ? name : [name];
  const home = probeEnv.env.HOME ?? '';
  const candidates = [
    (bundleName: string) => `/Applications/${bundleName}.app`,
    (bundleName: string) => `${home}/Applications/${bundleName}.app`,
    (bundleName: string) => `/System/Applications/${bundleName}.app`,
    (bundleName: string) => `/System/Applications/Utilities/${bundleName}.app`,
    (bundleName: string) => `/System/Library/CoreServices/${bundleName}.app`,
  ];
  for (const bundleName of names) {
    for (const candidate of candidates) {
      const path = candidate(bundleName);
      try {
        await probeEnv.access(path, fsConstants.R_OK);
        return { name: bundleName, path };
      } catch {
        // not here
      }
    }
  }
  return null;
}

/**
 * A discriminated union rather than one shape with optional fields: `resolvedPath`/`launch` are
 * only ever set together (both "found" branches below set the pair; the "not found" branch sets
 * neither), so the type says that directly instead of leaving `resolvedPath` reachable-but-absent
 * when `available` is `false`.
 */
type ResolvedEntry =
  | { readonly available: true; readonly resolvedPath: string; readonly launch: { readonly command: string; readonly argsForDir: (workingDir: string) => string[] } }
  | { readonly available: false };

export async function resolveEntry(entry: CatalogueEntry, probeEnv: HostToolProbeEnv = defaultProbeEnv()): Promise<ResolvedEntry> {
  if (entry.command) {
    const resolved = await probeCommandOnPath(entry.command, probeEnv);
    if (resolved) {
      return {
        available: true,
        resolvedPath: resolved,
        launch: { command: resolved, argsForDir: entry.commandArgs ?? ((workingDir) => [workingDir]) },
      };
    }
  }
  if (entry.macOpenBundle && probeEnv.platform === 'darwin') {
    const bundle = await probeMacBundle(entry.macOpenBundle, probeEnv);
    if (bundle) {
      return {
        available: true,
        resolvedPath: bundle.path,
        launch: {
          command: await resolveMacOpenCommand(probeEnv),
          argsForDir: entry.macOpenArgs
            ? (workingDir: string) => entry.macOpenArgs!(bundle.name, workingDir)
            : (workingDir: string) => ['-a', bundle.name, workingDir],
        },
      };
    }
  }
  return { available: false };
}

export interface HostToolLaunchPlan {
  readonly available: boolean;
  readonly resolvedPath?: string;
  readonly command?: string;
  readonly args?: string[];
}

/** Resolves the concrete `{command, args}` a caller would spawn to open `workingDir` in `editorId`, or `available: false` if that tool isn't installed/known. */
export async function resolveHostToolLaunchPlan(
  editorId: string,
  workingDir: string,
  probeEnv: HostToolProbeEnv = defaultProbeEnv(),
): Promise<HostToolLaunchPlan> {
  const entry = CATALOGUE.find((c) => c.id === editorId);
  if (!entry) return { available: false };
  const probe = await resolveEntry(entry, probeEnv);
  if (!probe.available) return { available: false };
  return {
    available: true,
    resolvedPath: probe.resolvedPath,
    command: probe.launch.command,
    args: probe.launch.argsForDir(workingDir),
  };
}

export type LaunchHostToolResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Spawns a detached host-tool launch and waits for the OS to confirm it actually started. Node
 * emits `'spawn'` once the child is running and `'error'` when the launch is refused (missing
 * binary, quarantine, EACCES) — `'error'` arrives on a later tick, so this must be awaited before
 * a caller replies, otherwise a launch the OS rejected would be reported as success (origin's
 * #3871).
 *
 * Deliberately never passes `shell: true`: on Windows that would route the launch through
 * `cmd.exe`, which shell-interprets args — and one of them is a caller-supplied directory path,
 * so a path containing `&`/`|`/`^`/`>` etc. would inject commands. `command` is already resolved
 * to an absolute path (including `.exe`/`.cmd`), so it's routed through `createCommandInvocation`
 * (`@jini/platform`), which runs a `.cmd`/`.bat` via `cmd.exe` with
 * `CommandLineToArgvW`-safe verbatim args and everything else directly — no shell, no
 * metacharacter interpretation.
 */
export function launchHostTool(
  command: string,
  args: string[],
  spawnImpl: typeof nodeSpawn = nodeSpawn,
): Promise<LaunchHostToolResult> {
  return new Promise((resolve) => {
    const invocation = createCommandInvocation({ command, args });
    const child = spawnImpl(invocation.command, invocation.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: process.platform === 'win32',
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });
    let settled = false;
    child.once('spawn', () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ ok: true });
    });
    child.once('error', (spawnError) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: spawnError instanceof Error ? spawnError.message : String(spawnError) });
    });
  });
}

export interface HostEditor {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly available: boolean;
  readonly resolvedPath?: string;
  readonly platforms?: readonly RealPlatform[];
}

export interface HostEditorsResponse {
  readonly editors: readonly HostEditor[];
  readonly platform: Platform;
}

/** Probes every catalogue entry applicable to the current platform and reports which are actually installed. */
export async function listAvailableEditors(probeEnv: HostToolProbeEnv = defaultProbeEnv()): Promise<HostEditorsResponse> {
  const filtered = CATALOGUE.filter((entry) => applicableForPlatform(entry, probeEnv.platform));
  const editors: HostEditor[] = await Promise.all(
    filtered.map(async (entry) => {
      const probe = await resolveEntry(entry, probeEnv);
      return {
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        available: probe.available,
        ...(probe.available ? { resolvedPath: probe.resolvedPath } : {}),
        ...(entry.platforms ? { platforms: entry.platforms } : {}),
      };
    }),
  );
  return { editors, platform: probeEnv.platform };
}

/** `GET /api/editors` — lists the host-tool catalogue applicable to this platform with live availability. */
export const hostEditorsRoute = defineJsonRoute<void, HostEditorsResponse, Record<string, never>>({
  method: 'get',
  path: '/api/editors',
  parse: () => ok(undefined),
  handle: async () => ok(await listAvailableEditors()),
});

/** Mounts `GET /api/editors` on `app`. A pack's `http(app, services)` calls this directly. */
export function registerHostToolsRoutes(app: Express, adapter: AdapterContext): void {
  mountJsonRoute(app, hostEditorsRoute, {}, adapter);
}
