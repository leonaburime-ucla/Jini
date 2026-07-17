/**
 * Generalized from OD `apps/packaged/src/paths.ts`. On inspection this file
 * was **far more OD-coupled than the task brief expected**: it hardcodes
 * the `OD_DATA_DIR` env var name, "Open Design"-branded error strings, and
 * a dozen OD-specific roots (`desktopIdentityPath`, `headlessIdentityPath`,
 * `webIdentityPath`, `installerObservationRoot`, `updateRoot`, and the
 * `installationRoot` used for cross-namespace installationId persistence —
 * an OD/PostHog-analytics concept). What's actually generic is the layout
 * *pattern* — a base root, a namespace segment, a small fixed set of
 * per-namespace subdirectories, and a data-dir override env var that must
 * resolve to an absolute path and must agree with the active namespace if
 * it already looks namespace-scoped. This port keeps that pattern and
 * drops every OD-specific field and string; the env var name is now
 * caller-supplied instead of hardcoded.
 */
import { homedir } from 'node:os';
import { isAbsolute, join, win32 } from 'node:path';

export interface DesktopHostPathRoots {
  namespaceRoot: string;
  dataRoot: string;
  cacheRoot: string;
  logsRoot: string;
  runtimeRoot: string;
  userDataRoot: string;
  sessionDataRoot: string;
}

export class DesktopHostPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopHostPathError';
  }
}

export interface ResolvePathRootsOptions {
  namespace: string;
  namespaceBaseRoot: string;
  dataDirOverrideEnvVar?: string;
  env?: NodeJS.ProcessEnv;
}

const HOME_BARE_TOKENS = new Set(['~', '$HOME', '${HOME}']);
const HOME_PREFIX_RE = /^(~|\$\{HOME\}|\$HOME)[/\\](.*)$/;

function expandHomePrefix(raw: string): string {
  if (HOME_BARE_TOKENS.has(raw)) return homedir();
  const match = HOME_PREFIX_RE.exec(raw);
  if (match) return join(homedir(), match[2] ?? '');
  return raw;
}

function scopedNamespaceOf(raw: string): string | null {
  const parts = raw.replace(/[\\/]+$/g, '').split(/[\\/]+/);
  const last = parts.length - 1;
  if (last < 2) return null;
  if (parts[last - 2] !== 'namespaces' || parts[last] !== 'data') return null;
  return parts[last - 1] ?? null;
}

function resolveDataRoot(namespaceRoot: string, namespace: string, dataDirOverrideEnvVar: string | undefined, env: NodeJS.ProcessEnv): string {
  const override = dataDirOverrideEnvVar == null ? undefined : env[dataDirOverrideEnvVar]?.trim();
  if (override != null && override.length > 0) {
    const expanded = expandHomePrefix(override);
    const isAbs = process.platform === 'win32' ? win32.isAbsolute(expanded) : isAbsolute(expanded);
    if (!isAbs) {
      throw new DesktopHostPathError(`${dataDirOverrideEnvVar} must be an absolute path; got: ${override}`);
    }
    const scopedNamespace = scopedNamespaceOf(expanded);
    if (scopedNamespace != null && scopedNamespace !== namespace) {
      throw new DesktopHostPathError(
        `${dataDirOverrideEnvVar} targets namespace "${scopedNamespace}" but the active namespace is "${namespace}"`,
      );
    }
    return scopedNamespace != null ? expanded : join(expanded, 'namespaces', namespace, 'data');
  }
  return join(namespaceRoot, 'data');
}

export function resolveDesktopHostPathRoots(options: ResolvePathRootsOptions): DesktopHostPathRoots {
  const env = options.env ?? process.env;
  const namespaceRoot = join(options.namespaceBaseRoot, options.namespace);
  return {
    namespaceRoot,
    dataRoot: resolveDataRoot(namespaceRoot, options.namespace, options.dataDirOverrideEnvVar, env),
    cacheRoot: join(namespaceRoot, 'cache'),
    logsRoot: join(namespaceRoot, 'logs'),
    runtimeRoot: join(namespaceRoot, 'runtime'),
    userDataRoot: join(namespaceRoot, 'user-data'),
    sessionDataRoot: join(namespaceRoot, 'user-data', 'session'),
  };
}
