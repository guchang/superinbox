/**
 * Categories Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  type CategoryRecord,
} from '../store.js';
import { sendError } from '../../utils/error-response.js';

const router = Router();

const requiredFields = ['key', 'name'];

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

router.put('/:id', authenticate, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const id = req.params.id;
  const payload = req.body as Partial<CategoryRecord>;

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
