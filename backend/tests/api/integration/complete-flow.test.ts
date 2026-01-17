/**
 * Complete Integration Test - Full Workflow
 * Tests the complete flow: create → parse → search → dispatch → delete
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('Complete Flow Integration Tests', () => {
  let itemId: string;
  let apiKey: string;

  beforeAll(async () => {
    apiKey = process.env.TEST_API_KEY || 'dev-key-change-this-in-production';
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Step 1: Create Item', () => {
    it('should create a new item successfully', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          content: 'Buy milk tomorrow at 9am',
          source: 'api-test',
          contentType: 'text'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('originalContent', 'Buy milk tomorrow at 9am');
      expect(response.body.data).toHaveProperty('intent');

      itemId = response.body.data.id;
    });

    it('should fail with invalid content', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          content: '', // Empty content
          source: 'api-test',
          contentType: 'text'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Step 2: Get AI Parse Result', () => {
    it('should get parse result for the created item', async () => {
      const response = await request(app)
        .get(`/v1/intelligence/parse/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itemId', itemId);
      expect(response.body.data).toHaveProperty('intent');
      expect(response.body.data).toHaveProperty('entities');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/v1/intelligence/parse/non-existent-id')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Step 3: Search Items', () => {
    it('should find the created item in search', async () => {
      const response = await request(app)
        .get('/v1/inbox/search')
        .query({ q: 'milk' })
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);

      // Find our item in the results
      const found = response.body.data.items.some((item: any) => item.id === itemId);
      expect(found).toBe(true);
    });

    it('should filter by intent', async () => {
      const response = await request(app)
        .get('/v1/inbox/search')
        .query({ intent: 'todo' })
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('Step 4: Batch Create Items', () => {
    it('should create multiple items at once', async () => {
      const response = await request(app)
        .post('/v1/inbox/batch')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          items: [
            { content: 'Second item', source: 'test', contentType: 'text' },
            { content: 'Third item', source: 'test', contentType: 'text' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('created', 2);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toHaveLength(2);
    });

    it('should fail with empty batch', async () => {
      const response = await request(app)
        .post('/v1/inbox/batch')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          items: []
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Step 5: Update Item', () => {
    it('should update item status', async () => {
      const response = await request(app)
        .put(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          status: 'completed',
          priority: 'high'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data).toHaveProperty('priority', 'high');
    });
  });

  describe('Step 6: Manual Dispatch', () => {
    it('should manually dispatch item to targets', async () => {
      const response = await request(app)
        .post(`/v1/routing/dispatch/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itemId', itemId);
      expect(response.body.data).toHaveProperty('dispatched', true);
      expect(response.body.data).toHaveProperty('results');
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });
  });

  describe('Step 7: Get All Items', () => {
    it('should retrieve all items with filters', async () => {
      const response = await request(app)
        .get('/v1/items')
        .query({ status: 'completed', limit: 10 })
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('total');
    });

    it('should support since parameter for incremental sync', async () => {
      const since = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const response = await request(app)
        .get('/v1/items')
        .query({ since })
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Step 8: Correct Parse Result', () => {
    it('should allow manual correction of AI parse', async () => {
      const response = await request(app)
        .patch(`/v1/intelligence/parse/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          intent: 'todo',
          entities: {
            action: 'buy',
            item: 'milk',
            time: 'tomorrow at 9am'
          },
          summary: 'Updated summary'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary', 'Updated summary');
      expect(response.body.data).toHaveProperty('correctedAt');
    });
  });

  describe('Step 9: API Key Management', () => {
    let newKeyId: string;

    it('should create a new API key', async () => {
      const response = await request(app)
        .post('/v1/auth/api-keys')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          name: 'Test Integration Key',
          scopes: ['read', 'write']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('keyValue');
      expect(response.body.data.keyValue).toMatch(/^sinbox_/);

      newKeyId = response.body.data.id;
    });

    it('should list all API keys', async () => {
      const response = await request(app)
        .get('/v1/auth/api-keys')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('keys');
      expect(Array.isArray(response.body.data.keys)).toBe(true);
    });

    it('should disable an API key', async () => {
      const response = await request(app)
        .post(`/v1/auth/api-keys/${newKeyId}/disable`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isActive', false);
    });

    it('should re-enable the API key', async () => {
      const response = await request(app)
        .post(`/v1/auth/api-keys/${newKeyId}/enable`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isActive', true);
    });

    it('should delete the API key', async () => {
      const response = await request(app)
        .delete(`/v1/auth/api-keys/${newKeyId}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Step 10: Delete Item', () => {
    it('should delete the created item', async () => {
      const response = await request(app)
        .delete(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', itemId);
      expect(response.body.data).toHaveProperty('deleted', true);
    });

    it('should return 404 when trying to get deleted item', async () => {
      const response = await request(app)
        .get(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/v1/items');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });

    it('should return 401 with invalid API key', async () => {
      const response = await request(app)
        .get('/v1/items')
        .set('Authorization', 'Bearer invalid-key');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/v1/non-existent-route')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should return validation error for invalid data', async () => {
      const response = await request(app)
        .post('/v1/inbox')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          invalidField: 'value'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Statistics', () => {
    it('should get system statistics', async () => {
      const response = await request(app)
        .get('/v1/settings/statistics')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalItems');
      expect(response.body.data).toHaveProperty('itemsByIntent');
      expect(response.body.data).toHaveProperty('itemsByStatus');
      expect(response.body.data).toHaveProperty('avgProcessingTime');
    });
  });
});
