/**
 * Parse Result Controller
 *
 * Handles AI parse result retrieval and user corrections
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../../storage/database.js';

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
      res.status(404).json({
        success: false,
        error: {
          code: 'STORAGE_NOT_FOUND',
          message: 'Item not found'
        }
      });
      return;
    }

    res.json({
      entryId: item.id,
      originalContent: item.originalContent,
      parsed: {
        intent: item.intent,
        confidence: 0.8, // Default confidence for now
        entities: item.entities || {}
      },
      parsedAt: item.processedAt || item.updatedAt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTELLIGENCE_PARSE_ERROR',
        message: 'Failed to get parse result',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
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
    const { intent, entities, feedback } = req.body;
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();

    const item = db.getItemById(id);

    if (!item || item.userId !== userId) {
      res.status(404).json({
        success: false,
        error: {
          code: 'STORAGE_NOT_FOUND',
          message: 'Item not found'
        }
      });
      return;
    }

    // Update item with corrected data
    const updatedItem = db.updateItem(id, {
      intent: intent || item.intent,
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
      message: '已更新解析结果并记录反馈',
      updatedAt: updatedItem.updatedAt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTELLIGENCE_UPDATE_FAILED',
        message: 'Failed to update parse result',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}
