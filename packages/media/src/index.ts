/**
 * `@jini/media` — multi-provider image/video/audio generation gateway
 * substrate: provider/model types, the real vendor catalogue as reference
 * data, an injection-style capability registry, a pure video-request
 * builder, an async task-tracking port, a host-injected policy port, and a
 * generic attachment-staging port. See `source-map.md` for full provenance
 * and this package's not-yet-locked status.
 */
export * from './types.js';
export * from './providers.js';
export * from './capability-registry.js';
export * from './seed.js';
export * from './video-request.js';
export * from './task-store.js';
export * from './policy.js';
export * from './staging.js';
export * from './tokens.js';
