/**
 * @module @jini/agent-runtime
 *
 * Public barrel. See `docs/jini-port/extraction-plan.md` for the target
 * architecture and `source-map.md` for full provenance.
 */

// Core contract + vendored diagnostic types.
export * from './types.js';

// Generic supporting modules.
export * from './paths.js';
export * from './models.js';
export * from './capabilities.js';
export * from './invocation.js';
export * from './mmd-routes.js';
export * from './metadata.js';
export * from './mcp.js';
export * from './executables.js';
export * from './role-marker-guard.js';
export * from './auth.js';
export * from './opencode-log.js';
export * from './env.js';
export * from './launch.js';
export * from './resolution.js';
export * from './terminal-launch.js';
export * from './diagnostics.js';
export * from './detection.js';
export * from './prompt-budget.js';
export * from './prompt-file.js';
export * from './amr-model-cache.js';

// Registry + defs.
export * from './registry.js';
export * from './defs/index.js';

// Stream parsers.
export { createClaudeStreamHandler } from './claude-stream.js';
export { createJsonEventStreamHandler } from './json-event-stream.js';
export { createQoderStreamHandler } from './qoder-stream.js';
export { createCopilotStreamHandler } from './copilot-stream.js';

// Ports (injected seams — see each module's doc comment for what OD logic it replaces).
export * from './amr-profile-resolver.js';
export * from './acp-model-probe.js';
export * from './pi-models.js';
export * from './prompt-augmenter.js';
export * from './artifact-taxonomy.js';
export * from './telemetry-sink.js';

// LLM-provider integrations (BYOK model catalogs, OAuth+PKCE, gateway helpers).
export * from './providers/index.js';
