/**
 * @module @jini/mcp/server
 * Sub-barrel for the MCP tool-hosting mechanism: the pure tool protocol
 * layer (`tool-protocol.ts`), the pure resource protocol layer
 * (`resource-protocol.ts`), the daemon transport (`daemon-client.ts`), the
 * `Server`/`StdioServerTransport` wiring (`tool-server.ts`), the concrete
 * kernel-run tool defs (`tools/run-tools.ts`), and the concrete kernel
 * resource defs (`resources/active-resource.ts`).
 */
export * from './tool-protocol.js';
export * from './resource-protocol.js';
export * from './daemon-client.js';
export * from './tool-server.js';
export * from './tools/run-tools.js';
export * from './resources/active-resource.js';
