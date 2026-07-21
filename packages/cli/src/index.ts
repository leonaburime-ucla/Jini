/**
 * @module @jini/cli
 *
 * CLI transport-shell: HTTP-client-mode generic transport/infra ported from
 * OD's `apps/daemon/src/cli.ts` (extraction-plan §3 / §8 task 9). See
 * `source-map.md` for the full classification of what was and wasn't
 * ported. This is a first generic slice, not the full `@jini/cli` package —
 * no pack has registered against `CommandRegistry` yet because no HTTP-
 * client-mode pack exists in this repo to call.
 */
export * from './flags.js';
export * from './daemon-url.js';
export * from './errors.js';
export * from './http.js';
export * from './prompt.js';
export * from './redact.js';
export * from './usage.js';
export * from './command-registry.js';
export * from './run-command.js';
export * from './daemon-command.js';
export * from './local-daemon-discovery.js';
export * from './tokens.js';
