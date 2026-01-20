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
import type {
  CreateItemRequest,
  CreateItemResponse,
  Item,
  ItemStatus,
  Priority,
  QueryFilter
} from '../../types/index.js';
import { ContentType } from '../../types/index.js';
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

const batchCreateSchema = z.object({
  entries: z.array(z.object({
    content: z.string().min(1, 'Content is required').max(10000),
    type: z.enum(['text', 'image', 'url', 'audio', 'file', 'mixed']).optional(),
    source: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional()
  })).min(1, 'At least one entry is required')
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
        category: item.category,
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
   * GET /v1/items/:id and GET /v1/inbox/:id
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

      // Determine response format based on route path
      // GET /v1/inbox/:id -> new API format (unwrapped)
      // GET /v1/items/:id -> legacy API format (wrapped)
      const isInboxRoute = req.originalUrl?.includes('/inbox/') || req.url?.includes('/inbox/');

      if (isInboxRoute) {
        // New API format (GET /v1/inbox/:id)
        res.json({
          id: item.id,
          content: item.originalContent,
          source: item.source,
          parsed: {
            category: item.category,
            confidence: 1.0, // Default confidence as it's not stored in current model
            entities: item.entities
          },
          routingHistory: item.distributionResults.map(result => ({
            adapter: result.targetId,
            status: result.status,
            timestamp: result.timestamp || new Date().toISOString()
          })),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        });
      } else {
        // Legacy API format (GET /v1/items/:id)
        res.json({
          success: true,
          data: item
        });
      }
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
        category: req.query.category as any,
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
            category: item.category,
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
   * Delete item from inbox (new API format)
   * DELETE /v1/inbox/:id
   */
  deleteItemFromInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      this.db.deleteItem(id);

      res.json({
        success: true,
        message: '记录已删除'
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
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entries must be a non-empty array'
          }
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
          createdAt: item.createdAt.toISOString()
        }))
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors
          }
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
      this.db.updateItem(itemId, { status: 'processing' });

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
        (!analysis.confidence || analysis.confidence < 0.3);

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

      this.db.updateItem(itemId, {
        category: analysis.category,
        entities: { ...analysis.entities, ...fileMetadata },
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

  /**
   * Create a new item with file upload
   * POST /v1/inbox/file
   */
  createItemWithFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const file = req.file as Express.Multer.File;
      const userId = req.user?.id ?? 'default-user';
      const content = req.body.content || `File: ${file.originalname}`;
      const source = req.body.source || 'api';

      // Determine content type from file mimetype
      let contentType: ContentType = ContentType.FILE;
      if (file.mimetype.startsWith('image/')) {
        contentType = ContentType.IMAGE;
      } else if (file.mimetype.startsWith('audio/')) {
        contentType = ContentType.AUDIO;
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
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files uploaded' });
        return;
      }

      const { content = '', source = 'api' } = req.body;
      const contentType = 'file' as ContentType;

      // Create file list for content
      const fileList = files.map(file => `📎 ${Buffer.from(file.originalname, 'latin1').toString('utf8')} (${(file.size / 1024).toFixed(1)}KB)`).join('\n');
      const finalContent = content ? 
        `${content}\n\n附件 (${files.length} 个文件):\n${fileList}` :
        `多文件上传 (${files.length} 个文件):\n${fileList}`;

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
        originalContent: finalContent,
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
        status: 'pending' as ItemStatus,
        priority: 'medium' as Priority,
        distributedTargets: [],
        distributionResults: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.db.createItem(item);

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
        res.status(404).json({ success: false, error: 'Item not found' });
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
          res.status(404).json({ success: false, error: 'File index out of range' });
          return;
        }
      } else {
        // Serve primary file (backward compatibility)
        filePath = item.entities?.filePath as string;
        fileName = (item.entities?.fileName as string) || path.basename(filePath || '');
        mimeType = (item.entities?.mimeType as string) || 'application/octet-stream';
      }

      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }

      // 使用 RFC 5987 标准处理中文文件名
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
        res.status(404).json({ success: false, error: 'Item not found' });
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
          res.status(404).json({ success: false, error: 'File index out of range' });
          return;
        }
      } else {
        filePath = item.entities?.filePath as string;
        fileName = (item.entities?.fileName as string) || path.basename(filePath || '');
        mimeType = (item.entities?.mimeType as string) || 'application/octet-stream';
      }

      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: 'File not found' });
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

      // Only allow retry for failed items
      if (item.status !== 'failed') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Only failed items can be retried'
          }
        });
        return;
      }

      // Reset status to pending and trigger processing
      this.db.updateItem(id, { 
        status: 'pending',
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

      if (item.status === 'processing') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Item is already processing'
          }
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
        status: 'pending',
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
