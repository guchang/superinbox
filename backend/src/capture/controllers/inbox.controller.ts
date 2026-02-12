/**
 * Capture Layer - Inbox Controller
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../storage/database.js';
import { getAIService } from '../../ai/service.js';
import { getRouterService } from '../../router/router.service.js';
import { formatDateInTimeZone } from '../../utils/timezone.js';
import { sendError } from '../../utils/error-response.js';
import { sseManager } from '../../services/sse-manager.js';
import type {
  CreateItemResponse,
  Item,
  ItemFileType,
  QueryFilter
} from '../../types/index.js';
import { ContentType, ItemStatus } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';

/**
 * Parse date string with proper end-of-day handling
 * If the input is a date-only string (YYYY-MM-DD), set it to end of day (23:59:59.999)
 * If the input already includes time, preserve it as-is
 */
const parseDateFilter = (dateStr: string, isEndDate = false): Date => {
  const date = new Date(dateStr);

  // Check if the input is date-only (no time component)
  // by comparing the string with its YYYY-MM-DD format
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  if (isDateOnly && isEndDate) {
    // Set to end of the day (23:59:59.999)
    date.setUTCHours(23, 59, 59, 999);
  } else if (isDateOnly) {
    // Set to start of the day (00:00:00.000) - this is the default
    date.setUTCHours(0, 0, 0, 0);
  }

  return date;
};

// Validation schemas
const CREATE_CONTENT_MAX_LENGTH = 10_000;
const UPDATE_CONTENT_MAX_LENGTH = 500_000;

const createItemSchema = z.object({
  content: z.string().min(1, 'Content is required').max(CREATE_CONTENT_MAX_LENGTH),
  type: z.enum(['text', 'image', 'url', 'audio', 'file', 'mixed']).optional(),
  source: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateItemSchema = z.object({
  content: z.string().min(1).max(UPDATE_CONTENT_MAX_LENGTH).optional(),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'manual', 'failed', 'archived']).optional()
});

