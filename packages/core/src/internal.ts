/**
 * @module @jini/core/internal
 *
 * Package-internal entry point — NOT part of `@jini/core`'s public
 * contract. Two unrelated escape hatches live here, each for its own
 * single intended consumer:
 *
 * - {@link getToolRegistration} so `@jini/daemon`'s `ToolExecutor` can
 *   resolve a registered tool's full `{descriptor, handler, policy}`
 *   triple.
 * - `AnyPack`/`RequiredTokenIds`/`MissingTokenIds` so `@jini/node-host`'s
 *   `createLocalNodeDaemon` can re-derive `createDaemon`'s exact
 *   compile-time "missing binding" gate on its own wrapper config type,
 *   instead of either duplicating the type-level logic or losing the
 *   compile-time check through the wrapper.
 *
 * Every other consumer of this package must import from `@jini/core`'s
 * default (`.`) entry, which never re-exports any of the above. See
 * `tool-registry.ts`'s module doc and this package's `source-map.md` for
 * why this boundary exists and how it's enforced (a `package.json`
 * `exports` map subpath, not a language-level access modifier).
 */
export { getToolRegistration } from './tool-registry.js';
export type { AnyPack, MissingTokenIds, RequiredTokenIds } from './daemon.js';
