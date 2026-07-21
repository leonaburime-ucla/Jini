/**
 * @module @jini/mcp/server
 * Sub-barrel for the MCP tool-hosting mechanism: the pure protocol layer
 * (`tool-protocol.ts`), the daemon transport (`daemon-client.ts`), the
 * `Server`/`StdioServerTransport` wiring (`tool-server.ts`), and the concrete
 * kernel-run tool defs (`tools/run-tools.ts`).
 */
export * from './tool-protocol.js';
export * from './daemon-client.js';
export * from './tool-server.js';
export * from './tools/run-tools.js';