const searchSchema = z.object({
  q: z.string().min(1, 'Query parameter is required'),
  category: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
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
        contentType: this.resolveContentType(body.content, body.type),
        source: body.source ?? 'api',
        category: 'unknown' as any,
        entities: {},
        status: ItemStatus.PENDING,
        distributedTargets: [],
        distributionResults: [],
        routingStatus: 'pending',
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
        category: item.category,
        message: 'Item received and is being processed'
      };

      res.status(201).json({
        success: true,
        data: response
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_INPUT',
          message: 'Invalid request body',
          details: error.errors
        });
        return;
      }
      next(error);
    }
  };

  /**
   * Get item by ID
   * GET /v1/inbox/:id
   */
  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';
      const timezone = this.db.getUserTimezone(userId);

      const item = this.db.getItemById(id);

      if (!item) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      // Check ownership
      if (item.userId !== userId) {
        sendError(res, {
          statusCode: 403,
          code: 'AUTH.FORBIDDEN',
          message: 'Access denied'
        });
        return;
      }

      const createdAtLocal = timezone ? formatDateInTimeZone(item.createdAt, timezone) : null;
      const updatedAtLocal = timezone ? formatDateInTimeZone(item.updatedAt, timezone) : null;

      const routingPreviewTargets = item.routingStatus === 'processing'
        ? this.router.getMatchedRuleTargetPreviews(item).map((preview) => ({
            id: preview.targetId || preview.targetName,
            name: preview.targetName,
            serverType: preview.targetServerType,
            logoColor: preview.targetLogoColor,
          }))
        : [];

      res.json({
        id: item.id,
        content: item.originalContent,
        contentType: item.contentType,
        source: item.source,
        status: item.status,
        parsed: {
          category: item.category,
          confidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0,
          entities: item.entities
        },
        reasoning: item.aiReasoning,
        promptVersion: item.aiPromptVersion,
        model: item.aiModel,
        parseStatus: item.aiParseStatus,
        routingHistory: item.distributionResults.map(result => ({
          adapter: result.targetId,
          status: result.status,
          timestamp: result.timestamp || new Date().toISOString()
        })),
        distributedTargets: item.distributedTargets,
        distributedRuleNames: (item.distributionResults || [])
          .filter((r: any) => r.ruleName && (r.status === 'success' || r.status === 'completed'))
          .map((r: any) => r.ruleName),
        routingPreviewTargets,
        routingStatus: item.routingStatus,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        processedAt: item.processedAt ? item.processedAt.toISOString() : undefined,
        createdAtLocal,
        updatedAtLocal
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get items with filtering
   * GET /v1/inbox
   */
  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';
      const timezone = this.db.getUserTimezone(userId);

      // Parse pagination parameters
      // Support both 'page' format (new API) and 'offset' format (legacy API)
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : (page - 1) * limit;

      // Enforce max limit
      const maxLimit = 100;
      const finalLimit = Math.min(limit, maxLimit);

      // Parse filter parameters
      const hasTypeParam = req.query.hastype;
      const hasType = Array.isArray(hasTypeParam) ? hasTypeParam[0] : hasTypeParam;
      const filter: QueryFilter = {
        status: req.query.status as any,
        category: req.query.category as any,
        source: req.query.source as string,
        query: req.query.query as string,
        hasType: hasType as any,
        since: req.query.since ? new Date(req.query.since as string) : undefined,
        startDate: req.query.startDate ? parseDateFilter(req.query.startDate as string, false) : undefined,
        endDate: req.query.endDate ? parseDateFilter(req.query.endDate as string, true) : undefined,
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
      const hasProcessingItems = items.some((item) => item.routingStatus === 'processing');
      const activeRulesForPreview = hasProcessingItems
        ? this.router.getActiveRoutingRulesForUser(userId)
        : [];

      const buildRoutingPreviewTargets = (item: Item) => {
        if (item.routingStatus !== 'processing') {
          return [];
        }

        return this.router.getMatchedRuleTargetPreviews(item, activeRulesForPreview)
          .map((preview) => ({
            id: preview.targetId || preview.targetName,
            name: preview.targetName,
            serverType: preview.targetServerType,
            logoColor: preview.targetLogoColor,
          }));
      };

      res.json({
        total,
        page,
        limit: finalLimit,
        entries: items.map(item => ({
          id: item.id,
          content: item.originalContent,
          source: item.source,
          category: item.category,
          entities: item.entities,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          createdAtLocal: timezone ? formatDateInTimeZone(item.createdAt, timezone) : null,
          routedTo: item.distributedTargets,
          distributedTargets: item.distributedTargets,
          routingPreviewTargets: buildRoutingPreviewTargets(item),
          distributedRuleNames: (item.distributionResults || [])
            .filter((r: any) => r.ruleName && (r.status === 'success' || r.status === 'completed'))
            .map((r: any) => r.ruleName),
          routingStatus: item.routingStatus
        }))
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get available sources
   * GET /v1/inbox/sources
   */
  getSources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';

      // Get all items for the user (without pagination)
      const items = this.db.getItemsByUserId(userId, {});

      // Extract unique sources
      const sources = Array.from(new Set(items.map(item => item.source))).sort();

      res.json({
        success: true,
        data: sources
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update item
   * PUT /v1/inbox/:id
   */
  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = updateItemSchema.parse(req.body);
      const userId = req.user?.id ?? 'default-user';

      const existing = this.db.getItemById(id);

      if (!existing) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      // Check ownership
      if (existing.userId !== userId) {
        sendError(res, {
          statusCode: 403,
          code: 'AUTH.FORBIDDEN',
          message: 'Access denied'
        });
        return;
      }

      // Build updates
      const updates: Partial<Item> = {};
      if (body.content !== undefined) {
        updates.originalContent = body.content;
      }
      if (body.category !== undefined) {
        updates.category = body.category as any;
      }
      if (body.status !== undefined) {
        updates.status = body.status as ItemStatus;
      } else if (body.category !== undefined && body.category !== existing.category) {
        updates.status = ItemStatus.MANUAL;
      }

      const updated = this.db.updateItem(id, updates);

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_INPUT',
          message: 'Invalid request body',
          details: error.errors
        });
        return;
      }
      next(error);
    }
  };

  /**
   * Delete item from inbox (new API format)
   * DELETE /v1/inbox/:id
   */
  deleteItemFromInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const existing = this.db.getItemById(id);

      if (!existing) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      // Check ownership
      if (existing.userId !== userId) {
        sendError(res, {
          statusCode: 403,
          code: 'AUTH.FORBIDDEN',
          message: 'Access denied'
        });
        return;
      }

      this.db.deleteItem(id);

      res.json({
        success: true,
        message: 'Item deleted'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create multiple items in one request
   * POST /v1/inbox/batch
   */
  createItemsBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { entries } = req.body;

      // Basic validation: entries must be an array
      if (!Array.isArray(entries) || entries.length === 0) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_INPUT',
          message: 'entries must be a non-empty array'
        });
        return;
      }

      const userId = req.user?.id ?? 'default-user';

      const results: Array<{
        id?: string;
        content: string;
        status?: string;
        error?: string;
  }> = [];

      let succeeded = 0;
      let failed = 0;

      // Process each entry individually
      for (const entry of entries) {
        try {
          // Validate individual entry
          const validatedEntry = createItemSchema.parse(entry);

          const item: Item = {
            id: uuidv4(),
            userId,
            originalContent: validatedEntry.content,
            contentType: this.resolveContentType(validatedEntry.content, validatedEntry.type),
            source: validatedEntry.source ?? 'api',
            category: 'unknown' as any,
            entities: {},
            status: ItemStatus.PENDING,
            distributedTargets: [],
            distributionResults: [],
            routingStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Save to database
          this.db.createItem(item);

          // Trigger async AI processing
          this.processItemAsync(item.id).catch(error => {
            console.error(`Failed to process item ${item.id}:`, error);
          });

          results.push({
            id: item.id,
            content: validatedEntry.content,
            status: 'pending'
          });

          succeeded++;
        } catch (error) {
          failed++;
          results.push({
            content: entry.content || '(empty)',
            error: error instanceof z.ZodError
              ? error.errors.map(e => e.message).join(', ')
              : (error instanceof Error ? error.message : 'Unknown error')
          });
        }
      }

      res.json({
        total: entries.length,
        succeeded,
        failed,
        entries: results
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search items by keyword
   * GET /v1/inbox/search
   */
  searchItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const query = searchSchema.parse(req.query);
      const userId = req.user?.id ?? 'default-user';
      const timezone = this.db.getUserTimezone(userId);

      // Build filter
      const filter: QueryFilter = {
        query: query.q,
        category: query.category as any,
        limit: query.limit ?? 20,
        offset: 0
      };

      // Get items
      const items = this.db.getItemsByUserId(userId, filter);

      // Filter by keyword in content (additional filtering on top of database query)
      const filteredItems = items.filter(item =>
        item.originalContent.includes(query.q)
      );

      res.json({
        entries: filteredItems.map(item => ({
          id: item.id,
          content: item.originalContent,
          source: item.source,
          category: item.category,
          entities: item.entities,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          createdAtLocal: timezone ? formatDateInTimeZone(item.createdAt, timezone) : null
        }))
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_INPUT',
          message: 'Invalid query parameters',
          details: error.errors
        });
        return;
      }
      next(error);
    }
  };

  private resolveContentType(content: string, explicitType?: string): ContentType {
    if (explicitType) {
      return explicitType as ContentType;
    }

    const trimmed = content.trim();
    if (isLikelyUrl(trimmed)) {
      return ContentType.URL;
    }

    return ContentType.TEXT;
  }

  /**
   * Async item processing with AI
   */
  private async processItemAsync(itemId: string): Promise<void> {
    try {
      logger.info(`[AI Processing] Starting for item ${itemId}`);

      // Update status to processing
      this.db.updateItem(itemId, { status: ItemStatus.PROCESSING });

      // Get item
      const item = this.db.getItemById(itemId);
      if (!item) {
        logger.error(`[AI Processing] Item ${itemId} not found`);
        return;
      }

      logger.info(`[AI Processing] Analyzing content: "${item.originalContent.substring(0, 50)}..."`);

      // Analyze with AI
      const analysis = await this.ai.analyzeContent(item.originalContent, item.contentType, {
        userId: item.userId
      });

      logger.info(`[AI Processing] Analysis result: category=${analysis.category}, confidence=${analysis.confidence}`);

      // Determine status based on analysis quality
      // Mark as failed if category is unknown and confidence is low
      const shouldMarkAsFailed =
        analysis.category === 'unknown' &&
        (typeof analysis.confidence !== 'number' || analysis.confidence < 0.5);

      if (shouldMarkAsFailed) {
        logger.warn(`[AI Processing] Item ${itemId} marked as failed: category=unknown, confidence=${analysis.confidence}`);
      }

      // Update with AI results
      // Preserve file metadata if present
      const fileMetadata = {
        filePath: item.entities?.filePath,
        fileName: item.entities?.fileName,
        fileSize: item.entities?.fileSize,
        mimeType: item.entities?.mimeType,
        // Preserve allFiles array for multi-file items
        allFiles: item.entities?.allFiles
      };

      const updatedItem = this.db.updateItem(itemId, {
        category: analysis.category,
        entities: { ...analysis.entities, ...fileMetadata },
        summary: analysis.summary,
        suggestedTitle: analysis.suggestedTitle,
        aiConfidence: analysis.confidence,
        aiReasoning: analysis.reasoning,
        aiPromptVersion: analysis.metadata?.promptVersion,
        aiModel: analysis.metadata?.model,
        aiParseStatus: shouldMarkAsFailed ? 'failed' : 'success',
        status: shouldMarkAsFailed ? ItemStatus.FAILED : ItemStatus.COMPLETED,
        processedAt: new Date()
      });

      if (shouldMarkAsFailed) {
        sseManager.sendToItem(itemId, {
          type: 'ai.failed',
          itemId,
          timestamp: new Date().toISOString(),
          data: {
            message: `AI confidence too low (category=${analysis.category || 'unknown'})`,
            error: analysis.confidence !== undefined ? `confidence=${analysis.confidence}` : undefined
          }
        });
      } else {
        // Send AI completion event for notifications
        sseManager.sendToItem(itemId, {
          type: 'ai.completed',
          itemId,
          timestamp: new Date().toISOString(),
          data: {
            category: analysis.category,
            summary: analysis.summary,
            suggestedTitle: analysis.suggestedTitle,
            confidence: analysis.confidence
          }
        });
      }

      // Only trigger distribution for successfully processed items
      if (!shouldMarkAsFailed && updatedItem) {
        await this.distributeItemAsync(updatedItem);
      }

      logger.info(`[AI Processing] Completed for item ${itemId}`);
    } catch (error) {
      logger.error(`[AI Processing] Failed for item ${itemId}: ${error}`);
      if (error instanceof Error) {
        logger.error(`[AI Processing] Error details: ${error.message}\n${error.stack}`);
      }
      this.db.updateItem(itemId, {
        status: ItemStatus.FAILED,
        aiParseStatus: 'failed',
        processedAt: new Date()
      });
      sseManager.sendToItem(itemId, {
        type: 'ai.failed',
        itemId,
        timestamp: new Date().toISOString(),
        data: {
          message: 'AI processing failed',
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Async item distribution with SSE progress
   */
  private async distributeItemAsync(item: Item): Promise<void> {
    try {
      logger.info(`Starting distribution for item ${item.id}`);
      
      // 1. Check if there are any active routing rules
      const rules = this.db.database.prepare(`
        SELECT COUNT(*) as count FROM routing_rules
        WHERE user_id = ? AND is_active = 1
      `).get(item.userId) as any;

      const ruleCount = rules?.count || 0;

      if (ruleCount === 0) {
        // No rules configured, mark as skipped
        logger.info(`No routing rules configured for user ${item.userId}, skipping distribution for item ${item.id}`);
        
        this.db.updateItem(item.id, {
          routingStatus: 'skipped'
        });

        // Send skipped event
        sseManager.sendToItem(item.id, {
          type: 'routing:skipped',
          itemId: item.id,
          timestamp: new Date().toISOString(),
          data: {
            message: '未配置路由规则'
          }
        });

        return;
      }

      // 2. Mark as processing
      this.db.updateItem(item.id, {
        routingStatus: 'processing'
      });
      
      // 3. Send start event
      sseManager.sendToItem(item.id, {
        type: 'routing:start',
        itemId: item.id,
        timestamp: new Date().toISOString(),
        data: {
          totalRules: ruleCount,
          message: '开始路由分发...'
        }
      });

      // 4. Create progress callback
      const progressCallback = (event: any) => {
        // Convert routing service progress events to SSE events
        this.handleRoutingProgress(item.id, event);
      };

      // 5. Execute routing rules
      const results = await this.router.executeRoutingRules(item, progressCallback);

      // 6. Process results
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      logger.info(`Distribution completed for item ${item.id}: ${successCount} success, ${failedCount} failed`);

      // Store distribution targets
      const distributedTargets = results
        .filter(r => r.status === 'success')
        .map(r => r.targetId);

      // Get successful rule names
      const successRuleNames = results
        .filter((r): r is typeof r & { ruleName: string } =>
          r.status === 'success' && typeof r.ruleName === 'string' && r.ruleName.length > 0
        )
        .map((r) => r.ruleName);

      const totalAttempts = successCount + failedCount;

      if (totalAttempts === 0) {
        logger.info(`No routing rule matched for item ${item.id}, marking routing as skipped`);

        this.db.updateItem(item.id, {
          distributedTargets,
          distributionResults: results,
          routingStatus: 'skipped'
        });

        sseManager.sendToItem(item.id, {
          type: 'routing:skipped',
          itemId: item.id,
          timestamp: new Date().toISOString(),
          data: {
            message: '未匹配到可分发规则'
          }
        });

        return;
      }

      // 7. Update item with results and mark as completed
      this.db.updateItem(item.id, {
        distributedTargets,
        distributionResults: results,
        routingStatus: 'completed'
      });

      // 8. Send completion event
      sseManager.sendToItem(item.id, {
        type: 'routing:complete',
        itemId: item.id,
        timestamp: new Date().toISOString(),
        data: {
          distributedTargets,
          ruleNames: successRuleNames,
          totalSuccess: successCount,
          totalFailed: failedCount,
          message: successRuleNames.length > 0
            ? `已分发到: ${successRuleNames.join(', ')}`
            : '路由分发完成'
        }
      });

    } catch (error) {
      logger.error(`Distribution failed for item ${item.id}:`, error);
      
      // Mark as failed
      this.db.updateItem(item.id, {
        routingStatus: 'failed'
      });
      
      // Send error event
      sseManager.sendToItem(item.id, {
        type: 'routing:error',
        itemId: item.id,
        timestamp: new Date().toISOString(),
        data: {
          message: '路由分发失败',
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 处理路由进度事件，转换为 SSE 事件
   */
  private handleRoutingProgress(itemId: string, event: any): void {
    try {
      // 根据事件类型转换为对应的 SSE 事件
      switch (event.type) {
        case 'rules_loaded':
          sseManager.sendToItem(itemId, {
            type: 'routing:start',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              totalRules: event.data?.totalRules || 0,
              message: `找到 ${event.data?.totalRules || 0} 条路由规则`
            }
          });
          break;

        case 'rule_matched': {
          const targetName = String(event.data?.targetName || '').trim();
          const ruleName = event.data?.ruleName || '未知规则';
          sseManager.sendToItem(itemId, {
            type: 'routing:rule_match',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              ruleName,
              ruleId: event.data?.ruleId || '',
              targetId: event.data?.targetId || '',
              targetName,
              targetServerType: event.data?.targetServerType || '',
              targetLogoColor: event.data?.targetLogoColor || '',
              message: targetName
                ? `匹配规则: ${ruleName} → ${targetName}`
                : `匹配规则: ${ruleName}`
            }
          });
          break;
        }

        case 'tool_call_start':
          sseManager.sendToItem(itemId, {
            type: 'routing:tool_call_start',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              toolName: event.data?.toolName || '未知工具',
              adapterName: event.data?.adapterName || '未知适配器',
              message: `开始调用 ${event.data?.adapterName || '未知适配器'}.${event.data?.toolName || '未知工具'}`
            }
          });
          break;

        case 'tool_call_progress':
          sseManager.sendToItem(itemId, {
            type: 'routing:tool_call_progress',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              toolName: event.data?.toolName || '未知工具',
              adapterName: event.data?.adapterName || '未知适配器',
              message: event.data?.message || '工具执行中...',
              step: event.data?.step
            }
          });
          break;

        case 'tool_call_success':
          sseManager.sendToItem(itemId, {
            type: 'routing:tool_call_success',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              toolName: event.data?.toolName || '未知工具',
              adapterName: event.data?.adapterName || '未知适配器',
              message: `✓ 成功分发到 ${event.data?.adapterName || '未知适配器'}`,
              result: event.data?.result
            }
          });
          break;

        case 'tool_call_error':
          sseManager.sendToItem(itemId, {
            type: 'routing:tool_call_error',
            itemId,
            timestamp: new Date().toISOString(),
            data: {
              toolName: event.data?.toolName || '未知工具',
              adapterName: event.data?.adapterName || '未知适配器',
              message: `✗ 分发到 ${event.data?.adapterName || '未知适配器'} 失败`,
              error: event.data?.error || '未知错误'
            }
          });
          break;

        // Direct forwarding of DispatcherService raw events
        case 'init':
        case 'tools':
          // Ignore initialization events
          break;

        case 'step:start':
          sseManager.sendToItem(itemId, {
            type: 'step:start',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        case 'step:planned':
          sseManager.sendToItem(itemId, {
            type: 'step:planned',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        case 'step:executing':
          sseManager.sendToItem(itemId, {
            type: 'step:executing',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        case 'step:complete':
          sseManager.sendToItem(itemId, {
            type: 'step:complete',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        case 'step:error':
          sseManager.sendToItem(itemId, {
            type: 'step:error',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        case 'complete':
          sseManager.sendToItem(itemId, {
            type: 'complete',
            itemId,
            timestamp: new Date().toISOString(),
            data: event.data
          });
          break;

        default:
          logger.debug(`Unknown routing progress event: ${event.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle routing progress event:`, error);
    }
  }

  /**
   * Create a new item with file upload
   * POST /v1/inbox/file
   */
  createItemWithFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.NO_FILES',
          message: 'No file uploaded'
        });
        return;
      }

      const file = req.file as Express.Multer.File;
      const userId = req.user?.id ?? 'default-user';
      const content = req.body.content || '';
      const source = req.body.source || 'api';

      // Determine content type from file mimetype
      let contentType: ContentType = ContentType.FILE;
      if (file.mimetype.startsWith('image/')) {
        contentType = ContentType.IMAGE;
      } else if (file.mimetype.startsWith('audio/')) {
        contentType = ContentType.AUDIO;
      } else if (file.mimetype.startsWith('video/')) {
        contentType = ContentType.VIDEO;
      }

      // Create item object with file path
      const item: Item = {
        id: uuidv4(),
        userId,
        originalContent: content,
        contentType,
        source,
        category: 'unknown' as any,
        entities: {
          filePath: file.path,
          fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          fileSize: file.size,
          mimeType: file.mimetype
        },
        status: ItemStatus.PENDING,
        distributedTargets: [],
        distributionResults: [],
        routingStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      this.db.createItem(item);

      const fileType: ItemFileType = file.mimetype.startsWith('image/')
        ? 'image'
        : file.mimetype.startsWith('audio/')
          ? 'audio'
          : file.mimetype.startsWith('video/')
            ? 'video'
            : 'file';

      this.db.addItemFiles([{
        id: uuidv4(),
        itemId: item.id,
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType,
        createdAt: new Date()
      }]);

      // Trigger async AI processing
      this.processItemAsync(item.id).catch(error => {
        console.error(`Failed to process item ${item.id}:`, error);
      });

      // Respond immediately with pending status
      const response: CreateItemResponse = {
        id: item.id,
        status: item.status,
        category: item.category,
        message: 'File uploaded and is being processed'
      };

      res.status(201).json({
        success: true,
        data: response
      });

      logger.info(`[Inbox] Item created with file upload: ${item.id} (${file.originalname})`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new item with multiple file uploads
   * POST /v1/inbox/files
   */
  createItemWithMultipleFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, {
          statusCode: 401,
          code: 'AUTH.UNAUTHORIZED',
          message: 'User not authenticated'
        });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.NO_FILES',
          message: 'No files uploaded'
        });
        return;
      }

      const { content = '', source = 'api' } = req.body;
      const contentType = 'file' as ContentType;

      // Store all files info in entities
      const filesInfo = files.map(file => ({
        filePath: file.path,
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        fileSize: file.size,
        mimeType: file.mimetype
      }));

      const item: Item = {
        id: uuidv4(),
        userId,
        originalContent: content,
        contentType,
        source,
        category: 'unknown' as any,
        entities: {
          // Store primary file info (first file)
          filePath: files[0].path,
          fileName: Buffer.from(files[0].originalname, 'latin1').toString('utf8'),
          fileSize: files[0].size,
          mimeType: files[0].mimetype,
          // Store all files info
          allFiles: filesInfo
        },
        status: ItemStatus.PENDING,
        distributedTargets: [],
        distributionResults: [],
        routingStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.db.createItem(item);

      const itemFiles = files.map((entry) => {
        const fileName = Buffer.from(entry.originalname, 'latin1').toString('utf8');
        const fileType: ItemFileType = entry.mimetype.startsWith('image/')
          ? 'image'
          : entry.mimetype.startsWith('audio/')
            ? 'audio'
            : 'file';

        return {
          id: uuidv4(),
          itemId: item.id,
          fileName,
          filePath: entry.path,
          fileSize: entry.size,
          mimeType: entry.mimetype,
          fileType,
          createdAt: new Date()
        };
      });

      this.db.addItemFiles(itemFiles);

      // Trigger async AI processing
      this.processItemAsync(item.id).catch(error => {
        console.error(`Failed to process item ${item.id}:`, error);
      });

      const response: CreateItemResponse = {
        id: item.id,
        status: item.status,
        category: item.category,
        message: `${files.length} files uploaded and are being processed`
      };

      res.status(201).json({
        success: true,
        data: response
      });

      logger.info(`[Inbox] Item created with multiple files: ${item.id} (${files.length} files)`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Serve uploaded file for inline viewing
   * GET /v1/inbox/:id/file
   * GET /v1/inbox/:id/file/:index (for multi-file items)
   */
  serveFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, index } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);
      if (!item || item.userId !== userId) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      let filePath: string;
      let fileName: string;
      let mimeType: string;

      // If index is provided and allFiles exists, serve specific file
      if (index !== undefined && item.entities?.allFiles) {
        const fileIndex = parseInt(index);
        const allFiles = item.entities.allFiles as Array<{
          filePath: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        }>;

        if (fileIndex >= 0 && fileIndex < allFiles.length) {
          const targetFile = allFiles[fileIndex];
          filePath = targetFile.filePath;
          fileName = targetFile.fileName;
          mimeType = targetFile.mimeType;
        } else {
          sendError(res, {
            statusCode: 404,
            code: 'INBOX.FILE_INDEX_OUT_OF_RANGE',
            message: 'File index out of range',
            params: { index: fileIndex }
          });
          return;
        }
      } else {
        // Serve primary file (backward compatibility)
        filePath = item.entities?.filePath as string;
        fileName = (item.entities?.fileName as string) || path.basename(filePath || '');
        mimeType = (item.entities?.mimeType as string) || 'application/octet-stream';
      }

      if (!filePath || !fs.existsSync(filePath)) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.FILE_NOT_FOUND',
          message: 'File not found',
          params: { id }
        });
        return;
      }

      // Use RFC 5987 for non-ASCII filenames.
      const encodedFileName = encodeURIComponent(fileName);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Type', mimeType);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Download uploaded file as attachment
   * GET /v1/inbox/:id/file/download
   * GET /v1/inbox/:id/file/:index/download (for multi-file items)
   */
  downloadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, index } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);
      if (!item || item.userId !== userId) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      let filePath: string;
      let fileName: string;
      let mimeType: string;

      if (index !== undefined && item.entities?.allFiles) {
        const fileIndex = parseInt(index);
        const allFiles = item.entities.allFiles as Array<{
          filePath: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        }>;

        if (fileIndex >= 0 && fileIndex < allFiles.length) {
          const targetFile = allFiles[fileIndex];
          filePath = targetFile.filePath;
          fileName = targetFile.fileName;
          mimeType = targetFile.mimeType;
        } else {
          sendError(res, {
            statusCode: 404,
            code: 'INBOX.FILE_INDEX_OUT_OF_RANGE',
            message: 'File index out of range',
            params: { index: fileIndex }
          });
          return;
        }
      } else {
        filePath = item.entities?.filePath as string;
        fileName = (item.entities?.fileName as string) || path.basename(filePath || '');
        mimeType = (item.entities?.mimeType as string) || 'application/octet-stream';
      }

      if (!filePath || !fs.existsSync(filePath)) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.FILE_NOT_FOUND',
          message: 'File not found',
          params: { id }
        });
        return;
      }

      const encodedFileName = encodeURIComponent(fileName);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Type', mimeType);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Retry AI processing for failed items
   * POST /v1/inbox/:id/retry
   */
  retryAIProcessing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);

      if (!item) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      // Check ownership
      if (item.userId !== userId) {
        sendError(res, {
          statusCode: 403,
          code: 'AUTH.FORBIDDEN',
          message: 'Access denied'
        });
        return;
      }

      // Only allow retry for failed items
      if (item.status !== 'failed') {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_STATUS',
          message: 'Only failed items can be retried',
          params: { status: item.status }
        });
        return;
      }

      // Reset status to pending and trigger processing
      this.db.updateItem(id, { 
        status: ItemStatus.PENDING,
        updatedAt: new Date()
      });

      // Trigger async AI processing
      this.processItemAsync(item.id).catch(error => {
        console.error(`Failed to retry processing item ${item.id}:`, error);
      });

      res.json({
        success: true,
        data: {
          message: 'AI processing retry triggered',
          status: 'pending'
        }
      });

      logger.info(`[Inbox] AI processing retry triggered for item ${item.id}`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reclassify an item regardless of status
   * POST /v1/inbox/:id/reclassify
   */
  reclassifyItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? 'default-user';

      const item = this.db.getItemById(id);

      if (!item) {
        sendError(res, {
          statusCode: 404,
          code: 'INBOX.NOT_FOUND',
          message: 'Item not found',
          params: { id }
        });
        return;
      }

      // Check ownership
      if (item.userId !== userId) {
        sendError(res, {
          statusCode: 403,
          code: 'AUTH.FORBIDDEN',
          message: 'Access denied'
        });
        return;
      }

      if (item.status === 'processing') {
        sendError(res, {
          statusCode: 400,
          code: 'INBOX.INVALID_STATUS',
          message: 'Item is already processing',
          params: { status: item.status }
        });
        return;
      }

      const fileMetadata = {
        filePath: item.entities?.filePath,
        fileName: item.entities?.fileName,
        fileSize: item.entities?.fileSize,
        mimeType: item.entities?.mimeType,
        allFiles: item.entities?.allFiles
      };

      // Reset status and derived fields, keep file metadata
      this.db.updateItem(id, {
        status: ItemStatus.PENDING,
        category: 'unknown' as any,
        entities: fileMetadata,
        summary: undefined,
        suggestedTitle: undefined,
        processedAt: undefined
      });

      // Trigger async AI processing
      this.processItemAsync(item.id).catch(error => {
        console.error(`Failed to reclassify item ${item.id}:`, error);
      });

      res.json({
        success: true,
        data: {
          message: 'AI reclassification triggered',
          status: 'pending'
        }
      });

      logger.info(`[Inbox] AI reclassification triggered for item ${item.id}`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get routing progress via SSE
   * GET /v1/inbox/:id/routing-progress
   */
  getRoutingProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }

      // 验证条目存在且属于当前用户
      const item = this.db.getItemById(id);
      if (!item) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Item not found');
        return;
      }

      if (item.userId !== userId) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }

      // 创建 SSE 连接
      const connectionId = sseManager.createConnection(id, userId, res);
      
      // 如果条目已经完成分发，立即发送完成事件
      if (item.distributedTargets && item.distributedTargets.length > 0) {
        // 从 distributionResults 中提取规则名称
        const successRuleNames = (item.distributionResults || [])
          .filter((r: any) => r.ruleName && (r.status === 'success' || r.status === 'completed'))
          .map((r: any) => r.ruleName);

        sseManager.sendToItem(id, {
          type: 'routing:complete',
          itemId: id,
          timestamp: new Date().toISOString(),
          data: {
            distributedTargets: item.distributedTargets,
            ruleNames: successRuleNames,
            totalSuccess: item.distributedTargets.length,
            totalFailed: 0,
            message: successRuleNames.length > 0
              ? `已分发: ${successRuleNames.join(', ')}`
              : `已分发到 ${item.distributedTargets.length} 个目标`
          }
        });
      } else if (item.status === 'processing') {
        // 如果正在处理中，发送处理中事件
        sseManager.sendToItem(id, {
          type: 'routing:start',
          itemId: id,
          timestamp: new Date().toISOString(),
          data: {
            totalRules: 0, // 将在实际分发时更新
            message: '正在分析路由规则...'
          }
        });
      } else {
        // 发送待配置状态
        sseManager.sendToItem(id, {
          type: 'routing:start',
          itemId: id,
          timestamp: new Date().toISOString(),
          data: {
            totalRules: 0,
            message: '分发规则待配置'
          }
        });
      }

      logger.info(`[SSE] Routing progress connection established for item ${id}, connection ${connectionId}`);
    } catch (error) {
      logger.error('[SSE] Failed to establish routing progress connection:', error);
      
      // 对于 SSE 连接，直接返回错误响应
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
    }
  };
}

const isLikelyUrl = (value: string): boolean => {
  if (!value || /\\s/.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const inboxController = new InboxController();

// Re-export batch redistribute controller
export { batchRedistributeController } from './bredistribute.controller.js';
