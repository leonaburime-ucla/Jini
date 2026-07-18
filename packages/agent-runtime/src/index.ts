/** @jini/agent-runtime — public barrel.
 * Re-exports the agent-protocol/ capability barrel's public surface (ACP +
 * pi-rpc subprocess protocol adapters over a shared JSON-line-stream core).
 * See src/agent-protocol/README.md and source-map.md for provenance.
 */
export {
  createJsonLineStream,
  type AcpMcpServerInput,
  type ModelOption,
  type AttachAcpSessionOptions,
  type AccountFailure,
  type AccountFailureClassifier,
  buildAcpSessionNewParams,
  normalizeModels,
  detectAcpModels,
  attachAcpSession,
  noopAccountFailureClassifier,
  mapPiRpcEvent,
  attachPiRpcSession,
  parsePiModels,
} from './agent-protocol/index.js';
