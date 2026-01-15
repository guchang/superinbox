/**
 * Capture Layer - Inbox Controller
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../storage/database.js';
import { getAIService } from '../../ai/service.js';
import { getRouterService } from '../../router/router.service.js';
import type {
  CreateItemRequest,
  CreateItemResponse,
  Item,
  ContentType,
  ItemStatus,
  Priority
} from '../../types/index.js';
import { logger } from '../../middleware/logger.js';

// Validation schemas
const createItemSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  type: z.enum(['text', 'image', 'url', 'audio', 'file', 'mixed']).optional(),
  source: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateItemSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
});

export class InboxController {
  private db = getDatabase();
  private ai = getAIService();
  private router = getRouterService();

  /**
   * Create a new item from inbox input
   * POST /v1/inbox
   */
  createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const body = createItemSchema.parse(req.body);
      const userId = req.user?.id ?? 'default-user';

      // Create item object
      const item: Item = {
        id: uuidv4(),
        userId,
        originalContent: body.content,
        contentType: (body.type ?? 'text') as ContentType,
        source: body.source ?? 'api',
        intent: 'unknown' as any,
        entities: {},
        status: 'pending' as ItemStatus,
        priority: 'medium' as Priority,
        distributedTargets: [],
        distributionResults: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      this.db.createItem(item);

      // Trigger async AI processing
      this.processItemAsync(item.id).catch(error => {
        console.error(`Failed to process item ${item.id}:`, error);
      });

      // Respond immediately with pending status
      const response: CreateItemResponse = {
        id: item.id,
        status: item.status,
        intent: item.intent,
        message: 'Item received and is being processed'
      };

      res.status(201).json({
        success: true,
        data: response
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors
          }
        });
        return;
      }
      next(error);
    }
  };

  /**
   * Get item by ID
   * GET /v1/items/:id
   */
  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Item not found'
          }
        });
        return;
      }

      // Check ownership
      if (item.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get items with filtering
   * GET /v1/items
   */
  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';

      // Parse query parameters
      const filter = {
        status: req.query.status as string,
        intent: req.query.intent as string,
        source: req.query.source as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string
      };

      const items = this.db.getItemsByUserId(userId, filter);

      res.json({
        success: true,
        data: items,
        meta: {
          total: items.length,
          hasMore: false
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update item
   * PUT /v1/items/:id
   */
  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = updateItemSchema.parse(req.body);
      const userId = req.user?.id ?? 'default-user';

      const existing = this.db.getItemById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Item not found'
          }
        });
        return;
      }

      // Check ownership
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
        return;
      }

      // Build updates
      const updates: Partial<Item> = {};
      if (body.content !== undefined) {
        updates.originalContent = body.content;
      }
      if (body.status !== undefined) {
        updates.status = body.status as ItemStatus;
      }
      if (body.priority !== undefined) {
        updates.priority = body.priority as Priority;
      }

      const updated = this.db.updateItem(id, updates);

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors
          }
        });
        return;
      }
      next(error);
    }
  };

  /**
   * Delete item
   * DELETE /v1/items/:id
   */
  deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const existing = this.db.getItemById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Item not found'
          }
        });
        return;
      }

      // Check ownership
      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
        return;
      }

      const deleted = this.db.deleteItem(id);

      res.json({
        success: true,
        data: {
          deleted
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Manually trigger distribution
   * POST /v1/items/:id/distribute
   */
  triggerDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);

      if (!item) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Item not found'
          }
        });
        return;
      }

      // Check ownership
      if (item.userId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
        return;
      }

      // Trigger async distribution
      this.distributeItemAsync(item).catch(error => {
        console.error(`Failed to distribute item ${item.id}:`, error);
      });

      res.json({
        success: true,
        data: {
          message: 'Distribution triggered'
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Async item processing with AI
   */
  private async processItemAsync(itemId: string): Promise<void> {
    try {
      // Update status to processing
      this.db.updateItem(itemId, { status: 'processing' });

      // Get item
      const item = this.db.getItemById(itemId);
      if (!item) return;

      // Analyze with AI
      const analysis = await this.ai.analyzeContent(item.originalContent, item.contentType);

      // Update with AI results
      this.db.updateItem(itemId, {
        intent: analysis.intent,
        entities: analysis.entities,
        summary: analysis.summary,
        suggestedTitle: analysis.suggestedTitle,
        status: 'completed',
        processedAt: new Date()
      });

      // Trigger distribution if configured
      await this.distributeItemAsync(item);
    } catch (error) {
      console.error(`AI processing failed for item ${itemId}:`, error);
      this.db.updateItem(itemId, { status: 'failed' });
    }
  }

  /**
   * Async item distribution
   */
  private async distributeItemAsync(item: Item): Promise<void> {
    try {
      logger.info(`Starting distribution for item ${item.id}`);
      const results = await this.router.distributeItem(item);

      // Update item with distribution results
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      logger.info(`Distribution completed for item ${item.id}: ${successCount} success, ${failedCount} failed`);

      // Store distribution targets
      const distributedTargets = results
        .filter(r => r.status === 'success')
        .map(r => r.targetId);

      this.db.updateItem(item.id, {
        distributedTargets,
        distributionResults: results
      });
    } catch (error) {
      logger.error(`Distribution failed for item ${item.id}:`, error);
    }
  }
}

export const inboxController = new InboxController();
