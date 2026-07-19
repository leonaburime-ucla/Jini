/**
 * @module @jini/agui
 *
 * AG-UI (Agent-User Interaction Protocol) encoder for `@jini/protocol`'s run-event stream — see
 * `source-map.md` for provenance, the old→new field-mapping table, and the generalization
 * writeup. Consumed by `@jini/http`'s SSE route, which pipes `RunLifecycle.stream(...)`'s events
 * through `createAguiEncoder()` and writes each non-null result to the response.
 */
export type {
  AGUIAgentMessageEvent,
  AGUIEvent,
  AGUIEventBase,
  AGUIEventKind,
  AGUIRunLifecycleEvent,
  AGUIStateUpdateEvent,
  AGUISurfaceRequestedEvent,
  AGUISurfaceRespondedEvent,
  AGUIToolCallEvent,
} from './types.js';

export type { AguiEncodeContext, AguiEncoder } from './encode.js';
export { createAguiEncoder } from './encode.js';
