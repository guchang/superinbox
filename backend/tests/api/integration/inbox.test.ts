/**
 * Inbox API Integration Tests
 *
 * Tests for POST /v1/inbox endpoint
 * Following TDD approach: write failing tests first, then implement
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { testContext, createTestItem, cleanupTestItem } from './setup.js';

describe('POST /v1/inbox', () => {
  it('should create a new item with text content', async () => {
    const response = await request(app)
      .post('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        content: 'Test content from integration test',
        source: 'integration-test'
      });

    // Current implementation returns 201 with wrapped response
    // API spec may expect 200 with different structure
    // This test documents current behavior for alignment
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
