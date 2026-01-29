/**
 * Integration Test - Inbox Flow
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../../src/storage/database.js';
import { getAIService } from '../../src/ai/service.js';

describe('Inbox Flow Integration Tests', () => {
  beforeAll(() => {
    // Initialize test database
    const db = getDatabase();
  });

  describe('AI Processing', () => {
    it('should classify todo category correctly', async () => {
      const ai = getAIService();
      const result = await ai.analyzeContent('明天下午3点开会');

      expect(result.category).toBe('todo');
      expect(result.entities.dueDate).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify expense category correctly', async () => {
      const ai = getAIService();
      const result = await ai.analyzeContent('买咖啡花了25元');

      expect(result.category).toBe('expense');
      expect(result.entities.amount).toBe(25);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify idea category correctly', async () => {
      const ai = getAIService();
      const result = await ai.analyzeContent('突然想到可以做一个自动整理邮件的工具');

      expect(result.category).toBe('idea');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should extract entities correctly', async () => {
      const ai = getAIService();
      const result = await ai.analyzeContent('明天在北京和张三讨论项目预算');

      expect(result.entities.dueDate).toBeDefined();
      expect(result.entities.location).toBe('北京');
      expect(result.entities.people).toContain('张三');
    });
  });

  describe('Database Operations', () => {
    it('should create and retrieve item', () => {
      const db = getDatabase();

      const item = {
        id: 'test-001',
        userId: 'test-user',
        originalContent: 'Test content',
        contentType: 'text' as const,
        source: 'test',
        category: 'unknown' as const,
        entities: {},
        status: 'pending' as const,
        distributedTargets: [],
        distributionResults: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.createItem(item);
      const retrieved = db.getItemById('test-001');

      expect(retrieved).toBeDefined();
      expect(retrieved?.originalContent).toBe('Test content');
    });

    it('should update item', () => {
      const db = getDatabase();

      const updated = db.updateItem('test-001', {
        category: 'todo' as const,
        status: 'completed' as const
      });

      expect(updated).toBeDefined();
      expect(updated?.category).toBe('todo');
      expect(updated?.status).toBe('completed');
    });

    it('should delete item', () => {
      const db = getDatabase();
      const deleted = db.deleteItem('test-001');

      expect(deleted).toBe(true);

      const retrieved = db.getItemById('test-001');
      expect(retrieved).toBeNull();
    });
  });
});
