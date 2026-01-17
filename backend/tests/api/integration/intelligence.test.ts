/**
 * Intelligence API Integration Tests
 *
 * Tests for AI Intelligence endpoints:
 * - GET /v1/intelligence/parse/:id
 * - PATCH /v1/intelligence/parse/:id
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { testContext } from './setup.js';

describe('GET /v1/intelligence/parse/:id', () => {
  let testItemId: string;

  beforeEach(async () => {
    const response = await request(app)
      .post('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ content: '打车花了 30 元', source: 'test' });
    testItemId = response.body.data.id;
  });

  it('should return AI parse result', async () => {
    const response = await request(app)
      .get(`/v1/intelligence/parse/${testItemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('entryId', testItemId);
    expect(response.body).toHaveProperty('originalContent');
    expect(response.body).toHaveProperty('parsed');
    expect(response.body.parsed).toHaveProperty('intent');
    expect(response.body.parsed).toHaveProperty('confidence');
    expect(response.body.parsed).toHaveProperty('entities');
    expect(response.body).toHaveProperty('parsedAt');
  });

  it('should return 404 for non-existent item', async () => {
    const response = await request(app)
      .get('/v1/intelligence/parse/non-existent-id')
      .set('Authorization', `Bearer ${testContext.testApiKey}`);

    expect(response.status).toBe(404);
  });
});

describe('PATCH /v1/intelligence/parse/:id', () => {
  let testItemId: string;

  beforeEach(async () => {
    const response = await request(app)
      .post('/v1/inbox')
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({ content: '打车花了 30 元', source: 'test' });
    testItemId = response.body.data.id;
  });

  it('should update AI parse result', async () => {
    const response = await request(app)
      .patch(`/v1/intelligence/parse/${testItemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`)
      .send({
        intent: 'expense',
        entities: {
          amount: 30,
          currency: 'CNY',
          category: '餐饮'
        },
        feedback: '这是餐饮消费，不是交通'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '已更新解析结果并记录反馈');
    expect(response.body).toHaveProperty('updatedAt');

    // Verify update
    const getResponse = await request(app)
      .get(`/v1/intelligence/parse/${testItemId}`)
      .set('Authorization', `Bearer ${testContext.testApiKey}`);
    expect(getResponse.body.parsed.entities.category).toBe('餐饮');
  });
});
