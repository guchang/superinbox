import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    getItemById: vi.fn(),
    updateItem: vi.fn(),
    createAiFeedback: vi.fn(),
  },
}));

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: () => mockDb,
}));

import {
  getParseResult,
  updateParseResult,
} from '../../src/intelligence/controllers/parse.controller.js';

const createResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('Parse controller regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns persisted AI quality fields in getParseResult', async () => {
    const now = new Date('2026-02-07T00:00:00.000Z');
    mockDb.getItemById.mockReturnValue({
      id: 'item-1',
      userId: 'user-1',
      originalContent: 'test content',
      category: 'todo',
      entities: { tags: ['a'] },
      aiConfidence: 0.76,
      aiReasoning: 'matched todo semantics',
      aiPromptVersion: 'sha256:abc123',
      aiModel: 'gpt-4.1-mini',
      aiParseStatus: 'success',
      processedAt: now,
      updatedAt: now,
    });

    const req: any = {
      params: { id: 'item-1' },
      user: { id: 'user-1' },
    };
    const res = createResponse();

    await getParseResult(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'item-1',
        reasoning: 'matched todo semantics',
        promptVersion: 'sha256:abc123',
        model: 'gpt-4.1-mini',
        parseStatus: 'success',
        parsed: expect.objectContaining({
          category: 'todo',
          confidence: 0.76,
          entities: { tags: ['a'] },
        }),
      })
    );
  });

  it('writes correction feedback and keeps AI metadata on update', async () => {
    const now = new Date('2026-02-07T00:00:00.000Z');
    mockDb.getItemById.mockReturnValue({
      id: 'item-2',
      userId: 'user-1',
      originalContent: 'ride cost 38 CNY',
      category: 'todo',
      entities: { amount: 38 },
      aiConfidence: 0.41,
      aiReasoning: 'original model misclassified',
      aiPromptVersion: 'sha256:def456',
      aiModel: 'gpt-4.1-mini',
      aiParseStatus: 'failed',
      updatedAt: now,
    });

    mockDb.updateItem.mockReturnValue({
      id: 'item-2',
      updatedAt: now,
    });

    const req: any = {
      params: { id: 'item-2' },
      body: {
        category: 'expense',
        entities: { amount: 38, currency: 'CNY' },
        feedback: 'amount content should be expense',
      },
      user: { id: 'user-1' },
    };
    const res = createResponse();

    await updateParseResult(req, res);

    expect(mockDb.updateItem).toHaveBeenCalledWith(
      'item-2',
      expect.objectContaining({
        category: 'expense',
        entities: { amount: 38, currency: 'CNY' },
        aiParseStatus: 'success',
        aiConfidence: 0.41,
        aiReasoning: 'original model misclassified',
        aiPromptVersion: 'sha256:def456',
        aiModel: 'gpt-4.1-mini',
        status: 'completed',
      })
    );

    expect(mockDb.createAiFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-2',
        userId: 'user-1',
        originalCategory: 'todo',
        correctedCategory: 'expense',
        originalEntities: { amount: 38 },
        correctedEntities: { amount: 38, currency: 'CNY' },
        feedback: 'amount content should be expense',
      })
    );

    const feedbackPayload = mockDb.createAiFeedback.mock.calls[0]?.[0];
    expect(typeof feedbackPayload.id).toBe('string');
    expect(feedbackPayload.id.length).toBeGreaterThan(0);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });
});
