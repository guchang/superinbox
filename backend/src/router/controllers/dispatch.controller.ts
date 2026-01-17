/**
 * Dispatch Controller - Manual item distribution endpoint
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../../storage/database.js';
import { getRouterService } from '../router.service.js';

/**
 * Dispatch an item to configured adapters
 * POST /v1/routing/dispatch/:id
 */
export async function dispatchItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { adapters, force = false } = req.body;
    const userId = req.user?.userId ?? 'default-user';
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

    // Trigger distribution (ignore adapters/force for now, will be implemented later)
    const routerService = getRouterService();
    const results = await routerService.distributeItem(item);

    // Filter results if specific adapters requested
    let filteredResults = results;
    if (adapters && Array.isArray(adapters) && adapters.length > 0) {
      filteredResults = results.filter(r => adapters.includes(r.adapterType));
    }

    res.json({
      entryId: id,
      dispatched: filteredResults.map(r => ({
        adapter: r.targetId,
        status: r.status,
        message: r.message || r.error || 'Dispatch completed'
      }))
    });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTING_DISPATCH_FAILED',
        message: 'Failed to dispatch item',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }
}
