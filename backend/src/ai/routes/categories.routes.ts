/**
 * Categories Routes
 */

import { Router } from 'express';
import { authenticate, requireAnyScope } from '../../middleware/auth.js';
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
import { getDatabase } from '../../storage/database.js';

const router = Router();

const requiredFields = ['key', 'name'];
const UNKNOWN_CATEGORY_KEY = 'unknown';
const TRASH_CATEGORY_KEY = 'trash';
const SYSTEM_CATEGORY_KEYS = new Set([UNKNOWN_CATEGORY_KEY, TRASH_CATEGORY_KEY]);
const MAX_PROMPT_LENGTH = 20000;
const REQUIRED_PROMPT_PLACEHOLDERS = [
  '{{NOW_ISO}}',
  '{{TIMEZONE}}',
  '{{CONTENT_TYPE}}',
  '{{CONTENT}}',
  '{{ACTIVE_CATEGORY_KEYS_JSON}}',
  '{{CATEGORY_RULES_JSON}}',
  '{{FALLBACK_CATEGORY_KEY}}',
];

const requireCategoryReadScope = requireAnyScope('category:read', 'read');
const requireCategoryWriteScope = requireAnyScope('category:write', 'write');

const isSystemCategory = (key?: string): boolean => {
  return SYSTEM_CATEGORY_KEYS.has(String(key ?? '').trim().toLowerCase());
};

const parseSortOrder = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.floor(value));
};

export const validateCategoryPromptContent = (prompt: string): { message?: string; missingPlaceholders?: string[] } => {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      message: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
    };
  }

  const missingPlaceholders = REQUIRED_PROMPT_PLACEHOLDERS.filter(
    (placeholder) => !prompt.includes(placeholder)
  );

  if (missingPlaceholders.length > 0) {
    return {
      message: 'Prompt is missing required runtime placeholders',
      missingPlaceholders,
    };
  }

  const hasJsonOnlyConstraint =
    /json/i.test(prompt) &&
    /(only|合法|valid|仅|strict)/i.test(prompt);
  if (!hasJsonOnlyConstraint) {
    return {
      message: 'Prompt must clearly constrain output to JSON only',
    };
  }

  const hasCategoryConstraint =
    /(activeCategoryKeys|分类集合|allowed categories|category keys)/i.test(prompt) &&
    /(only|仅|must|必须)/i.test(prompt);
  if (!hasCategoryConstraint) {
    return {
      message: 'Prompt must clearly constrain category to active keys',
    };
  }

  const hasFallbackConstraint =
    /unknown/i.test(prompt) &&
    /(fallback|兜底|only|仅)/i.test(prompt);
  if (!hasFallbackConstraint) {
    return {
      message: 'Prompt must clearly define unknown as fallback only',
    };
  }

  return {};
};

router.get('/', authenticate, requireCategoryReadScope, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = listCategories(userId);
  res.json({ success: true, data });
});

router.post('/', authenticate, requireCategoryWriteScope, (req, res) => {
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

  const normalizedKey = String(payload.key).trim().toLowerCase();

  const existing = listCategories(userId).find(
    (category) => category.key === normalizedKey
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
    key: normalizedKey,
    name: String(payload.name).trim(),
    description: payload.description ?? '',
    examples: Array.isArray(payload.examples) ? payload.examples : [],
    icon: typeof payload.icon === 'string' ? payload.icon.trim() : undefined,
    color: typeof payload.color === 'string' ? payload.color.trim() : undefined,
    sortOrder: parseSortOrder(payload.sortOrder),
    isActive: payload.isActive ?? true,
  });

  res.json({ success: true, data: record });
});

router.get('/prompt', authenticate, requireCategoryReadScope, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = getCategoryPrompt(userId);
  res.json({ success: true, data });
});

router.put('/prompt', authenticate, requireCategoryWriteScope, (req, res) => {
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

  const validation = validateCategoryPromptContent(prompt);
  if (validation.message) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.INVALID_PROMPT',
      message: validation.message,
      params: validation.missingPlaceholders
        ? { missingPlaceholders: validation.missingPlaceholders }
        : undefined,
    });
    return;
  }

  const data = updateCategoryPrompt(userId, prompt);
  res.json({ success: true, data });
});

