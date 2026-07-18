/**
 * @module artifacts
 *
 * The generic artifact-store kernel port, ported from OD's
 * `apps/daemon/src/artifacts/` (6 files). See `source-map.md` for full
 * per-file provenance and the design decisions behind each generalization.
 */
export * from './manifest.js';
export * from './store.js';
export * from './publication-guard.js';
export * from './runtime-compat.js';
export * from './stub-guard.js';
export * from './text-suppression.js';
