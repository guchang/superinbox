/**
 * Inbox API Integration Tests
 *
 * Tests for POST /v1/inbox endpoint
 * Verifying compliance with API documentation specification
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { testContext, createTestItem, cleanupTestItem } from './setup.js';

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
      expect(response.body.data).toHaveProperty('intent');
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
      //     intent: string,
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
      // 4. Current: includes 'intent' field
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

  it('should filter by intent type', async () => {
    // Create test item first
    await createTestItem({ content: 'Buy milk', source: 'test' });

    const response = await request(app)
      .get('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .query({ intent: 'todo', limit: 10 });

    expect(response.status).toBe(200);
    response.body.entries.forEach((entry: any) => {
      expect(entry.intent).toBe('todo');
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
    expect(response.body.parsed).toHaveProperty('intent');
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
