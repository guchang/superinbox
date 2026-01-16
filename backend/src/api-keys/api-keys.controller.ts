/**
 * API Keys Controller
 */

import type { Request, Response } from 'express';
import { getDatabase } from '../storage/database.js';
import { generateApiKey, generateApiKeyId, hashApiKey } from '../utils/api-key.js';

/**
 * Create a new API key
 * POST /v1/api-keys
 */
export const createApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { name, scopes } = req.body;

    // Validate scopes
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Scopes are required and must be a non-empty array',
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
    res.status(500).json({
      success: false,
      error: 'Failed to create API key',
    });
  }
};

/**
 * List all API keys for the current user
 * GET /v1/api-keys
 */
export const listApiKeysController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
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
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
    });
  }
};

/**
 * Get a single API key by ID
 * GET /v1/api-keys/:id
 */
export const getApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
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
    res.status(500).json({
      success: false,
      error: 'Failed to get API key',
    });
  }
};

/**
 * Update an API key (name and scopes only)
 * PATCH /v1/api-keys/:id
 */
export const updateApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const { name, scopes } = req.body;

    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    // Validate scopes if provided
    if (scopes !== undefined && (!Array.isArray(scopes) || scopes.length === 0)) {
      res.status(400).json({
        success: false,
        error: 'Scopes must be a non-empty array',
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
    res.status(500).json({
      success: false,
      error: 'Failed to update API key',
    });
  }
};

/**
 * Toggle API key status (enable/disable)
 * POST /v1/api-keys/:id/toggle
 */
export const toggleApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
      return;
    }

    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
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
    res.status(500).json({
      success: false,
      error: 'Failed to toggle API key',
    });
  }
};

/**
 * Regenerate an API key (creates a new key value)
 * POST /v1/api-keys/:id/regenerate
 */
export const regenerateApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
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
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate API key',
    });
  }
};

/**
 * Delete an API key
 * DELETE /v1/api-keys/:id
 */
export const deleteApiKeyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const db = getDatabase();
    const existing = db.getApiKeyById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (existing.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    const deleted = db.deleteApiKey(id);

    if (!deleted) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete API key',
      });
      return;
    }

    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key',
    });
  }
};

/**
 * Get access logs for an API key
 * GET /v1/api-keys/:id/logs
 */
export const getApiKeyLogsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const db = getDatabase();
    const apiKey = db.getApiKeyById(id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Verify ownership
    if (apiKey.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
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
    res.status(500).json({
      success: false,
      error: 'Failed to get API key logs',
    });
  }
};
