/**
 * 测试 SSE 连接的简单脚本
 */

const EventSource = require('eventsource');

// 配置
const BASE_URL = 'http://localhost:3001';
const ITEM_ID = 'e834aeaf-015d-4bd0-a076-b19e9f1136a4'; // 从日志中获取的 item ID
const TOKEN = 'your-jwt-token-here'; // 需要替换为实际的 JWT token

async function testSSEConnection() {
  console.log('Testing SSE connection...');
  
  const url = `${BASE_URL}/v1/inbox/${ITEM_ID}/routing-progress?token=${encodeURIComponent(TOKEN)}`;
  console.log(`Connecting to: ${url}`);
  
  const eventSource = new EventSource(url);
  
  eventSource.onopen = () => {
    console.log('✅ SSE connection opened');
  };
  
  eventSource.onerror = (error) => {
    console.error('❌ SSE connection error:', error);
  };
  
  // 监听所有事件类型
  const eventTypes = [
    'connected',
    'routing:start',
    'routing:rule_match', 
    'routing:tool_call_start',
    'routing:tool_call_progress',
    'routing:tool_call_success',
    'routing:tool_call_error',
    'routing:complete',
    'routing:error'
  ];
  
  eventTypes.forEach(eventType => {
    eventSource.addEventListener(eventType, (event) => {
      console.log(`📡 Received event: ${eventType}`, JSON.parse(event.data));
    });
  });
  
  // 10秒后关闭连接
  setTimeout(() => {
    console.log('Closing SSE connection...');
    eventSource.close();
    process.exit(0);
  }, 10000);
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('请先替换 TOKEN 变量为实际的 JWT token，然后运行此脚本');
  console.log('你可以从浏览器的开发者工具中获取 token');
  // testSSEConnection().catch(console.error);
}

module.exports = { testSSEConnection };