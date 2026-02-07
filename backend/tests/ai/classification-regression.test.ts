import { describe, expect, it } from 'vitest';
import { CategoryClassifier, type CategoryDefinition } from '../../src/ai/category-classifier.js';
import { validateCategoryPromptContent } from '../../src/ai/routes/categories.routes.js';
import { ContentType } from '../../src/types/index.js';
import { MCPAdapter } from '../../src/router/adapters/mcp-adapter.js';

type FakeResponse = {
  category?: unknown;
  entities?: Record<string, unknown>;
  summary?: unknown;
  suggestedTitle?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
};

class FakeLlm {
  public messages: Array<{ role: string; content: string }> = [];

  constructor(private response: FakeResponse) {}

  async chatJson<T>(messages: Array<{ role: string; content: string }>): Promise<T> {
    this.messages = messages;
    return this.response as T;
  }
}

const CATEGORIES: CategoryDefinition[] = [
  {
    key: 'todo',
    name: '待办',
    description: '需要执行的任务',
  },
  {
    key: 'sinbox',
    name: 'superinbox开发计划',
    description: 'SuperInbox related development ideas and config',
  },
  {
    key: 'unknown',
    name: '未知',
    description: 'Fallback category',
  },
];

describe('CategoryClassifier regression', () => {
  it('uses custom prompt directly without appending fallback schema', async () => {
    const customPrompt = [
      '你是分类引擎',
      '[上下文] {{NOW_ISO}} {{TIMEZONE}} {{CONTENT_TYPE}} {{CONTENT}}',
      '[分类集合] {{ACTIVE_CATEGORY_KEYS_JSON}}',
      '{{CATEGORY_RULES_JSON}}',
      'fallback {{FALLBACK_CATEGORY_KEY}}',
      '只输出合法 JSON only',
      'category must be one of activeCategoryKeys and unknown is fallback only',
    ].join('\n');

    const llm = new FakeLlm({
      category: 'todo',
      entities: {},
      confidence: 0.9,
    });

    const classifier = new CategoryClassifier(llm as any);
    await classifier.analyze('test content', ContentType.TEXT, CATEGORIES, customPrompt);

    expect(llm.messages[0]?.role).toBe('system');
    expect(llm.messages[0]?.content).toBe(customPrompt);
    expect(llm.messages[0]?.content.includes('Supported categories:')).toBe(false);
    expect(llm.messages[0]?.content.includes('"category": "shopping"')).toBe(false);
  });

  it('normalizes category/confidence/entities safely', async () => {
    const llm = new FakeLlm({
      category: 'SUPERINBOX开发计划',
      entities: {
        dates: ['2026-02-08', 'invalid-date', 123],
        dueDate: 'not-a-date',
        startDate: '2026-02-09',
        amount: '99',
        currency: 'cny',
        tags: ['urgent', '', 1],
        people: ['Alice', null],
        location: '  Shanghai  ',
        urls: ['https://example.com/a', 'ftp://example.com/a', 'invalid-url'],
        customFields: 'not-object',
      },
      summary: '  summary text  ',
      suggestedTitle: '  title text  ',
      confidence: 1.4,
      reasoning: '  because rule matched  ',
    });

    const classifier = new CategoryClassifier(llm as any);
    const result = await classifier.analyze('content', ContentType.TEXT, CATEGORIES);

    expect(result.category).toBe('sinbox');
    expect(result.confidence).toBe(0);
    expect(result.entities.dates?.length).toBe(1);
    expect(result.entities.dates?.[0]).toBeInstanceOf(Date);
    expect(result.entities.dueDate).toBeUndefined();
    expect(result.entities.startDate).toBeInstanceOf(Date);
    expect(result.entities.amount).toBeUndefined();
    expect(result.entities.currency).toBe('CNY');
    expect(result.entities.tags).toEqual(['urgent']);
    expect(result.entities.people).toEqual(['Alice']);
    expect(result.entities.location).toBe('Shanghai');
    expect(result.entities.urls).toEqual(['https://example.com/a']);
    expect(result.entities.customFields).toEqual({});
    expect(result.summary).toBe('summary text');
    expect(result.suggestedTitle).toBe('title text');
    expect(result.reasoning).toBe('because rule matched');
  });

  it('falls back to unknown when category is invalid', async () => {
    const llm = new FakeLlm({
      category: 'random',
      entities: {},
      confidence: 0.8,
    });

    const classifier = new CategoryClassifier(llm as any);
    const result = await classifier.analyze('content', ContentType.TEXT, CATEGORIES);

    expect(result.category).toBe('unknown');
  });
});

describe('Category prompt validation guardrails', () => {
  it('accepts prompt with required placeholders and constraints', () => {
    const prompt = [
      '你是分类引擎，只输出合法 JSON。',
      'now={{NOW_ISO}} timezone={{TIMEZONE}} type={{CONTENT_TYPE}} content={{CONTENT}}',
      'active={{ACTIVE_CATEGORY_KEYS_JSON}} rules={{CATEGORY_RULES_JSON}} fallback={{FALLBACK_CATEGORY_KEY}}',
      'category must only be from activeCategoryKeys',
      'unknown is fallback only',
    ].join('\n');

    expect(validateCategoryPromptContent(prompt)).toEqual({});
  });

  it('rejects prompt missing placeholders', () => {
    const prompt = 'JSON only and unknown fallback only';
    const result = validateCategoryPromptContent(prompt);

    expect(result.message).toBe('Prompt is missing required runtime placeholders');
    expect(result.missingPlaceholders?.length).toBeGreaterThan(0);
  });
});

describe('MCPAdapter due date normalization regression', () => {
  it('normalizes YYYY-MM-DD and ISO datetime values', () => {
    const adapter = new MCPAdapter() as any;

    expect(adapter.normalizeDueDateString('2026-02-10')).toBe('2026-02-10');
    expect(adapter.normalizeDueDateString('2026-02-10T09:00:00+08:00')).toBe('2026-02-10');
    expect(adapter.normalizeDueDateString('invalid')).toBeUndefined();
  });
});
