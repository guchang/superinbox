import { getAIService } from './dist/ai/service.js';

const ai = getAIService();

console.log('Testing AI analysis...');
const result = await ai.analyzeContent('明天下午3点和张三开会讨论项目进度');
console.log('Result:', JSON.stringify(result, null, 2));
