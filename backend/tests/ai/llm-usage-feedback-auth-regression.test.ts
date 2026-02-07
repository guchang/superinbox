import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    getAiFeedbackByUser: vi.fn(),
    countAiFeedbackByUser: vi.fn(),
  },
}));

vi.mock('../../src/storage/database.js', () => ({
  getDatabase: () => mockDb,
}));

import { getAiFeedback } from '../../src/ai/llm-usage.controller.js';

const createResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('LLM usage feedback auth regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getAiFeedbackByUser.mockReturnValue([]);
    mockDb.countAiFeedbackByUser.mockReturnValue(0);
  });

  it('rejects request without authenticated user', async () => {
    const req: any = { query: {} };
    const res = createResponse();

    await getAiFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDb.getAiFeedbackByUser).not.toHaveBeenCalled();
  });

  it('forces non-admin to use own userId when query userId is omitted', async () => {
    const req: any = {
      query: { page: '1', pageSize: '20' },
      user: { id: 'u1', userId: 'u1', scopes: ['read'] },
    };
    const res = createResponse();

    await getAiFeedback(req, res);

    expect(mockDb.getAiFeedbackByUser).toHaveBeenCalledWith('u1', 20, 0);
    expect(mockDb.countAiFeedbackByUser).toHaveBeenCalledWith('u1');
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('blocks non-admin from querying another userId', async () => {
    const req: any = {
      query: { userId: 'u2' },
      user: { id: 'u1', userId: 'u1', scopes: ['read'] },
    };
    const res = createResponse();

    await getAiFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockDb.getAiFeedbackByUser).not.toHaveBeenCalled();
  });

  it('allows admin to query another userId', async () => {
    const req: any = {
      query: { userId: 'u2', page: '2', pageSize: '10' },
      user: { id: 'admin-1', userId: 'admin-1', scopes: ['admin:full'] },
    };
    const res = createResponse();

    await getAiFeedback(req, res);

    expect(mockDb.getAiFeedbackByUser).toHaveBeenCalledWith('u2', 10, 10);
    expect(mockDb.countAiFeedbackByUser).toHaveBeenCalledWith('u2');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });
});
