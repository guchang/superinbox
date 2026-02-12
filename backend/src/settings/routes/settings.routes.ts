/**
 * Settings Layer - Settings Routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { getDatabase } from '../../storage/database.js';
import { isValidTimeZone } from '../../utils/timezone.js';
import { sendError } from '../../utils/error-response.js';
import { LLMClient } from '../../ai/llm-client.js';

const router = Router();
const timezoneSchema = z.object({
  timezone: z.string().min(1)
});

const llmConfigCreateSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  baseUrl: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().min(1),
  timeout: z.number().int().positive().optional().nullable(),
  maxTokens: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

const llmConfigTestPayloadSchema = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  baseUrl: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().min(1),
  timeout: z.number().int().positive().optional().nullable(),
  maxTokens: z.number().int().positive().optional().nullable(),
});

const llmConfigUpdateSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  provider: z.string().trim().min(1).optional().nullable(),
  model: z.string().trim().min(1).optional().nullable(),
  baseUrl: z.string().trim().optional().nullable(),
  apiKey: z.string().trim().optional().nullable(),
  timeout: z.number().int().positive().optional().nullable(),
  maxTokens: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

const llmConfigReorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1),
});

// Statistics endpoint
router.get('/statistics', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const db = getDatabase();

    const allItems = db.getItemsByUserId(userId, {});

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const totalItems = allItems.length;

    const itemsByCategory: Record<string, number> = {
      todo: 0,
      idea: 0,
      expense: 0,
      schedule: 0,
      note: 0,
      bookmark: 0,
      unknown: 0,
    };

    const itemsByStatus: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      manual: 0,
      failed: 0,
      archived: 0,
    };

    const itemsBySource: Record<string, number> = {};

    let todayItems = 0;
    let weekItems = 0;
    let monthItems = 0;

    let totalProcessingTime = 0;
    let processedCount = 0;

    allItems.forEach((item) => {
      const category = item.category || 'unknown';
      itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;

      const status = item.status || 'unknown';
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;

      const source = item.source || 'unknown';
      itemsBySource[source] = (itemsBySource[source] || 0) + 1;

      const createdAt = new Date(item.createdAt).getTime();
      if (createdAt >= todayStart) todayItems++;
      if (createdAt >= weekStart) weekItems++;
      if (createdAt >= monthStart) monthItems++;

      if (item.processedAt && item.createdAt) {
        const processingTime = new Date(item.processedAt).getTime() - new Date(item.createdAt).getTime();
        totalProcessingTime += processingTime;
        processedCount++;
      }
    });

    const avgProcessingTime = processedCount > 0
      ? Math.round((totalProcessingTime / processedCount / 1000) * 10) / 10
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

const buildRuntimeLlmConfig = (config: {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  timeout: number | null;
  maxTokens: number | null;
}): {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeout: number;
  maxTokens: number;
} | null => {
  const provider = config.provider?.trim();
  const model = config.model?.trim();
  const apiKey = config.apiKey?.trim();

  if (!provider || !model || !apiKey) {
    return null;
  }

  const baseUrl = config.baseUrl?.trim();

  return {
    provider,
    model,
    apiKey,
    baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : undefined,
    timeout: config.timeout ?? 30000,
    maxTokens: config.maxTokens ?? 2000,
  };
};

const buildLlmConfigItem = (config: {
  id: string;
  name: string | null;
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  timeout: number | null;
  maxTokens: number | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}) => ({
  id: config.id,
  name: config.name,
  provider: config.provider,
  model: config.model,
  baseUrl: config.baseUrl,
  timeout: config.timeout,
  maxTokens: config.maxTokens,
  isActive: config.isActive,
  priority: config.priority,
  apiKeyConfigured: Boolean(config.apiKey),
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

const sendLlmConfigs = (res: Response, userId: string): void => {
  const db = getDatabase();
  const configs = db.listUserLlmConfigs(userId).map(buildLlmConfigItem);
  res.json({
    success: true,
    data: {
      configs
    }
  });
};

// User LLM configuration settings (multiple active with ordered fallback)
router.get('/llm', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    sendLlmConfigs(res, userId);
  } catch (error) {
    console.error('LLM config fetch error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch LLM configuration'
    });
  }
});

router.post('/llm', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = llmConfigCreateSchema.parse(req.body);
    const db = getDatabase();

    db.createUserLlmConfig(userId, {
      name: normalizeOptionalString(body.name),
      provider: body.provider.trim(),
      model: body.model.trim(),
      baseUrl: normalizeOptionalString(body.baseUrl),
      apiKey: body.apiKey.trim(),
      timeout: body.timeout === undefined ? undefined : body.timeout,
      maxTokens: body.maxTokens === undefined ? undefined : body.maxTokens,
      isActive: body.isActive,
    });

    sendLlmConfigs(res, userId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'Invalid request body'
      });
      return;
    }
    console.error('LLM config create error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create LLM configuration'
    });
  }
});

router.put('/llm/reorder', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = llmConfigReorderSchema.parse(req.body);
    const db = getDatabase();

    db.reorderUserLlmConfigs(userId, body.orderedIds);
    sendLlmConfigs(res, userId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'Invalid request body'
      });
      return;
    }

    if (error instanceof Error && /reorder|duplicate ids|unknown config id/i.test(error.message)) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: error.message
      });
      return;
    }

    console.error('LLM config reorder error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to reorder LLM configuration'
    });
  }
});

router.post('/llm/test', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const body = llmConfigTestPayloadSchema.parse(req.body);

    const runtimeConfig = buildRuntimeLlmConfig({
      provider: body.provider.trim(),
      model: body.model.trim(),
      baseUrl: normalizeOptionalString(body.baseUrl) ?? null,
      apiKey: body.apiKey.trim(),
      timeout: body.timeout ?? null,
      maxTokens: body.maxTokens ?? null,
    });

    if (!runtimeConfig) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'LLM configuration is incomplete. provider/model/apiKey are required for connection test.'
      });
      return;
    }

    const startedAt = Date.now();
    const client = new LLMClient(runtimeConfig, { userId });
    const healthy = await client.healthCheck();
    const latencyMs = Date.now() - startedAt;

    res.json({
      success: true,
      data: {
        id: 'draft',
        ok: healthy,
        latencyMs,
        provider: runtimeConfig.provider,
        model: runtimeConfig.model,
        message: healthy ? 'Connection test passed' : 'Connection test failed'
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

    console.error('LLM draft config connection test error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to test LLM connection'
    });
  }
});

router.post('/llm/:id/test', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const { id } = req.params;
    const db = getDatabase();

    const targetConfig = db.getUserLlmConfigById(userId, id);
    if (!targetConfig) {
      sendError(res, {
        statusCode: 404,
        code: 'SETTINGS.NOT_FOUND',
        message: 'LLM configuration not found'
      });
      return;
    }

    const runtimeConfig = buildRuntimeLlmConfig(targetConfig);
    if (!runtimeConfig) {
      sendError(res, {
        statusCode: 400,
        code: 'SETTINGS.INVALID_INPUT',
        message: 'LLM configuration is incomplete. provider/model/apiKey are required for connection test.'
      });
      return;
    }

    const startedAt = Date.now();
    const client = new LLMClient(runtimeConfig, { userId });
    const healthy = await client.healthCheck();
    const latencyMs = Date.now() - startedAt;

    res.json({
      success: true,
      data: {
        id: targetConfig.id,
        ok: healthy,
        latencyMs,
        provider: runtimeConfig.provider,
        model: runtimeConfig.model,
        message: healthy ? 'Connection test passed' : 'Connection test failed'
      }
    });
  } catch (error) {
    console.error('LLM config connection test error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to test LLM connection'
    });
  }
});

router.put('/llm/:id', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const { id } = req.params;
    const body = llmConfigUpdateSchema.parse(req.body);

    const updates = {
      name: normalizeOptionalString(body.name),
      provider: normalizeOptionalString(body.provider),
      model: normalizeOptionalString(body.model),
      baseUrl: normalizeOptionalString(body.baseUrl),
      apiKey: normalizeOptionalString(body.apiKey),
      timeout: body.timeout === undefined ? undefined : body.timeout,
      maxTokens: body.maxTokens === undefined ? undefined : body.maxTokens,
      isActive: body.isActive,
      priority: body.priority,
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
    const updated = db.updateUserLlmConfig(userId, id, updates);
    if (!updated) {
      sendError(res, {
        statusCode: 404,
        code: 'SETTINGS.NOT_FOUND',
        message: 'LLM configuration not found'
      });
      return;
    }

    sendLlmConfigs(res, userId);
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

router.delete('/llm/:id', authenticate, (req: Request, res: Response): void => {
  try {
    const userId = req.user?.id ?? 'default-user';
    const { id } = req.params;
    const db = getDatabase();

    const deleted = db.deleteUserLlmConfig(userId, id);
    if (!deleted) {
      sendError(res, {
        statusCode: 404,
        code: 'SETTINGS.NOT_FOUND',
        message: 'LLM configuration not found'
      });
      return;
    }

    sendLlmConfigs(res, userId);
  } catch (error) {
    console.error('LLM config delete error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete LLM configuration'
    });
  }
});

// Logs endpoint - DEPRECATED
router.get('/logs', authenticate, (_req, res) => {
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