router.post('/prompt/generate', authenticate, requireCategoryWriteScope, async (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const payload = req.body as { mode?: unknown; requirement?: unknown; language?: unknown };
  const mode = typeof payload.mode === 'string' ? payload.mode.trim() : '';
  const requirement =
    typeof payload.requirement === 'string' ? payload.requirement.trim() : '';
  const language =
    typeof payload.language === 'string' ? payload.language.trim() : '';
  const allowedModes = new Set(['low_cost', 'high_precision', 'custom']);
  const normalizedMode = mode || 'low_cost';

  if (!allowedModes.has(normalizedMode)) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.INVALID_INPUT',
      message: 'Invalid mode',
      params: { field: 'mode' },
    });
    return;
  }

  if (normalizedMode === 'custom' && !requirement) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.INVALID_INPUT',
      message: 'Requirement is required for custom mode',
      params: { field: 'requirement' },
    });
    return;
  }

  try {
    const prompt = await getAIService().generateCategoryPrompt({
      userId,
      mode: normalizedMode as 'low_cost' | 'high_precision' | 'custom',
      requirement,
      language,
    });

    const validation = validateCategoryPromptContent(prompt);
    if (validation.message) {
      sendError(res, {
        statusCode: 500,
        code: 'AI.PREVIEW_FAILED',
        message: `Generated prompt failed validation: ${validation.message}`,
        params: validation.missingPlaceholders
          ? { missingPlaceholders: validation.missingPlaceholders }
          : undefined,
      });
      return;
    }

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

router.post('/prompt/reset', authenticate, requireCategoryWriteScope, (req, res) => {
  const userId = req.user?.userId ?? 'default-user';
  const data = resetCategoryPrompt(userId);
  res.json({ success: true, data });
});

router.post('/prompt/rollback', authenticate, requireCategoryWriteScope, (req, res) => {
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

router.put('/:id', authenticate, requireCategoryWriteScope, (req, res) => {
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

  if (isSystemCategory(current.key)) {
    const nextKey = payload.key ? String(payload.key).trim() : current.key;
    const normalizedCurrentKey = String(current.key).trim().toLowerCase();
    const normalizedNextKey = String(nextKey).trim().toLowerCase();
    if (
      normalizedNextKey !== normalizedCurrentKey ||
      payload.name !== undefined ||
      payload.isActive !== undefined ||
      payload.sortOrder !== undefined
    ) {
      sendError(res, {
        statusCode: 400,
        code: 'AI.SYSTEM_CATEGORY_IMMUTABLE',
        message: 'System categories cannot be renamed, disabled, or deleted',
        params: { key: current.key }
      });
      return;
    }
  }

  if (payload.key) {
    const normalizedKey = String(payload.key).trim().toLowerCase();
    const existing = listCategories(userId).find(
      (category) => category.key === normalizedKey && category.id !== id
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
    key: payload.key ? String(payload.key).trim().toLowerCase() : undefined,
    name: payload.name ? String(payload.name).trim() : undefined,
    description: payload.description,
    examples: Array.isArray(payload.examples) ? payload.examples : undefined,
    icon: typeof payload.icon === 'string' ? payload.icon.trim() : undefined,
    color: typeof payload.color === 'string' ? payload.color.trim() : undefined,
    sortOrder: parseSortOrder(payload.sortOrder),
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

router.delete('/:id', authenticate, requireCategoryWriteScope, (req, res) => {
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

  if (isSystemCategory(current.key)) {
    sendError(res, {
      statusCode: 400,
      code: 'AI.SYSTEM_CATEGORY_IMMUTABLE',
      message: 'System categories cannot be renamed, disabled, or deleted',
      params: { key: current.key }
    });
    return;
  }

  const allCategories = listCategories(userId);
  const trashCategory = allCategories.find(
    (category) => String(category.key).trim().toLowerCase() === TRASH_CATEGORY_KEY
  );
  if (!trashCategory) {
    sendError(res, {
      statusCode: 500,
      code: 'AI.SYSTEM_CATEGORY_MISSING',
      message: 'System trash category is missing',
      params: { key: TRASH_CATEGORY_KEY }
    });
    return;
  }

  const db = getDatabase();
  const migratedCount = db.reassignItemsCategory(userId, current.key, TRASH_CATEGORY_KEY);
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

  res.json({
    success: true,
    data: record,
    meta: {
      migratedCount,
      migratedTo: TRASH_CATEGORY_KEY
    }
  });
});

export default router;
