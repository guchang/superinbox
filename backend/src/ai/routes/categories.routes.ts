/**
 * Categories Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createCategory,
  getCategoryPrompt,
  listCategories,
  resetCategoryPrompt,
  rollbackCategoryPrompt,
  updateCategory,
  updateCategoryPrompt,
  deleteCategory,
  type CategoryRecord,
} from '../store.js';
import { sendError } from '../../utils/error-response.js';
import { getAIService } from '../service.js';

const router = Router();

const requiredFields = ['key', 'name'];
const UNKNOWN_CATEGORY_KEY = 'unknown';

const isUnknownCategory = (key?: string): boolean => {
  return String(key ?? '').trim().toLowerCase() === UNKNOWN_CATEGORY_KEY;
};

router.get('/', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = listCategories(userId);
  res.json({ success: true, data });
});

router.post('/', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const payload = req.body as Partial<CategoryRecord>;

  for (const field of requiredFields) {
    if (!payload[field as keyof CategoryRecord]) {
      sendError(res, {
        statusCode: 400,
        code: 'AI.INVALID_INPUT',
        message: `Missing required field: ${field}`,
        params: { field }
      });
      return;
    }
  }

  const existing = listCategories(userId).find(
    (category) => category.key === payload.key
  );
  if (existing) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.CATEGORY_KEY_EXISTS',
      message: 'Category key already exists',
      params: { key: payload.key }
    });
    return;
  }

  const record = createCategory(userId, {
    key: String(payload.key).trim(),
    name: String(payload.name).trim(),
    description: payload.description ?? '',
    examples: Array.isArray(payload.examples) ? payload.examples : [],
    isActive: payload.isActive ?? true,
  });

  res.json({ success: true, data: record });
});

router.get('/prompt', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = getCategoryPrompt(userId);
  res.json({ success: true, data });
});

router.put('/prompt', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const payload = req.body as { prompt?: unknown };
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';

  if (!prompt) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.INVALID_INPUT',
      message: 'Prompt is required',
      params: { field: 'prompt' }
    });
    return;
  }

  const data = updateCategoryPrompt(userId, prompt);
  res.json({ success: true, data });
});

router.post('/prompt/generate', authenticate, async (req, res) => {
  const userId = req.user?.userId ?? 'default-user';

  try {
    const prompt = await getAIService().generateCategoryPrompt({ userId });
    if (!prompt.trim()) {
      sendError(res, {
        statusCode: 500,
        code: 'AI.PREVIEW_FAILED',
        message: 'Failed to generate prompt',
      });
      return;
    }

    res.json({ success: true, data: { prompt } });
  } catch (error) {
    sendError(res, {
      statusCode: 500,
      code: 'AI.PREVIEW_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate prompt',
    });
  }
});

router.post('/prompt/reset', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = resetCategoryPrompt(userId);
  res.json({ success: true, data });
});

router.post('/prompt/rollback', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = rollbackCategoryPrompt(userId);

  if (!data) {
    sendError(res, {
      statusCode: 404,
      code: 'AI.CATEGORY_PROMPT_PREVIOUS_NOT_FOUND',
      message: 'Previous prompt not found',
    });
    return;
  }

  res.json({ success: true, data });
});

router.put('/:id', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const id = req.params.id;
  const payload = req.body as Partial<CategoryRecord>;

  const current = listCategories(userId).find((category) => category.id === id);
  if (!current) {
    sendError(res, {
      statusCode: 404,
      code: 'AI.CATEGORY_NOT_FOUND',
      message: 'Category not found',
      params: { id }
    });
    return;
  }

  if (isUnknownCategory(current.key)) {
    const nextKey = payload.key ? String(payload.key).trim() : current.key;
    if (!isUnknownCategory(nextKey) || payload.isActive === false) {
      sendError(res, {
        statusCode: 400,
        code: 'AI.SYSTEM_CATEGORY_IMMUTABLE',
        message: 'System fallback category cannot be renamed, disabled, or deleted',
        params: { key: current.key }
      });
      return;
    }
  }

  if (payload.key) {
    const existing = listCategories(userId).find(
      (category) => category.key === payload.key && category.id !== id
    );
    if (existing) {
      sendError(res, {
        statusCode: 400,
        code: 'AI.CATEGORY_KEY_EXISTS',
        message: 'Category key already exists',
        params: { key: payload.key }
      });
      return;
    }
  }

  const record = updateCategory(userId, id, {
    key: payload.key ? String(payload.key).trim() : undefined,
    name: payload.name ? String(payload.name).trim() : undefined,
    description: payload.description,
    examples: Array.isArray(payload.examples) ? payload.examples : undefined,
    isActive: typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
  });

  if (!record) {
    sendError(res, {
      statusCode: 404,
      code: 'AI.CATEGORY_NOT_FOUND',
      message: 'Category not found',
      params: { id }
    });
    return;
  }

  res.json({ success: true, data: record });
});

router.delete('/:id', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const id = req.params.id;

  const current = listCategories(userId).find((category) => category.id === id);
  if (!current) {
    sendError(res, {
      statusCode: 404,
      code: 'AI.CATEGORY_NOT_FOUND',
      message: 'Category not found',
      params: { id }
    });
    return;
  }

  if (isUnknownCategory(current.key)) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.SYSTEM_CATEGORY_IMMUTABLE',
      message: 'System fallback category cannot be renamed, disabled, or deleted',
      params: { key: current.key }
    });
    return;
  }

  const record = deleteCategory(userId, id);

  if (!record) {
    sendError(res, {
      statusCode: 404,
      code: 'AI.CATEGORY_NOT_FOUND',
      message: 'Category not found',
      params: { id }
    });
    return;
  }

  res.json({ success: true, data: record });
});

export default router;
