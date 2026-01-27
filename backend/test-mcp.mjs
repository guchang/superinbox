import { StdioMcpClient } from './dist/router/mcp/stdio-mcp-client.js';

async function test() {
  const client = new StdioMcpClient({
    command: 'npx',
    args: ['-y', 'mcp-remote', 'https://ai.todoist.net/mcp', '--header', 'Authorization: Bearer 5fa9741b9f3f43cede6e1f7b63de205d0525d9d4'],
    env: { TODOIST_API_KEY: '5fa9741b9f3f43cede6e1f7b63de205d0525d9d4' },
    timeout: 60000
  });

  try {
    console.log('Initializing...');
    await client.initialize();
    console.log('Initialized successfully');

    console.log('Listing tools...');
    const tools = await client.listTools();
    console.log('Available tools:', tools.map(t => t.name));

    console.log('\nGetting schema for addTasks...');
    const schema = await client.getToolSchema('addTasks');
    console.log('Schema:', JSON.stringify(schema, null, 2));

  } catch (error) {
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    client.kill();
  }
}

test();
