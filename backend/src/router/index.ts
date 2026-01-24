/**
 * Router Module Exports
 */

export * from './adapter.interface.js';
export * from './router.service.js';
export * from './adapters/mcp-adapter.js';

// Note: MCPAdapter is dynamically initialized per-request with specific config,
// so we don't pre-register it here. The adapter registry is kept for legacy
// compatibility but MCPAdapter handles its own lifecycle.
export const initializeAdapters = (): void => {
  // No static adapters to register - MCPAdapter is instantiated dynamically
};
