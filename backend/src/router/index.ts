/**
 * Router Module Exports
 */

export * from './adapter.interface.js';
export * from './router.service.js';
export * from './adapters/webhook.adapter.js';
export * from './adapters/notion.adapter.js';
export * from './adapters/obsidian.adapter.js';
export * from './adapters/mcp-http.adapter.js';

// Register built-in adapters
import { adapterRegistry } from './adapter.interface.js';
import { webhookAdapter } from './adapters/webhook.adapter.js';
import { notionAdapter } from './adapters/notion.adapter.js';
import { obsidianAdapter } from './adapters/obsidian.adapter.js';
import { mcpHttpAdapter } from './adapters/mcp-http.adapter.js';

export const initializeAdapters = (): void => {
  adapterRegistry.register(webhookAdapter);
  adapterRegistry.register(notionAdapter);
  adapterRegistry.register(obsidianAdapter);
  adapterRegistry.register(mcpHttpAdapter);
};
