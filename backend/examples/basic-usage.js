/**
 * Basic Usage Example
 */

const API_KEY = 'dev-key-change-this-in-production';
const BASE_URL = 'http://localhost:3000/v1';

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  return response.json();
}

// Example 1: Create a new item (send text to inbox)
async function createItemExample() {
  console.log('=== Example 1: Create Item ===');

  const result = await apiRequest('/inbox', 'POST', {
    content: '明天下午3点和张三开会讨论项目进度',
    source: 'telegram',
    type: 'text'
  });

  console.log(JSON.stringify(result, null, 2));
  return result.data?.id;
}

// Example 2: Get item by ID
async function getItemExample(itemId) {
  console.log('\n=== Example 2: Get Item ===');

  const result = await apiRequest(`/items/${itemId}`, 'GET');
  console.log(JSON.stringify(result, null, 2));
}

// Example 3: List all items
async function listItemsExample() {
  console.log('\n=== Example 3: List Items ===');

  const result = await apiRequest('/items?limit=10&status=completed', 'GET');
  console.log(JSON.stringify(result, null, 2));
}

// Example 4: Different content types
async function differentContentTypesExample() {
  console.log('\n=== Example 4: Different Content Types ===');

  const examples = [
    { content: '买咖啡花了25元', type: 'expense', description: '消费记录' },
    { content: 'GPT-4是很好的AI助手', type: 'note', description: '笔记' },
    { content: 'https://github.com/SuperInbox/core', type: 'bookmark', description: '书签' },
    { content: '记得给妈妈打电话问好', type: 'todo', description: '待办' },
    { content: '突然想到可以做AI自动分类工具', type: 'idea', description: '灵感' }
  ];

  for (const example of examples) {
    console.log(`\n发送${example.description}: ${example.content}`);
    const result = await apiRequest('/inbox', 'POST', {
      content: example.content,
      type: 'text'
    });
    console.log(`结果: ${result.data?.intent} (${result.data?.status})`);
  }
}

// Run all examples
async function main() {
  try {
    // Create a new item
    const itemId = await createItemExample();

    // Wait for AI processing
    console.log('\n等待 AI 处理...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the item
    await getItemExample(itemId);

    // List all items
    await listItemsExample();

    // Different content types
    await differentContentTypesExample();

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createItemExample, getItemExample, listItemsExample, differentContentTypesExample };
