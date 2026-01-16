/**
 * Intent Classifier - AI-Powered Intent Recognition
 */

import type { LLMClient } from './llm-client.js';
import type { AIAnalysisResult, ExtractedEntities } from '../types/index.js';
import { IntentType, ContentType } from '../types/index.js';

const INTENT_DESCRIPTIONS = {
  [IntentType.TODO]: '待办事项 - 需要完成的任务或行动项',
  [IntentType.IDEA]: '想法/灵感 - 突然的想法、创意或灵感记录',
  [IntentType.EXPENSE]: '消费记录 - 购物、支付、账单等金钱相关',
  [IntentType.NOTE]: '笔记 - 学习笔记、会议记录、信息整理',
  [IntentType.BOOKMARK]: '书签收藏 - 网页链接、文章、资源收藏',
  [IntentType.SCHEDULE]: '日程安排 - 有特定时间的约会、会议、提醒',
  [IntentType.UNKNOWN]: '未知类型 - 无法明确分类的内容'
};

export class IntentClassifier {
  constructor(private llm: LLMClient) {}

  /**
   * Classify intent and extract entities from content
   */
  async analyze(content: string, contentType: ContentType = ContentType.TEXT): Promise<AIAnalysisResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(content, contentType);

    const result = await this.llm.chatJson<AIAnalysisResult & { reasoning?: string }>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Validate and normalize the result
    return this.validateResult(result);
  }

  /**
   * Build system prompt for intent classification
   */
  private buildSystemPrompt(): string {
    return `你是 SuperInbox 的 AI 助手，负责分析用户输入的内容并识别其意图。

你的任务是：
1. 识别内容的主要意图类型
2. 提取关键实体信息（日期、金额、标签、联系人等）
3. 生成简短摘要
4. 建议一个合适的标题

支持的意图类型：
${Object.entries(INTENT_DESCRIPTIONS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')}

响应格式（必须是有效的 JSON）：
\`\`\`json
{
  "intent": "todo|idea|expense|note|bookmark|schedule|unknown",
  "entities": {
    "dates": ["2024-01-15", "2024-01-20"],
    "dueDate": "2024-01-15",
    "startDate": "2024-01-15",
    "amount": 99.99,
    "currency": "CNY",
    "tags": ["购物", "重要"],
    "category": "购物",
    "people": ["张三"],
    "location": "北京",
    "urls": ["https://example.com"]
  },
  "summary": "简短的内容摘要（1-2句话）",
  "suggestedTitle": "建议的标题",
  "confidence": 0.95,
  "reasoning": "判断依据"
}
\`\`\`

注意事项：
- 日期格式必须是 ISO 8601 (YYYY-MM-DD)
- 金额使用数字类型
- confidence 是 0-1 之间的数字
- 只返回 JSON，不要有其他文字`;
  }

  /**
   * Build user prompt with content
   */
  private buildUserPrompt(content: string, contentType: ContentType): string {
    return `请分析以下内容：

内容类型：${contentType}
内容：
${content}

请识别意图并提取实体信息。`;
  }

  /**
   * Validate and normalize the analysis result
   */
  private validateResult(result: any): AIAnalysisResult {
    // Ensure intent is valid
    if (!Object.values(IntentType).includes(result.intent)) {
      result.intent = IntentType.UNKNOWN;
    }

    // Ensure entities object exists
    if (!result.entities || typeof result.entities !== 'object') {
      result.entities = {};
    }

    // Ensure confidence is a number between 0 and 1
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5;
    }

    // Normalize entities
    const entities: ExtractedEntities = {
      dates: result.entities.dates ?? [],
      dueDate: result.entities.dueDate ? new Date(result.entities.dueDate) : undefined,
      startDate: result.entities.startDate ? new Date(result.entities.startDate) : undefined,
      amount: result.entities.amount,
      currency: result.entities.currency,
      tags: result.entities.tags ?? [],
      category: result.entities.category,
      people: result.entities.people ?? [],
      location: result.entities.location,
      urls: result.entities.urls ?? [],
      customFields: result.entities.customFields ?? {}
    };

    return {
      intent: result.intent,
      entities,
      summary: result.summary,
      suggestedTitle: result.suggestedTitle,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  }
}

/**
 * Batch classify multiple contents
 */
export async function batchClassify(
  llm: LLMClient,
  contents: Array<{ content: string; type: ContentType }>
): Promise<AIAnalysisResult[]> {
  const classifier = new IntentClassifier(llm);
  const results: AIAnalysisResult[] = [];

  for (const item of contents) {
    const result = await classifier.analyze(item.content, item.type);
    results.push(result);
  }

  return results;
}
