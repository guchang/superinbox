/**
 * Router Module Exports
 */

export * from './adapter.interface.js';
export * from './router.service.js';
export * from './adapters/mcp-http.adapter.js';

// Register built-in adapters
import { adapterRegistry } from './adapter.interface.js';
import { mcpHttpAdapter } from './adapters/mcp-http.adapter.js';

export const initializeAdapters = (): void => {
  adapterRegistry.register(mcpHttpAdapter);
};
