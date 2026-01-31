/**
 * API Keys Controller
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../storage/database.js';
import { generateApiKey, generateApiKeyId, hashApiKey } from '../utils/api-key.js';
import { sendError } from '../utils/error-response.js';

/**
 * Create a new API key
 * POST /v1/auth/api-keys
 */
export const createApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { name, scopes } = req.body;

    // Validate scopes
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      sendError(res, {
        statusCode: 400,
        code: 'API_KEYS.INVALID_INPUT',
        message: 'Scopes are required and must be a non-empty array'
      });
      return;
    }

    // Generate new API key
    const plainApiKey = generateApiKey();
    const hashedKey = hashApiKey(plainApiKey);
    const keyId = generateApiKeyId();
    
    // Generate key preview: first 8 chars + ... + last 4 chars
    const keyPreview = plainApiKey.length > 12 
      ? `${plainApiKey.substring(0, 8)}...${plainApiKey.substring(plainApiKey.length - 4)}`
      : plainApiKey;

    const db = getDatabase();
    const apiKey = db.createApiKey({
      id: keyId,
      keyValue: hashedKey,
      keyPreview,
      userId,
      name,
      scopes,
    });

    // Return the plain API key only once (it won't be stored)
    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        apiKey: plainApiKey, // Only returned once!
        name: apiKey.name,
        scopes: apiKey.scopes,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    console.error('Create API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create API key'
    });
  }
};

/**
 * List all API keys for the current user
 * GET /v1/auth/api-keys
 */
export const listApiKeysController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const db = getDatabase();
    const apiKeys = db.listApiKeysByUserId(userId);

    // Never return the actual key values
    const sanitizedKeys = apiKeys.map((key: any) => ({
      id: key.id,
      name: key.name,
      scopes: key.scopes,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      // Use stored key preview
      keyPreview: key.keyPreview || null,
    }));

    res.json({
      success: true,
      data: sanitizedKeys,
    });
  } catch (error) {
    console.error('List API keys error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to list API keys'
    });
  }
};

/**
 * Get a single API key by ID
 * GET /v1/auth/api-keys/:id
 */
export const getApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    // Never return the actual key value
    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
        keyPreview: apiKey.keyPreview || null,
      },
    });
  } catch (error) {
    console.error('Get API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get API key'
    });
  }
};

/**
 * Update an API key (name and scopes only)
 * PATCH /v1/auth/api-keys/:id
 */
export const updateApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const { name, scopes } = req.body;

    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    // Validate scopes if provided
    if (scopes !== undefined && (!Array.isArray(scopes) || scopes.length === 0)) {
      sendError(res, {
        statusCode: 400,
        code: 'API_KEYS.INVALID_INPUT',
        message: 'Scopes must be a non-empty array'
      });
      return;
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (scopes !== undefined) updates.scopes = scopes;

    const updated = db.updateApiKey(id, updates);

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        scopes: updated.scopes,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        lastUsedAt: updated.lastUsedAt,
      },
    });
  } catch (error) {
    console.error('Update API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update API key'
    });
  }
};

/**
 * Toggle API key status (enable/disable)
 * POST /v1/auth/api-keys/:id/toggle
 * @legacy  This endpoint is maintained for backward compatibility.
 *          New code should use POST /v1/auth/api-keys/:id/enable or /disable instead.
 */
export const toggleApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      sendError(res, {
        statusCode: 400,
        code: 'API_KEYS.INVALID_INPUT',
        message: 'isActive must be a boolean'
      });
      return;
    }

    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    const updated = db.toggleApiKeyStatus(id, isActive);

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        scopes: updated.scopes,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        lastUsedAt: updated.lastUsedAt,
      },
    });
  } catch (error) {
    console.error('Toggle API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to toggle API key'
    });
  }
};

/**
 * Disable an API key
 * POST /v1/auth/api-keys/:id/disable
 */
export const disableApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    const updated = db.updateApiKey(id, { isActive: false });

    res.json({
      success: true,
      message: 'API key disabled',
      data: {
        id: updated.id,
        name: updated.name,
        status: 'disabled',
        disabledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to disable API key',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Enable an API key
 * POST /v1/auth/api-keys/:id/enable
 */
export const enableApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const db = getDatabase();

    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    const updated = db.updateApiKey(id, { isActive: true });

    res.json({
      success: true,
      message: 'API key enabled',
      data: {
        id: updated.id,
        name: updated.name,
        status: 'active',
        enabledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to enable API key',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Regenerate an API key (creates a new key value)
 * POST /v1/auth/api-keys/:id/regenerate
 */
export const regenerateApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    // Generate new key value
    const plainApiKey = generateApiKey();
    const hashedKey = hashApiKey(plainApiKey);
    
    // Generate key preview: first 8 chars + ... + last 4 chars
    const keyPreview = plainApiKey.length > 12 
      ? `${plainApiKey.substring(0, 8)}...${plainApiKey.substring(plainApiKey.length - 4)}`
      : plainApiKey;

    // Update with new key value and preview
    const stmt = db['db'].prepare('UPDATE api_keys SET key_value = ?, key_preview = ? WHERE id = ?');
    stmt.run(hashedKey, keyPreview, id);

    const updated = db.getApiKeyById(id);

    // Return the new plain API key (only once!)
    res.json({
      success: true,
      data: {
        id: updated.id,
        apiKey: plainApiKey, // New key returned only once!
        name: updated.name,
        scopes: updated.scopes,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to regenerate API key'
    });
  }
};

/**
 * Delete an API key
 * DELETE /v1/auth/api-keys/:id
 */
export const deleteApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    const deleted = db.deleteApiKey(id);

    if (!deleted) {
      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete API key'
      });
      return;
    }

    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete API key'
    });
  }
};

/**
 * Get access logs for an API key
 * GET /v1/auth/api-keys/:id/logs
 */
export const getApiKeyLogsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, {
        statusCode: 401,
        code: 'AUTH.UNAUTHORIZED',
        message: 'Unauthorized'
      });
      return;
    }

    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const db = getDatabase();
    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      sendError(res, {
        statusCode: 404,
        code: 'API_KEYS.NOT_FOUND',
        message: 'API key not found',
        params: { id }
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      sendError(res, {
        statusCode: 403,
        code: 'AUTH.FORBIDDEN',
        message: 'Access denied'
      });
      return;
    }

    const logs = db.getAccessLogsByApiKeyId(id, Number(limit), Number(offset));

    res.json({
      success: true,
      data: {
        logs,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Get API key logs error:', error);
    sendError(res, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get API key logs'
    });
  }
};
