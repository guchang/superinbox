/**
 * Settings Layer - Settings Routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { getDatabase } from '../../storage/database.js';
import { isValidTimeZone } from '../../utils/timezone.js';

const router = Router();
const timezoneSchema = z.object({
  timezone: z.string().min(1)
});

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

    // Count by category
    const itemsByCategory: Record<string, number> = {
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
      // Count by category
      const category = item.category || 'unknown';
      itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;

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
        itemsByCategory,
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

// User timezone settings
router.get('/timezone', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();
    const timezone = db.getUserTimezone(userId);

    res.json({
      success: true,
      data: {
        timezone
      }
    });
  } catch (error) {
    console.error('Timezone fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timezone'
    });
  }
});

router.put('/timezone', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = timezoneSchema.parse(req.body);

    if (!isValidTimeZone(body.timezone)) {
      res.status(400).json({
        success: false,
        error: 'Invalid time zone'
      });
      return;
    }

    const db = getDatabase();
    const result = db.setUserTimezone(userId, body.timezone);

    res.json({
      success: true,
      data: {
        timezone: result.timezone,
        updatedAt: result.updatedAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
      return;
    }
    console.error('Timezone update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timezone'
    });
  }
});

// API Keys endpoints - DEPRECATED
// These endpoints are now available at /v1/auth/api-keys
// This route is kept for backward compatibility and will be removed in v0.2.0

router.get('/api-keys', authenticate, (req, res) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Deprecation-Message', 'Use GET /v1/auth/api-keys instead');
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
    ],
    _warning: 'This endpoint is deprecated. Use /v1/auth/api-keys instead.'
  });
});

router.post('/api-keys', authenticate, (req, res) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Deprecation-Message', 'Use POST /v1/auth/api-keys instead');
  res.json({
    success: true,
    data: {
      id: Date.now().toString(),
      keyValue: `sinbox_${Math.random().toString(36).substring(2)}`,
      ...req.body,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    _warning: 'This endpoint is deprecated. Use /v1/auth/api-keys instead.'
  });
});

router.delete('/api-keys/:id', authenticate, (req, res) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Deprecation-Message', 'Use DELETE /v1/auth/api-keys/:id instead');
  res.json({
    success: true,
    _warning: 'This endpoint is deprecated. Use /v1/auth/api-keys/:id instead.'
  });
});

// Logs endpoint - DEPRECATED
// Will be removed in v0.2.0
router.get('/logs', authenticate, (req, res) => {
  res.setHeader('X-Deprecated', 'true');
  res.setHeader('X-Deprecation-Message', 'This endpoint will be removed in v0.2.0');
  res.json({
    success: true,
    data: {
      logs: [],
      total: 0,
    },
    _warning: 'This endpoint is deprecated and will be removed in v0.2.0. Use proper logging infrastructure instead.'
  });
});

export default router;
