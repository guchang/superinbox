/**
 * Routing Rules Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase } from '../../src/storage/database.js';
import { getRouterService } from '../../src/router/router.service.js';
import { v4 as uuidv4 } from 'uuid';
import type { Item } from '../../src/types/index.js';

describe('Routing Rules Integration', () => {
  const db = getDatabase();
  const router = getRouterService();
  const userId = 'test-user-rules';
  let testItemId: string;

  beforeAll(async () => {
    // Create test user first
    db.database.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'test-user-rules', 'test-user-rules@example.com', 'hash', 'user', new Date().toISOString());

    // Create a test routing rule
    const ruleId = uuidv4();
    db.database.prepare(`
      INSERT INTO routing_rules (
        id, user_id, name, description, priority,
        conditions, actions, is_active, is_system,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ruleId,
      userId,
      'Test Rule: Skip todo items',
      'Skip distribution for todo category items',
      100,
      JSON.stringify([{
        field: 'category',
        operator: 'equals',
        value: 'todo'
      }]),
      JSON.stringify([{
        type: 'skip_distribution'
      }]),
      1, // is_active
      0, // is_system
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test item
    testItemId = uuidv4();
    const item: Item = {
      id: testItemId,
      userId,
      originalContent: 'Buy milk',
      contentType: 'text',
      source: 'test',
      category: 'todo',
      entities: {},
      status: 'completed',
      priority: 'medium',
      distributedTargets: [],
      distributionResults: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    db.createItem(item);
  });

  afterAll(() => {
    // Cleanup
    db.database.prepare('DELETE FROM distribution_results WHERE item_id = ?').run(testItemId);
    db.database.prepare('DELETE FROM items WHERE id = ?').run(testItemId);
    db.database.prepare('DELETE FROM routing_rules WHERE user_id = ?').run(userId);
    db.database.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  it('should execute matching routing rules', async () => {
    const item = db.getItemById(testItemId);
    const results = await router.distributeItem(item);

    // Should have rule result
    expect(results.length).toBeGreaterThan(0);

    // Should have skip result
    const skipResult = results.find(r => r.message === 'Distribution skipped by rule');
    expect(skipResult).toBeDefined();
    expect(skipResult?.status).toBe('success');
  });

  it('should not distribute when rule says skip', async () => {
    // Clear previous results
    db.database.prepare('DELETE FROM distribution_results WHERE item_id = ?').run(testItemId);

    const item = db.getItemById(testItemId);
    const results = await router.distributeItem(item);

    // Should only have rule result, no adapter results
    const adapterResults = results.filter(r => r.adapterType !== 'rule');
    expect(adapterResults.length).toBe(0);
  });
});
