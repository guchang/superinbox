import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dbPath = '';
let getDatabase: any;
let closeDatabase: any;

const createUserAndItem = (db: any, itemOverrides?: Record<string, unknown>) => {
  const userId = 'user-ai-regression';
  db.createUser({
    id: userId,
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@example.com`,
    passwordHash: 'hash',
    role: 'user',
  });

  const now = new Date('2026-02-07T00:00:00.000Z');
  const item = {
    id: `item-${Date.now()}`,
    userId,
    originalContent: 'book dentist follow-up tomorrow',
    contentType: 'text',
    source: 'test',
    category: 'todo',
    entities: { dueDate: new Date('2026-02-08T00:00:00.000Z') },
    summary: 'remember to follow up',
    suggestedTitle: 'Dentist follow-up',
    aiConfidence: 0.88,
    aiReasoning: 'contains actionable reminder',
    aiPromptVersion: 'sha256:1234abcd',
    aiModel: 'gpt-4.1-mini',
    aiParseStatus: 'success',
    status: 'completed',
    distributedTargets: [],
    distributionResults: [],
    routingStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    processedAt: now,
    ...itemOverrides,
  };

  db.createItem(item);
  return { userId, item };
};

beforeEach(async () => {
  dbPath = path.join(os.tmpdir(), `superinbox-ai-regression-${Date.now()}-${Math.random()}.db`);
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = dbPath;
  process.env.LLM_API_KEY = process.env.LLM_API_KEY || 'test-key';

  vi.resetModules();
  const databaseModule = await import('../../src/storage/database.js');
  getDatabase = databaseModule.getDatabase;
  closeDatabase = databaseModule.closeDatabase;
});

afterEach(() => {
  if (typeof closeDatabase === 'function') {
    closeDatabase();
  }

  if (dbPath && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

describe('Database AI quality regression', () => {
  it('persists ai quality fields during item create/update/read', () => {
    const db = getDatabase();
    const { item } = createUserAndItem(db);

    const stored = db.getItemById(item.id);
    expect(stored).toBeTruthy();
    expect(stored.aiConfidence).toBe(0.88);
    expect(stored.aiReasoning).toBe('contains actionable reminder');
    expect(stored.aiPromptVersion).toBe('sha256:1234abcd');
    expect(stored.aiModel).toBe('gpt-4.1-mini');
    expect(stored.aiParseStatus).toBe('success');

    db.updateItem(item.id, {
      aiConfidence: 0.12,
      aiReasoning: 'parse failed due ambiguous input',
      aiPromptVersion: 'sha256:abcd5678',
      aiModel: 'gpt-4.1',
      aiParseStatus: 'failed',
      status: 'failed',
    });

    const updated = db.getItemById(item.id);
    expect(updated.aiConfidence).toBe(0.12);
    expect(updated.aiReasoning).toBe('parse failed due ambiguous input');
    expect(updated.aiPromptVersion).toBe('sha256:abcd5678');
    expect(updated.aiModel).toBe('gpt-4.1');
    expect(updated.aiParseStatus).toBe('failed');
    expect(updated.status).toBe('failed');
  });

  it('stores and queries ai feedback records', () => {
    const db = getDatabase();
    const { userId, item } = createUserAndItem(db);

    db.createAiFeedback({
      id: `fb-${Date.now()}`,
      itemId: item.id,
      userId,
      originalCategory: 'todo',
      correctedCategory: 'schedule',
      originalEntities: { dueDate: '2026-02-08' },
      correctedEntities: { dueDate: '2026-02-08', startDate: '2026-02-08' },
      feedback: 'contains specific date so should be schedule',
      createdAt: '2026-02-07T01:00:00.000Z',
    });

    const feedback = db.getAiFeedbackByUser(userId, 10, 0);
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({
      itemId: item.id,
      userId,
      originalCategory: 'todo',
      correctedCategory: 'schedule',
      feedback: 'contains specific date so should be schedule',
    });
    expect(feedback[0].originalEntities).toEqual({ dueDate: '2026-02-08' });
    expect(feedback[0].correctedEntities).toEqual({ dueDate: '2026-02-08', startDate: '2026-02-08' });

    const allFeedback = db.getAiFeedbackByUser(undefined, 10, 0);
    expect(allFeedback).toHaveLength(1);
    expect(db.countAiFeedbackByUser(userId)).toBe(1);
    expect(db.countAiFeedbackByUser()).toBe(1);
  });
});
