/**
 * Parse Result Controller
 *
 * Handles AI parse result retrieval and user corrections
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../../storage/database.js';
import { sendError } from '../../utils/error-response.js';
import { randomUUID } from 'crypto';
import { ItemStatus } from '../../types/index.js';

/**
 * GET /v1/intelligence/parse/:id
 *
 * Retrieve AI parse result for an item
 */
export async function getParseResult(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();

    const item = db.getItemById(id);

    if (!item || item.userId !== userId) {
      sendError(res, {
        statusCode: 404,
        code: 'INBOX.NOT_FOUND',
        message: 'Item not found',
        params: { id }
      });
      return;
    }

    res.json({
      entryId: item.id,
      originalContent: item.originalContent,
      parsed: {
        category: item.category,
        confidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0,
        entities: item.entities || {}
      },
      reasoning: item.aiReasoning,
      promptVersion: item.aiPromptVersion,
      model: item.aiModel,
      parseStatus: item.aiParseStatus,
      parsedAt: item.processedAt || item.updatedAt
    });
  } catch (error) {
    sendError(res, {
      statusCode: 500,
      code: 'INTELLIGENCE.PARSE_FAILED',
      message: 'Failed to get parse result',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PATCH /v1/intelligence/parse/:id
 *
 * Update AI parse result with user correction
 */
export async function updateParseResult(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { category, entities, feedback } = req.body;
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();

    const item = db.getItemById(id);

    if (!item || item.userId !== userId) {
      sendError(res, {
        statusCode: 404,
        code: 'INBOX.NOT_FOUND',
        message: 'Item not found',
        params: { id }
      });
      return;
    }

    const correctedCategory = typeof category === 'string' ? category : item.category;
    const correctedEntities = entities && typeof entities === 'object' ? entities : item.entities;
    const correctedEntitiesRecord = correctedEntities as Record<string, unknown>;

    // Update item with corrected data
    const updatedItem = db.updateItem(id, {
      category: correctedCategory,
      entities: correctedEntities,
      aiParseStatus: 'success',
      aiConfidence: item.aiConfidence,
      aiReasoning: item.aiReasoning,
      aiPromptVersion: item.aiPromptVersion,
      aiModel: item.aiModel,
      status: ItemStatus.COMPLETED,
      processedAt: new Date()
    });

    if (!updatedItem) {
      sendError(res, {
        statusCode: 404,
        code: 'INBOX.NOT_FOUND',
        message: 'Item not found',
        params: { id }
      });
      return;
    }

    db.createAiFeedback({
      id: randomUUID(),
      itemId: id,
      userId,
      originalCategory: item.category,
      correctedCategory,
      originalEntities: item.entities as Record<string, unknown>,
      correctedEntities: correctedEntitiesRecord,
      feedback: typeof feedback === 'string' ? feedback : undefined,
    });

    res.json({
      success: true,
      message: '已更新解析结果并记录反馈',
      updatedAt: updatedItem.updatedAt
    });
  } catch (error) {
    sendError(res, {
      statusCode: 500,
      code: 'INTELLIGENCE.UPDATE_FAILED',
      message: 'Failed to update parse result',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
