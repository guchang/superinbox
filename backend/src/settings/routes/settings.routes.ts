/**
 * Settings Layer - Settings Routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getDatabase } from '../../storage/database.js';

const router = Router();

// Statistics endpoint
router.get('/statistics', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();

    // Get all items for the user
    const allItems = db.getItemsByUserId(userId, {});

    // Calculate statistics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const totalItems = allItems.length;

    // Count by intent
    const itemsByIntent: Record<string, number> = {
      todo: 0,
      idea: 0,
      expense: 0,
      schedule: 0,
      note: 0,
      bookmark: 0,
      unknown: 0,
    };

    // Count by status
    const itemsByStatus: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      archived: 0,
    };

    // Count by source
    const itemsBySource: Record<string, number> = {};

    // Count by time range
    let todayItems = 0;
    let weekItems = 0;
    let monthItems = 0;

    // Calculate processing time
    let totalProcessingTime = 0;
    let processedCount = 0;

    allItems.forEach((item) => {
      // Count by intent
      const intent = item.intent || 'unknown';
      itemsByIntent[intent] = (itemsByIntent[intent] || 0) + 1;

      // Count by status
      const status = item.status || 'unknown';
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;

      // Count by source
      const source = item.source || 'unknown';
      itemsBySource[source] = (itemsBySource[source] || 0) + 1;

      // Count by time range
      const createdAt = new Date(item.createdAt).getTime();
      if (createdAt >= todayStart) todayItems++;
      if (createdAt >= weekStart) weekItems++;
      if (createdAt >= monthStart) monthItems++;

      // Calculate processing time
      if (item.processedAt && item.createdAt) {
        const processingTime = new Date(item.processedAt).getTime() - new Date(item.createdAt).getTime();
        totalProcessingTime += processingTime;
        processedCount++;
      }
    });

    const avgProcessingTime = processedCount > 0
      ? Math.round((totalProcessingTime / processedCount / 1000) * 10) / 10 // in seconds
      : 0;

    const aiSuccessRate = totalItems > 0
      ? Math.round(((itemsByStatus.completed || 0) / totalItems) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalItems,
        itemsByIntent,
        itemsByStatus,
        itemsBySource,
        avgProcessingTime,
        todayItems,
        weekItems,
        monthItems,
        aiSuccessRate,
      }
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// API Keys endpoints
router.get('/api-keys', authenticate, (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        keyValue: 'dev-key-change-this-in-production',
        name: 'Development Key',
        scopes: ['full'],
        userId: 'default-user',
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    ]
  });
});

router.post('/api-keys', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      keyValue: `sinbox_${Math.random().toString(36).substring(2)}`,
      ...req.body,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
  });
});

router.delete('/api-keys/:id', authenticate, (req, res) => {
  res.json({ success: true });
});

// Logs endpoint
router.get('/logs', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      logs: [],
      total: 0,
    }
  });
});

export default router;
