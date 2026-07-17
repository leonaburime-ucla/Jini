/**
 * @jini/chat-react — headless hooks + presentational components + slots for
 * a chat/artifact frontend, built on `@jini/chat-core`'s framework-free
 * vocabulary. See docs/jini-port/recon/r4b-webui-design.md §1/§2/§4 for the
 * spec this package implements, and source-map.md for provenance.
 *
 * This barrel is filled in incrementally as each layer lands (hooks first,
 * then presentational components, then the `<JiniChatProvider>` composition
 * root) — see source-map.md's "Status" section for what's shipped so far.
 */
export * from './transport.js';
export * from './artifact-types.js';
export * from './slots.js';
export * from './tool-renderer-registry.js';

export * from './react/hooks/useRunStream.js';
export * from './react/hooks/useConversation.js';
export * from './react/hooks/useComposer.js';
export * from './react/hooks/useToolTimeline.js';
export * from './react/hooks/usePinnedTodos.js';
export * from './react/hooks/useQuestionForms.js';
export * from './react/hooks/useArtifactStream.js';
