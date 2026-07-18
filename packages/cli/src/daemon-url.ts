/**
 * @module daemon-url
 *
 * Generic daemon-URL resolution, generalized from OD's
 * `apps/daemon/src/daemon-url.ts` (see `source-map.md`). The *order* —
 * explicit flag, then an env var, then an injected discovery probe, then a
 * caller-supplied default — is the reusable part. OD's own implementation
 * hardcodes its sidecar IPC protocol and a `pnpm exec tools-dev status`
 * fallback; neither belongs in a product-neutral package, so both are
 * replaced with an injected `discover` callback the caller (e.g. a future
 * `@jini/sidecar`-backed adapter) supplies.
 */

export interface ResolveDaemonUrlOptions {
  /** Value passed via a `--daemon-url`-shaped flag. Empty string is treated as unset. */
  flagUrl?: string | null;
  /** Defaults to `process.env`; inject for tests. */
  env?: NodeJS.ProcessEnv;
  /**
   * Name of the environment variable to check (e.g. `'JINI_DAEMON_URL'`).
   * Omit to skip the env step entirely — this package has no baked-in
   * product env var name.
   */
  envVarName?: string;
  /**
   * Optional discovery probe (e.g. a sidecar IPC status roundtrip). Return
   * `null` when nothing was discovered so resolution falls through to
   * `defaultUrl`.
   */
  discover?: (env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<string | null>;
  /** Discovery timeout in ms. Defaults to 800ms so an absent daemon doesn't stall CLI startup. */
  timeoutMs?: number;
  /** Returned when the flag, env, and discovery steps all come up empty. */
  defaultUrl?: string;
}

/**
 * Resolve a daemon HTTP base URL for a CLI client command.
 *
 * Resolution order: `flagUrl`, then `env[envVarName]` (when `envVarName` is
 * given), then `discover()` (when given), then `defaultUrl`. Throws when
 * every step is exhausted and no `defaultUrl` was supplied — a silent
 * `http://127.0.0.1:0`-style fallback would be worse than a clear error,
 * and this package has no locked default port to fall back to on its own.
 */
export async function resolveDaemonUrl(options: ResolveDaemonUrlOptions = {}): Promise<string> {
  const env = options.env ?? process.env;

  const flagUrl = options.flagUrl ?? null;
  if (flagUrl !== null && flagUrl.length > 0) return flagUrl;

  if (options.envVarName !== undefined) {
    const envUrl = env[options.envVarName];
    if (envUrl !== undefined && envUrl.length > 0) return envUrl;
  }

  if (options.discover !== undefined) {
    const discovered = await options.discover(env, options.timeoutMs ?? 800);
    if (discovered !== null && discovered.length > 0) return discovered;
  }

  if (options.defaultUrl !== undefined) return options.defaultUrl;

  throw new Error(
    'no daemon URL resolved: pass flagUrl, set envVarName on a populated env var, ' +
      'supply a discover() probe, or provide defaultUrl.',
  );
}
