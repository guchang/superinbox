/**
 * Category Classifier - AI-Powered Content Classification
 */

import type { LLMClient } from './llm-client.js';
import type { AIAnalysisResult, ExtractedEntities } from '../types/index.js';
import { CategoryType, ContentType } from '../types/index.js';

const CATEGORY_DESCRIPTIONS: Record<CategoryType, string> = {
  [CategoryType.TODO]: 'todo - Tasks or action items that need to be completed',
  [CategoryType.IDEA]: 'idea - Sudden thoughts, creative ideas, or inspiration records',
  [CategoryType.EXPENSE]: 'expense - Shopping, payments, bills, or money-related records',
  [CategoryType.NOTE]: 'note - Study notes, meeting records, or information organization',
  [CategoryType.BOOKMARK]: 'bookmark - Web links, articles, or resource collections',
  [CategoryType.SCHEDULE]: 'schedule - Appointments, meetings, or reminders with specific time',
  [CategoryType.UNKNOWN]: 'unknown - Content that cannot be clearly classified'
};

export class CategoryClassifier {
  constructor(private llm: LLMClient) {}

  /**
   * Classify content category and extract entities
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
   * Build system prompt for category classification
   */
  private buildSystemPrompt(): string {
    return `You are SuperInbox's AI assistant, responsible for analyzing user input and classifying it into categories.

Your tasks:
1. Identify the primary category of the content
2. Extract key entity information (dates, amounts, tags, contacts, etc.)
3. Generate a brief summary
4. Suggest an appropriate title

Supported categories:
${Object.entries(CATEGORY_DESCRIPTIONS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')}

Response format (must be valid JSON):
\`\`\`json
{
  "category": "todo|idea|expense|note|bookmark|schedule|unknown",
  "entities": {
    "dates": ["2024-01-15", "2024-01-20"],
    "dueDate": "2024-01-15",
    "startDate": "2024-01-15",
    "amount": 99.99,
    "currency": "CNY",
    "tags": ["shopping", "important"],
    "category": "shopping",
    "people": ["Zhang San"],
    "location": "Beijing",
    "urls": ["https://example.com"]
  },
  "summary": "Brief content summary (1-2 sentences)",
  "suggestedTitle": "Suggested title",
  "confidence": 0.95,
  "reasoning": "Judgment basis"
}
\`\`\`

Notes:
- Date format must be ISO 8601 (YYYY-MM-DD)
- Amount uses number type
- confidence is a number between 0-1
- Return only JSON, no other text`;
  }

  /**
   * Build user prompt with content
   */
  private buildUserPrompt(content: string, contentType: ContentType): string {
    return `Please analyze the following content:

Content type: ${contentType}
Content:
${content}

Please identify the category and extract entity information.`;
  }

  /**
   * Validate and normalize the analysis result
   */
  private validateResult(result: any): AIAnalysisResult {
    // Ensure category is valid
    if (!Object.values(CategoryType).includes(result.category)) {
      result.category = CategoryType.UNKNOWN;
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
      category: result.category,
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
  const classifier = new CategoryClassifier(llm);
  const results: AIAnalysisResult[] = [];

  for (const item of contents) {
    const result = await classifier.analyze(item.content, item.type);
    results.push(result);
  }

  return results;
}
