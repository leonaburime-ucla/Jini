/**
 * @module api-token-auth
 *
 * Whether a bearer-style API token gate should be enforced, and what the
 * expected token value is. Generalized from an upstream flat daemon module:
 * the origin hardcoded its host product's env-var names, now fields on
 * {@link ApiTokenAuthEnvConfig} — see `source-map.md` for the exact mapping.
 */

/** Names the env vars this port reads. */
export interface ApiTokenAuthEnvConfig {
  /** Env var carrying the expected token value; unset/blank means no token is configured. */
  tokenEnvVar: string;
  /** Env var that, when truthy, force-disables the gate even if a token is configured. */
  disableEnvVar: string;
}

/**
 * Interprets `value` as a truthy flag: `'1'`, `'true'`, `'yes'`, or `'on'`
 * (case-insensitive, trimmed). Anything else, including `undefined`, is
 * falsy.
 */
export function isTruthyEnvFlag(value: unknown): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/** Whether the API auth gate has been explicitly force-disabled. */
export function isApiAuthDisabled(config: ApiTokenAuthEnvConfig, env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthyEnvFlag(env[config.disableEnvVar]);
}

/** The configured expected token value, trimmed; `''` when unset. */
export function apiTokenFromEnv(config: ApiTokenAuthEnvConfig, env: NodeJS.ProcessEnv = process.env): string {
  return (env[config.tokenEnvVar] ?? '').trim();
}

/** Whether the token gate should actually run: a token is configured and it hasn't been disabled. */
export function isApiTokenMiddlewareEnabled(
  config: ApiTokenAuthEnvConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return apiTokenFromEnv(config, env).length > 0 && !isApiAuthDisabled(config, env);
}
