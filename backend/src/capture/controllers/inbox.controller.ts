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
  Priority,
  QueryFilter
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
   * GET /v1/items and GET /v1/inbox
   */
  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';

      // Parse pagination parameters
      // Support both 'page' format (new API) and 'offset' format (legacy API)
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : (page - 1) * limit;

      // Enforce max limit
      const maxLimit = 100;
      const finalLimit = Math.min(limit, maxLimit);

      // Parse filter parameters
      const filter: QueryFilter = {
        status: req.query.status as any,
        intent: req.query.intent as any,
        source: req.query.source as string,
        query: req.query.query as string,
        since: req.query.since ? new Date(req.query.since as string) : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: finalLimit,
        offset: offset,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any
      };

      // Get total count (for pagination metadata)
      const countFilter = { ...filter };
      delete countFilter.limit;
      delete countFilter.offset;
      const total = this.db.countItemsByUserId(userId, countFilter);

      // Get items
      const items = this.db.getItemsByUserId(userId, filter);

      // Determine response format based on route path
      // GET /v1/inbox -> new API format with 'entries'
      // GET /v1/items -> legacy API format with 'data' and 'meta'
      const isInboxRoute = req.path === '/v1/inbox' || req.path === '/inbox';

      if (isInboxRoute) {
        // New API format (GET /v1/inbox)
        res.json({
          total,
          page,
          limit: finalLimit,
          entries: items.map(item => ({
            id: item.id,
            content: item.originalContent,
            source: item.source,
            intent: item.intent,
            entities: item.entities,
            status: item.status,
            createdAt: item.createdAt.toISOString(),
            routedTo: item.distributedTargets
          }))
        });
      } else {
        // Legacy API format (GET /v1/items)
        res.json({
          success: true,
          data: items,
          meta: {
            total,
            hasMore: offset + items.length < total
          }
        });
      }
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
      logger.info(`[AI Processing] Starting for item ${itemId}`);

      // Update status to processing
      this.db.updateItem(itemId, { status: 'processing' });

      // Get item
      const item = this.db.getItemById(itemId);
      if (!item) {
        logger.error(`[AI Processing] Item ${itemId} not found`);
        return;
      }

      logger.info(`[AI Processing] Analyzing content: "${item.originalContent.substring(0, 50)}..."`);

      // Analyze with AI
      const analysis = await this.ai.analyzeContent(item.originalContent, item.contentType);

      logger.info(`[AI Processing] Analysis result: intent=${analysis.intent}, confidence=${analysis.confidence}`);

      // Determine status based on analysis quality
      // Mark as failed if intent is unknown and confidence is low
      const shouldMarkAsFailed =
        analysis.intent === 'unknown' &&
        (!analysis.confidence || analysis.confidence < 0.3);

      if (shouldMarkAsFailed) {
        logger.warn(`[AI Processing] Item ${itemId} marked as failed: intent=unknown, confidence=${analysis.confidence}`);
      }

      // Update with AI results
      this.db.updateItem(itemId, {
        intent: analysis.intent,
        entities: analysis.entities,
        summary: analysis.summary,
        suggestedTitle: analysis.suggestedTitle,
        status: shouldMarkAsFailed ? 'failed' : 'completed',
        processedAt: new Date()
      });

      // Only trigger distribution for successfully processed items
      if (!shouldMarkAsFailed) {
        await this.distributeItemAsync(item);
      }

      logger.info(`[AI Processing] Completed for item ${itemId}`);
    } catch (error) {
      logger.error(`[AI Processing] Failed for item ${itemId}: ${error}`);
      if (error instanceof Error) {
        logger.error(`[AI Processing] Error details: ${error.message}\n${error.stack}`);
      }
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
