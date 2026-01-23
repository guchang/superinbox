/**
 * Routing API Integration Tests
 *
 * Tests for POST /v1/routing/dispatch/:id endpoint
 * Verifying manual item distribution functionality
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { testContext, createTestItem, cleanupTestItem } from './setup.js';

describe('POST /v1/routing/dispatch/:id', () => {
  describe('Manual Item Distribution', () => {
    it('should dispatch an item successfully', async () => {
      // Create a test item first
      const item = await createTestItem({
        content: 'Test item for dispatch',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/routing/dispatch/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          adapters: ['mcp'],
          force: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entryId', item.id);
      expect(response.body).toHaveProperty('dispatched');
      expect(Array.isArray(response.body.dispatched)).toBe(true);

      // Cleanup
      cleanupTestItem(item.id);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .post('/v1/routing/dispatch/non-existent-id')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          adapters: ['mcp'],
          force: false
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'STORAGE_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const item = await createTestItem({
        content: 'Test item for auth check',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/routing/dispatch/${item.id}`)
        .send({
          adapters: ['mcp'],
          force: false
        });

      expect(response.status).toBe(401);

      // Cleanup
      cleanupTestItem(item.id);
    });

    it('should handle force parameter', async () => {
      const item = await createTestItem({
        content: 'Test item with force dispatch',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/routing/dispatch/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          adapters: ['mcp'],
          force: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entryId');
      expect(response.body.dispatched).toBeInstanceOf(Array);

      // Cleanup
      cleanupTestItem(item.id);
    });

    it('should handle empty adapters array', async () => {
      const item = await createTestItem({
        content: 'Test item with no adapters',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/routing/dispatch/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          adapters: [],
          force: false
        });

      expect(response.status).toBe(200);
      expect(response.body.dispatched).toEqual([]);

      // Cleanup
      cleanupTestItem(item.id);
    });

    it('should return dispatch status for each adapter', async () => {
      const item = await createTestItem({
        content: 'Test item for multiple adapters',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/routing/dispatch/${item.id}`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          adapters: ['mcp'],
          force: false
        });

      expect(response.status).toBe(200);
      response.body.dispatched.forEach((result: any) => {
        expect(result).toHaveProperty('adapter');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('message');
      });

      // Cleanup
      cleanupTestItem(item.id);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain legacy POST /v1/items/:id/distribute endpoint', async () => {
      const item = await createTestItem({
        content: 'Test legacy distribute endpoint',
        source: 'test'
      });

      const response = await request(app)
        .post(`/v1/items/${item.id}/distribute`)
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({});

      // Legacy endpoint should still work
      expect([200, 202]).toContain(response.status);

      // Cleanup
      cleanupTestItem(item.id);
    });
  });
});

describe('Routing Rules API', () => {
  describe('GET /v1/routing/rules', () => {
    it('should return list of routing rules', async () => {
      const response = await request(app)
        .get('/v1/routing/rules')
        .set('Authorization', `Bearer ${testContext.testApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/v1/routing/rules');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /v1/routing/rules', () => {
    it('should create a new routing rule', async () => {
      const response = await request(app)
        .post('/v1/routing/rules')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          name: 'Test Rule',
          description: 'Test routing rule',
          priority: 1,
          conditions: [
            { field: 'intent', operator: 'equals', value: 'todo' }
          ],
          actions: [
            { type: 'mcp', config: { mcpAdapterId: 'test-adapter-id' } }
          ],
          isActive: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', 'Test Rule');
    });
  });

  describe('POST /v1/routing/rules/:id/test', () => {
    it('should test a routing rule', async () => {
      const response = await request(app)
        .post('/v1/routing/rules/test-rule/test')
        .set('Authorization', `Bearer ${testContext.testApiKey}`)
        .send({
          item: {
            intent: 'todo',
            content: 'Test todo item'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('matched');
    });
  });
});
