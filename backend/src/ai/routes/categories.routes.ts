/**
 * Categories Routes
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRecord,
} from '../store.js';

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
      res.status(400).json({
        success: false,
        error: `Missing required field: ${field}`,
      });
      return;
    }
  }

  const existing = listCategories(userId).find(
    (category) => category.key === payload.key
  );
  if (existing) {
    res.status(400).json({
      success: false,
      error: 'Category key already exists',
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
      res.status(400).json({
        success: false,
        error: 'Category key already exists',
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
    res.status(404).json({
      success: false,
      error: 'Category not found',
    });
    return;
  }

  res.json({ success: true, data: record });
});

export default router;
