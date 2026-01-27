/**
 * Settings Layer - Settings Routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { getDatabase } from '../../storage/database.js';
import { config as appConfig } from '../../config/index.js';
import { isValidTimeZone } from '../../utils/timezone.js';
import { sendError } from '../../utils/error-response.js';

const router = Router();
const timezoneSchema = z.object({
  timezone: z.string().min(1)
});
const llmConfigSchema = z.object({
  provider: z.string().trim().min(1).optional().nullable(),
  model: z.string().trim().min(1).optional().nullable(),
  baseUrl: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().optional().nullable(),
  timeout: z.number().int().positive().optional().nullable(),
  maxTokens: z.number().int().positive().optional().nullable(),
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
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch statistics'
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
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch timezone'
    });
  }
});

router.put('/timezone', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = timezoneSchema.parse(req.body);

    if (!isValidTimeZone(body.timezone)) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_TIMEZONE',
        message: 'Invalid time zone',
        params: { timezone: body.timezone }
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
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'Invalid request body'
      });
      return;
    }
    console.error('Timezone update error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update timezone'
    });
  }
});

const normalizeOptionalString = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildLlmResponse = (userConfig: {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  timeout: number | null;
  maxTokens: number | null;
}) => {
  const effective = {
    provider: userConfig.provider ?? appConfig.llm.provider,
    model: userConfig.model ?? appConfig.llm.model,
    baseUrl: userConfig.baseUrl ?? appConfig.llm.baseUrl ?? null,
    timeout: userConfig.timeout ?? appConfig.llm.timeout,
    maxTokens: userConfig.maxTokens ?? appConfig.llm.maxTokens,
  };

  return {
    provider: effective.provider,
    model: effective.model,
    baseUrl: effective.baseUrl,
    timeout: effective.timeout,
    maxTokens: effective.maxTokens,
    apiKeyConfigured: Boolean(userConfig.apiKey),
  };
};

// User LLM configuration settings
router.get('/llm', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();
    const userConfig = db.getUserLlmConfig(userId);

    res.json({
      success: true,
      data: buildLlmResponse(userConfig)
    });
  } catch (error) {
    console.error('LLM config fetch error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch LLM configuration'
    });
  }
});

router.put('/llm', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = llmConfigSchema.parse(req.body);
    const updates = {
      provider: normalizeOptionalString(body.provider),
      model: normalizeOptionalString(body.model),
      baseUrl: normalizeOptionalString(body.baseUrl),
      apiKey: normalizeOptionalString(body.apiKey),
      timeout: body.timeout === undefined ? undefined : body.timeout,
      maxTokens: body.maxTokens === undefined ? undefined : body.maxTokens,
    };

    const hasUpdates = Object.values(updates).some((value) => value !== undefined);
    if (!hasUpdates) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'No valid LLM config fields provided'
      });
      return;
    }

    const db = getDatabase();
    db.setUserLlmConfig(userId, updates);
    const userConfig = db.getUserLlmConfig(userId);

    res.json({
      success: true,
      data: buildLlmResponse(userConfig)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'Invalid request body'
      });
      return;
    }
    console.error('LLM config update error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update LLM configuration'
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
