/**
 * Batch Redistribute Controller
 * Safely redistribute items with rate limiting and progress tracking
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../../storage/database.js';
import { getRouterService } from '../../router/router.service.js';
import { sendError } from '../../utils/error-response.js';
import { logger } from '../../middleware/logger.js';
import type { Item } from '../../types/index.js';

interface BatchRedistributeOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  maxConcurrent?: number;
  filter?: {
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
}

export class BatchRedistributeController {
  private db = getDatabase();
  private router = getRouterService();

  /**
   * Batch redistribute items with safety controls
   * POST /v1/inbox/batch-redistribute
   */
  batchRedistribute = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';
      const options: BatchRedistributeOptions = req.body;

      // Validate options
      const batchSize = options.batchSize ?? 10;
      const delayBetweenBatches = options.delayBetweenBatches ?? 5000;
      const maxConcurrent = options.maxConcurrent ?? 2;

      if (batchSize < 1 || batchSize > 100) {
        sendError(res, {
          statusCode: 400,
          code: 'INVALID_BATCH_SIZE',
          message: 'batchSize must be between 1 and 100'
        });
        return;
      }

      if (delayBetweenBatches < 1000) {
        sendError(res, {
          statusCode: 400,
          code: 'INVALID_DELAY',
          message: 'delayBetweenBatches must be at least 1000ms'
        });
        return;
      }

      // Get items to redistribute
      const items = this.getItemsToRedistribute(userId, options.filter);

      if (items.length === 0) {
        res.json({
          success: true,
          data: {
            total: 0,
            message: 'No items found matching filter'
          }
        });
        return;
      }

      // Start async batch redistribution
      this.processBatches(items, {
        batchSize,
        delayBetweenBatches,
        maxConcurrent,
        userId
      }).catch(error => {
        logger.error(`Batch redistribution failed: ${error}`);
      });

      res.json({
        success: true,
        data: {
          total: items.length,
          batchSize,
          estimatedBatches: Math.ceil(items.length / batchSize),
          estimatedDurationMinutes: Math.ceil((items.length / batchSize) * (delayBetweenBatches / 1000) / 60),
          message: 'Batch redistribution started'
        }
      });
    } catch (error) {
      logger.error(`Batch redistribute error: ${error}`);
      sendError(res, {
        statusCode: 500,
        code: 'BATCH_REDISTRIBUTE_FAILED',
        message: 'Failed to start batch redistribution'
      });
    }
  };

  /**
   * Get batch redistribution status
   * GET /v1/inbox/batch-redistribute/status
   */
  getBatchStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id ?? 'default-user';

      // Get recent distribution results as status
      const stmt = this.db.database.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          MAX(timestamp) as last_distribution
        FROM distribution_results
        WHERE item_id IN (
          SELECT id FROM items WHERE user_id = ?
        )
      `);

      const stats = stmt.get(userId) as any;

      res.json({
        success: true,
        data: {
          total: stats.total || 0,
          success: stats.success || 0,
          failed: stats.failed || 0,
          lastDistribution: stats.last_distribution
        }
      });
    } catch (error) {
      logger.error(`Get batch status error: ${error}`);
      sendError(res, {
        statusCode: 500,
        code: 'BATCH_STATUS_FAILED',
        message: 'Failed to get batch status'
      });
    }
  };

  /**
   * Get items matching filter for redistribution
   */
  private getItemsToRedistribute(userId: string, filter?: any): Item[] {
    let query = 'SELECT * FROM items WHERE user_id = ?';
    const params: any[] = [userId];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.category) {
      query += ' AND category = ?';
      params.push(filter.category);
    }

    if (filter?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filter.startDate);
    }

    if (filter?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filter.endDate);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.database.prepare(query).all(...params) as Array<{ id: string }>;
    const items: Item[] = [];

    for (const row of rows) {
      const item = this.db.getItemById(row.id);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Process items in batches with safety delays
   */
  private async processBatches(
    items: Item[],
    options: {
      batchSize: number;
      delayBetweenBatches: number;
      maxConcurrent: number;
      userId: string;
    }
  ): Promise<void> {
    const { batchSize, delayBetweenBatches } = options;

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(items.length / batchSize);

      logger.info(`[Batch Redistribute] Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      // Process batch with concurrency limit
      const batchPromises = batch.map(item =>
        this.distributeSingleItem(item).then(result => {
          if (result.status === 'success') {
            successCount++;
          } else {
            failCount++;
          }
          return result;
        }).catch(error => {
          failCount++;
          logger.error(`[Batch Redistribute] Failed to distribute item ${item.id}:`, error);
        })
      );

      await Promise.all(batchPromises);

      logger.info(`[Batch Redistribute] Batch ${batchNumber} complete. Success: ${successCount}, Failed: ${failCount}`);

      // Delay between batches (except for last batch)
      if (i + batchSize < items.length) {
        logger.info(`[Batch Redistribute] Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info(`[Batch Redistribute] Complete. Total: ${items.length}, Success: ${successCount}, Failed: ${failCount}`);
  }

  /**
   * Distribute a single item
   */
  private async distributeSingleItem(item: Item): Promise<any> {
    const results = await this.router.distributeItem(item);

    // Update item with results
    const distributedTargets = results
      .filter(r => r.status === 'success')
      .map(r => r.targetId);

    this.db.updateItem(item.id, {
      distributedTargets,
      distributionResults: results
    });

    return {
      itemId: item.id,
      status: results.some(r => r.status === 'success') ? 'success' : 'failed',
      results
    };
  }
}

export const batchRedistributeController = new BatchRedistributeController();
