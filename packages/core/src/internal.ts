/**
 * @module @jini/core/internal
 *
 * Package-internal entry point — NOT part of `@jini/core`'s public
 * contract. Exists solely so `@jini/daemon`'s `ToolExecutor` can resolve a
 * registered tool's full `{descriptor, handler, policy}` triple; every
 * other consumer of this package must import from `@jini/core`'s default
 * (`.`) entry, which never re-exports {@link getToolRegistration}. See
 * `tool-registry.ts`'s module doc and this package's `source-map.md` for
 * why this boundary exists and how it's enforced (a `package.json`
 * `exports` map subpath, not a language-level access modifier).
 */
export { getToolRegistration } from './tool-registry.js';
