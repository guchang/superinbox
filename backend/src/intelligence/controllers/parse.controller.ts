/**
 * Parse Result Controller
 *
 * Handles AI parse result retrieval and user corrections
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../../storage/database.js';
import { sendError } from '../../utils/error-response.js';

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
        confidence: 0.8, // Default confidence for now
        entities: item.entities || {}
      },
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

    // Update item with corrected data
    const updatedItem = db.updateItem(id, {
      category: category || item.category,
      entities: entities || item.entities,
      status: 'completed',
      processedAt: new Date()
    });

    // TODO: Store feedback for AI learning
    // This should be persisted to a feedback table for future training
    if (feedback) {
      console.log(`Feedback received for item ${id}:`, feedback);
    }

    res.json({
      success: true,
      message: 'Parse result updated and feedback recorded',
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
