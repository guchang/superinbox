/**
 * Inbox API Integration Tests
 *
 * Tests for POST /v1/inbox endpoint
 * Verifying compliance with API documentation specification
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../../src/index.js';
import { testContext, createTestItem, cleanupTestItem } from './setup.js';
import { getDatabase } from '../../../src/storage/database.js';
import { generateAccessToken } from '../../../src/utils/jwt.js';

describe('POST /v1/inbox', () => {
  describe('Current Implementation Behavior', () => {
    it('should create a new item with text content (current implementation)', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          content: 'Test content from integration test',
          source: 'integration-test'
        });

      // Current implementation returns 201 with wrapped response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data).toHaveProperty('category');
    });

    it('should return 401 without API key', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .send({
          content: 'Test content',
          source: 'test'
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing content field', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          source: 'test'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('API Documentation Compliance', () => {
    it('should accept content and source fields (JSON format)', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          content: '打车花了 30 元',
          source: 'telegram'
        });

      // Current implementation returns 201, API docs specify 200
      // Documenting discrepancy
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should support metadata field', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          content: 'Test with metadata',
          source: 'ios',
          metadata: {
            location: 'Beijing',
            device: 'iPhone 15'
          }
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should validate content is required', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          source: 'test',
          metadata: {}
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Response Format Analysis', () => {
    it('should document current response format vs API spec', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          content: 'Test response format',
          source: 'test'
        });

      // Current response format:
      // {
      //   success: true,
      //   data: {
      //     id: string,
      //     status: 'pending',
      //     category: string,
      //     message: string
      //   }
      // }

      // API docs specify:
      // {
      //   id: string,
      //   status: 'processing',
      //   message: string,
      //   files: [],
      //   createdAt: string
      // }

      // Document current behavior
      expect(response.body).toHaveProperty('success');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('message');

      // Note differences:
      // 1. Current: wrapped response with 'success' key
      // 2. Current: status is 'pending', docs say 'processing'
      // 3. Current: missing 'createdAt' in response
      // 4. Current: includes 'category' field
    });
  });
});

describe('GET /v1/inbox', () => {
  it('should return paginated list of items', async () => {
    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 10);
    expect(response.body).toHaveProperty('entries');
    expect(Array.isArray(response.body.entries)).toBe(true);
  });

  it('should filter by category type', async () => {
    // Create test item first
    await createTestItem({ content: 'Buy milk', source: 'test' });

    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ category: 'todo', limit: 10 });

    expect(response.status).toBe(200);
    response.body.entries.forEach((entry: any) => {
      expect(entry.category).toBe('todo');
    });
  });

  it('should filter by source', async () => {
    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ source: 'telegram', limit: 10 });

    expect(response.status).toBe(200);
    response.body.entries.forEach((entry: any) => {
      expect(entry.source).toBe('telegram');
    });
  });

  it('should filter by date range', async () => {
    const startDate = new Date().toISOString();
    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ startDate, limit: 10 });

    expect(response.status).toBe(200);
  });

  it('should filter by status', async () => {
    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ status: 'completed', limit: 10 });

    expect(response.status).toBe(200);
    response.body.entries.forEach((entry: any) => {
      expect(entry.status).toBe('completed');
    });
  });

  it('should exclude trash items from default inbox list and total count', async () => {
    const source = `exclude-trash-${crypto.randomUUID()}`;
    const activeItem = createTestItem({ source, category: 'idea' });
    const trashItem = createTestItem({ source, category: 'trash' });

    try {
      const response = await request(app)
        .get('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .query({ source, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total', 1);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0]).toHaveProperty('id', activeItem.id);
      expect(response.body.entries[0]).toHaveProperty('category', 'idea');

      const trashResponse = await request(app)
        .get('/v1/inbox')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .query({ source, category: 'trash', limit: 20 });

      expect(trashResponse.status).toBe(200);
      expect(trashResponse.body).toHaveProperty('total', 1);
      expect(trashResponse.body.entries).toHaveLength(1);
      expect(trashResponse.body.entries[0]).toHaveProperty('id', trashItem.id);
      expect(trashResponse.body.entries[0]).toHaveProperty('category', 'trash');
    } finally {
      cleanupTestItem(activeItem.id);
      cleanupTestItem(trashItem.id);
    }
  });
});

describe('GET /v1/inbox/:id', () => {
  it('should return a single item by ID', async () => {
    // Create a test item first
    const createResponse = await request(app)
      .post('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ content: 'Test item', source: 'test' });

    const itemId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/v1/inbox/${itemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', itemId);
    expect(response.body).toHaveProperty('content', 'Test item');
    expect(response.body).toHaveProperty('source', 'test');
    expect(response.body).toHaveProperty('parsed');
    expect(response.body.parsed).toHaveProperty('category');
    expect(response.body.parsed).toHaveProperty('confidence');
    expect(response.body.parsed).toHaveProperty('entities');
    expect(response.body).toHaveProperty('routingHistory');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
  });

  it('should return 404 for non-existent item', async () => {
    const response = await request(app)
      .get('/v1/inbox/non-existent-id')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(404);
  });
});

describe('PUT /v1/inbox/:id', () => {
  it('should update item with long markdown content', async () => {
    const createResponse = await request(app)
      .post('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ content: 'Original content', source: 'test' });

    const itemId = createResponse.body.data.id;
    const longMarkdown = `# Long markdown test

${'Paragraph with markdown content.\n\n'.repeat(600)}
- item 1
- item 2
- item 3
`;

    expect(longMarkdown.length).toBeGreaterThan(10000);

    const updateResponse = await request(app)
      .put(`/v1/inbox/${itemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        content: longMarkdown,
        category: 'note'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty('success', true);
    expect(updateResponse.body.data).toHaveProperty('category', 'note');

    const getResponse = await request(app)
      .get(`/v1/inbox/${itemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('content', longMarkdown);
  });

  it('should set status to manual when category is changed without explicit status', async () => {
    const created = createTestItem({
      category: 'todo',
      status: 'failed',
    });

    const response = await request(app)
      .put(`/v1/inbox/${created.id}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        category: 'idea',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('category', 'idea');
    expect(response.body.data).toHaveProperty('status', 'manual');

    const getResponse = await request(app)
      .get(`/v1/inbox/${created.id}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('status', 'manual');

    cleanupTestItem(created.id);
  });

  it('should respect explicit status when category is changed', async () => {
    const created = createTestItem({
      category: 'todo',
      status: 'completed',
    });

    const response = await request(app)
      .put(`/v1/inbox/${created.id}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        category: 'idea',
        status: 'failed',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'failed');

    cleanupTestItem(created.id);
  });
});

// Task 5: DELETE /v1/inbox/:id
describe('DELETE /v1/inbox/:id', () => {
  const createApiKey = (scopes: string[]) => {
    const db = getDatabase();
    const plainApiKey = `delete-mode-key-${crypto.randomUUID()}`;
    const hashedKey = crypto.createHash('sha256').update(plainApiKey).digest('hex');
    const keyId = `delete-mode-key-id-${crypto.randomUUID()}`;

    db.createApiKey({
      id: keyId,
      keyValue: hashedKey,
      keyPreview: 'delete...mode',
      userId: testContext.testUserId,
      name: `delete-mode-${Date.now()}`,
      scopes,
    });

    return { keyId, plainApiKey };
  };

  const setDeletePreference = (deletePreference: 'trash' | 'hard') => {
    const db = getDatabase();
    db.setUserDeletePreference(testContext.testUserId, deletePreference);
  };

  const clearDeletePreference = () => {
    const db = getDatabase();
    db.database.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testContext.testUserId);
  };

  const createJwtToken = () => generateAccessToken({
    userId: testContext.testUserId,
    username: 'integration-user',
    email: 'integration@example.com',
    role: 'user',
    scopes: ['admin:full', 'read', 'write'],
  });

  it('should hard delete when user delete preference is hard', async () => {
    setDeletePreference('hard');

    const item = createTestItem({ content: 'Delete preference hard test item' });

    try {
      const response = await request(app)
        .delete(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('action', 'deleted');
      expect(response.body.data).toHaveProperty('deleteMode', 'hard');

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(getResponse.status).toBe(404);
    } finally {
      cleanupTestItem(item.id);
      setDeletePreference('trash');
    }
  });

  it('should return 404 when deleting non-existent item', async () => {
    setDeletePreference('trash');
    const response = await request(app)
      .delete('/v1/inbox/non-existent-id')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'INBOX.NOT_FOUND');
  });

  it('should move item to trash when user delete preference is trash', async () => {
    setDeletePreference('trash');
    const item = createTestItem({ content: 'Delete preference trash test item', category: 'todo' });
    const { keyId, plainApiKey } = createApiKey(['read']);

    try {
      const deleteResponse = await request(app)
        .delete(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${plainApiKey}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data).toHaveProperty('action', 'moved_to_trash');
      expect(deleteResponse.body.data).toHaveProperty('deleteMode', 'trash');

      const storedItem = getDatabase().getItemById(item.id);
      expect(storedItem?.trashedFromCategory).toBe('todo');
      expect(storedItem?.trashedAt).toBeTruthy();

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${plainApiKey}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.parsed).toHaveProperty('category', 'trash');
    } finally {
      getDatabase().deleteApiKey(keyId);
      cleanupTestItem(item.id);
    }
  });

  it('should hard delete item already in trash even when delete preference is trash', async () => {
    setDeletePreference('trash');
    const item = createTestItem({
      content: 'Delete from trash should be hard',
      category: 'trash',
      trashedAt: new Date(Date.now() - 5 * 60 * 1000),
      trashedFromCategory: 'idea',
    });

    const { keyId, plainApiKey } = createApiKey(['read']);

    try {
      const deleteResponse = await request(app)
        .delete(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${plainApiKey}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data).toHaveProperty('action', 'deleted');
      expect(deleteResponse.body.data).toHaveProperty('deleteMode', 'hard');

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(getResponse.status).toBe(404);
    } finally {
      getDatabase().deleteApiKey(keyId);
      cleanupTestItem(item.id);
    }
  });

  it('should default to trash when delete preference is unset', async () => {
    clearDeletePreference();
    const item = createTestItem({ content: 'Delete preference unset test item', category: 'todo' });
    const { keyId, plainApiKey } = createApiKey(['read']);

    try {
      const deleteResponse = await request(app)
        .delete(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${plainApiKey}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data).toHaveProperty('action', 'moved_to_trash');
      expect(deleteResponse.body.data).toHaveProperty('deleteMode', 'trash');

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${plainApiKey}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.parsed).toHaveProperty('category', 'trash');
    } finally {
      getDatabase().deleteApiKey(keyId);
      cleanupTestItem(item.id);
      setDeletePreference('trash');
    }
  });

  it('should apply same delete preference to JWT requests', async () => {
    setDeletePreference('trash');
    const item = createTestItem({ content: 'Delete preference jwt none test item' });
    const jwtToken = createJwtToken();

    try {
      const deleteResponse = await request(app)
        .delete(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data).toHaveProperty('action', 'moved_to_trash');
      expect(deleteResponse.body.data).toHaveProperty('deleteMode', 'trash');

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.parsed).toHaveProperty('category', 'trash');
    } finally {
      cleanupTestItem(item.id);
      setDeletePreference('trash');
    }
  });
});

describe('POST /v1/inbox/:id/restore', () => {
  it('should restore trash item to original category', async () => {
    const item = createTestItem({
      content: 'Restore to original category',
      category: 'trash',
      trashedAt: new Date(Date.now() - 10 * 60 * 1000),
      trashedFromCategory: 'idea',
    });

    try {
      const restoreResponse = await request(app)
        .post(`/v1/inbox/${item.id}/restore`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body.data).toHaveProperty('action', 'restored');
      expect(restoreResponse.body.data).toHaveProperty('restoredTo', 'idea');
      expect(restoreResponse.body.data).toHaveProperty('fallbackToUnknown', false);

      const getResponse = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.parsed).toHaveProperty('category', 'idea');

      const storedItem = getDatabase().getItemById(item.id);
      expect(storedItem?.trashedFromCategory).toBeNull();
      expect(storedItem?.trashedAt).toBeNull();
    } finally {
      cleanupTestItem(item.id);
    }
  });

  it('should fallback to unknown when original category is missing', async () => {
    const item = createTestItem({
      content: 'Restore fallback unknown',
      category: 'trash',
      trashedAt: new Date(Date.now() - 10 * 60 * 1000),
      trashedFromCategory: 'non-existent-category',
    });

    try {
      const restoreResponse = await request(app)
        .post(`/v1/inbox/${item.id}/restore`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body.data).toHaveProperty('restoredTo', 'unknown');
      expect(restoreResponse.body.data).toHaveProperty('fallbackToUnknown', true);
    } finally {
      cleanupTestItem(item.id);
    }
  });

  it('should return 400 when restoring non-trash item', async () => {
    const item = createTestItem({
      content: 'Restore should fail for non-trash',
      category: 'todo',
    });

    try {
      const restoreResponse = await request(app)
        .post(`/v1/inbox/${item.id}/restore`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(restoreResponse.status).toBe(400);
      expect(restoreResponse.body.error).toHaveProperty('code', 'INBOX.INVALID_STATUS');
    } finally {
      cleanupTestItem(item.id);
    }
  });
});

describe('DELETE preference settings', () => {
  const clearDeletePreference = () => {
    const db = getDatabase();
    db.database.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testContext.testUserId);
  };

  it('should return trash when delete preference is unset', async () => {
    clearDeletePreference();

    const response = await request(app)
      .get('/v1/settings/delete-preference')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('deletePreference', 'trash');
  });

  it('should update delete preference', async () => {
    const response = await request(app)
      .put('/v1/settings/delete-preference')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ deletePreference: 'hard' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('deletePreference', 'hard');
    expect(response.body.data).toHaveProperty('updatedAt');

    const followUp = await request(app)
      .get('/v1/settings/delete-preference')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(followUp.status).toBe(200);
    expect(followUp.body.data).toHaveProperty('deletePreference', 'hard');

    getDatabase().setUserDeletePreference(testContext.testUserId, 'trash');
  });

  it('should return 400 for invalid delete preference value', async () => {
    const response = await request(app)
      .put('/v1/settings/delete-preference')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ deletePreference: 'none' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'SETTINGS.INVALID_INPUT');
  });
});

describe('Trash retention settings and cleanup', () => {
  const clearUserSettings = () => {
    const db = getDatabase();
    db.database.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testContext.testUserId);
  };

  it('should return default trash retention days when setting is missing', async () => {
    clearUserSettings();

    const response = await request(app)
      .get('/v1/settings/trash-retention')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('trashRetentionDays', 30);
  });

  it('should update trash retention days and support never mode', async () => {
    const updateResponse = await request(app)
      .put('/v1/settings/trash-retention')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ trashRetentionDays: 60 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toHaveProperty('trashRetentionDays', 60);

    const followUp = await request(app)
      .get('/v1/settings/trash-retention')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(followUp.status).toBe(200);
    expect(followUp.body.data).toHaveProperty('trashRetentionDays', 60);

    const neverResponse = await request(app)
      .put('/v1/settings/trash-retention')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ trashRetentionDays: null });

    expect(neverResponse.status).toBe(200);
    expect(neverResponse.body.data).toHaveProperty('trashRetentionDays', null);

    getDatabase().setUserTrashRetentionDays(testContext.testUserId, 30);
  });

  it('should return 400 for invalid trash retention value', async () => {
    const response = await request(app)
      .put('/v1/settings/trash-retention')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ trashRetentionDays: 45 });

    expect(response.status).toBe(400);
    expect(response.body.error).toHaveProperty('code', 'SETTINGS.INVALID_INPUT');
  });

  it('should cleanup expired trash items by per-item timestamp', () => {
    const db = getDatabase();
    db.setUserTrashRetentionDays(testContext.testUserId, 30);

    const now = new Date();
    const expiredDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const freshDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const expiredItem = createTestItem({
      category: 'trash',
      updatedAt: expiredDate,
      trashedAt: expiredDate,
      trashedFromCategory: 'idea',
    });
    const freshItem = createTestItem({
      category: 'trash',
      updatedAt: freshDate,
      trashedAt: freshDate,
      trashedFromCategory: 'todo',
    });

    try {
      const deletedCount = db.cleanupExpiredTrashItems(now);
      expect(deletedCount).toBeGreaterThanOrEqual(1);
      expect(db.getItemById(expiredItem.id)).toBeNull();
      expect(db.getItemById(freshItem.id)).not.toBeNull();
    } finally {
      cleanupTestItem(expiredItem.id);
      cleanupTestItem(freshItem.id);
    }
  });

  it('should use updatedAt as fallback when trashedAt is missing', () => {
    const db = getDatabase();
    db.setUserTrashRetentionDays(testContext.testUserId, 30);

    const now = new Date();
    const oldUpdatedAt = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const item = createTestItem({
      category: 'trash',
      updatedAt: oldUpdatedAt,
      trashedAt: null,
      trashedFromCategory: 'note',
    });

    try {
      const deletedCount = db.cleanupExpiredTrashItems(now);
      expect(deletedCount).toBeGreaterThanOrEqual(1);
      expect(db.getItemById(item.id)).toBeNull();
    } finally {
      cleanupTestItem(item.id);
    }
  });

  it('should skip cleanup when retention is never', () => {
    const db = getDatabase();
    db.setUserTrashRetentionDays(testContext.testUserId, null);

    const now = new Date();
    const oldDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
    const item = createTestItem({
      category: 'trash',
      updatedAt: oldDate,
      trashedAt: oldDate,
      trashedFromCategory: 'bookmark',
    });

    try {
      db.cleanupExpiredTrashItems(now);
      expect(db.getItemById(item.id)).not.toBeNull();
    } finally {
      cleanupTestItem(item.id);
      db.setUserTrashRetentionDays(testContext.testUserId, 30);
    }
  });
});

// Task 6: POST /v1/inbox/batch
describe('POST /v1/inbox/batch', () => {
  it('should create multiple items', async () => {
    const response = await request(app)
      .post('/v1/inbox/batch')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        entries: [
          { content: 'First', source: 'web' },
          { content: 'Second', source: 'web' },
          { content: 'https://example.com', source: 'web' }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total', 3);
    expect(response.body).toHaveProperty('succeeded', 3);
    expect(response.body).toHaveProperty('failed', 0);
    expect(response.body.entries).toHaveLength(3);
  });

  it('should handle partial failures', async () => {
    const response = await request(app)
      .post('/v1/inbox/batch')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        entries: [
          { content: 'Valid', source: 'test' },
          { content: '', source: 'test' }, // Invalid - empty content
          { content: 'Another valid', source: 'test' }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.succeeded).toBeLessThan(3);
    expect(response.body.failed).toBeGreaterThan(0);
    expect(response.body).toHaveProperty('total', 3);
  });

  it('should return 400 for missing entries array', async () => {
    const response = await request(app)
      .post('/v1/inbox/batch')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should return 400 for empty entries array', async () => {
    const response = await request(app)
      .post('/v1/inbox/batch')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ entries: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});

// Task 7: GET /v1/inbox/search
describe('GET /v1/inbox/search', () => {
  beforeEach(async () => {
    await createTestItem({ content: '打车去公司花了 30 元', source: 'test' });
    await createTestItem({ content: '打车去机场花了 100 元', source: 'test' });
    await createTestItem({ content: '买咖啡花了 15 元', source: 'test' });
  });

  it('should search by keyword', async () => {
    const response = await request(app)
      .get('/v1/inbox/search')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ q: '打车' });

    expect(response.status).toBe(200);
    expect(response.body.entries.length).toBeGreaterThan(0);
    response.body.entries.forEach((entry: any) => {
      expect(entry.content).toContain('打车');
    });
  });

  it('should combine search with intent filter', async () => {
    const response = await request(app)
      .get('/v1/inbox/search')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ q: '打车', intent: 'expense' });

    expect(response.status).toBe(200);
    response.body.entries.forEach((entry: any) => {
      expect(entry.content).toContain('打车');
      expect(entry.intent).toBe('expense');
    });
  });

  it('should respect limit parameter', async () => {
    const response = await request(app)
      .get('/v1/inbox/search')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ q: '打车', limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.entries.length).toBeLessThanOrEqual(1);
  });

  it('should return 400 for missing query parameter', async () => {
    const response = await request(app)
      .get('/v1/inbox/search')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should return empty array when no results found', async () => {
    const response = await request(app)
      .get('/v1/inbox/search')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ q: 'nonexistentkeywordxyz' });

    expect(response.status).toBe(200);
    expect(response.body.entries).toEqual([]);
  });
});
