
import { describe, it, expect } from 'vitest';
import { MCPAdapter } from '../../src/router/adapters/mcp-adapter';

// Mock dependencies
const mockConfig = {
  id: 'test-id',
  userId: 'user-1',
  name: 'Test Adapter',
  serverUrl: 'test-url',
  serverType: 'custom',
  transportType: 'stdio',
  enabled: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('MCP Adapter Auto-detection', () => {
  it('should detect todoist server type from command', () => {
    const config = {
      ...mockConfig,
      command: 'npx -y mcp-remote https://ai.todoist.net/mcp'
    };

    // Logic to be implemented in routes, but we can test the helper function logic here
    // or simulate the route handler logic
    const serverType = detectServerType(config.command);
    expect(serverType).toBe('todoist');
  });

  it('should detect notion server type from command', () => {
    const config = {
      ...mockConfig,
      command: 'npx -y @notionhq/notion-mcp-server'
    };

    const serverType = detectServerType(config.command);
    expect(serverType).toBe('notion');
  });
});

describe('MCP Adapter Auth Handling', () => {
  it('should set MCP_REMOTE_HEADERS for Todoist with OAuth token', async () => {
    // This tests the initializeStdioClient logic we need to implement
    // We'll need to subclass MCPAdapter to access private methods or inspect side effects

    class TestMCPAdapter extends MCPAdapter {
      public async testInitializeStdioClient(config: any) {
        // We can't easily mock the StdioMcpClient import without complex setup
        // So we'll test the env preparation logic which we'll extract to a public/protected method
        return this.prepareEnv(config);
      }

      // We'll add this method to the class during implementation
      protected prepareEnv(config: any): Record<string, string> {
        // This is a placeholder for the method we will implement
        const env = { ...(config.env || {}) };

        if (config.serverType === 'todoist' && config.oauthAccessToken) {
           env.MCP_REMOTE_HEADERS = JSON.stringify({
             Authorization: `Bearer ${config.oauthAccessToken}`
           });
        }

        return env;
      }
    }

    const adapter = new TestMCPAdapter();
    const config = {
      ...mockConfig,
      serverType: 'todoist',
      oauthAccessToken: 'test-token',
      env: { EXISTING_VAR: 'value' }
    };

    const env = await adapter.testInitializeStdioClient(config);

    expect(env.EXISTING_VAR).toBe('value');
    expect(env.MCP_REMOTE_HEADERS).toBeDefined();

    const headers = JSON.parse(env.MCP_REMOTE_HEADERS!);
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});

// Helper function to be implemented in the route handler
function detectServerType(command?: string): string {
  if (!command) return 'custom';
  if (command.includes('ai.todoist.net')) return 'todoist';
  if (command.includes('@notionhq/notion-mcp-server')) return 'notion';
  if (command.includes('server-github')) return 'github';
  if (command.includes('server-obsidian')) return 'obsidian';
  return 'custom';
}
