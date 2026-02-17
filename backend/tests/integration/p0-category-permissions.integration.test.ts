import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import categoriesRoutes from '../../src/ai/routes/categories.routes.js';
import inboxRoutes from '../../src/capture/routes/inbox.routes.js';
import authRoutes from '../../src/auth/auth.routes.js';
import logsRoutes from '../../src/auth/logs.routes.js';
import apiKeysRoutes from '../../src/api-keys/api-keys.routes.js';
import { getDatabase } from '../../src/storage/database.js';
import { hashApiKey } from '../../src/utils/api-key.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';

const unique = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const uniqueUsername = (): string =>
  `u${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 6)}`;

const getScopesByRole = (role: 'admin' | 'user'): string[] =>
  role === 'admin'
    ? ['admin:full', 'read', 'write', 'content:all']
    : ['read', 'write', 'content:all'];

const createJwtToken = (params: {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}): string =>
  generateAccessToken({
    userId: params.userId,
    username: params.username,
    email: params.email,
    role: params.role,
    scopes: getScopesByRole(params.role),
  });

const createApiKeyForUser = (userId: string, scopes: string[]): string => {
  const db = getDatabase();
  const plainApiKey = unique('sk-test');

  db.createApiKey({
    id: unique('apk'),
    keyValue: hashApiKey(plainApiKey),
    keyPreview: `${plainApiKey.slice(0, 8)}...`,
    userId,
    name: unique('test-key'),
    scopes,
  });

  return plainApiKey;
};

const createUserWithApiKey = (scopes: string[]): { userId: string; apiKey: string } => {
  const db = getDatabase();
  const userId = unique('user');

  db.createUser({
    id: userId,
    username: unique('u'),
    email: `${unique('mail')}@example.com`,
    passwordHash: 'test-hash',
  });

  return {
    userId,
    apiKey: createApiKeyForUser(userId, scopes),
  };
};

const createCategoriesApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/v1/categories', categoriesRoutes);
  return app;
};

const createInboxApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/v1', inboxRoutes);
  return app;
};

const createAuthApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/v1/auth', authRoutes);
  return app;
};

const createLogsAndApiKeysApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/v1/auth', logsRoutes);
  app.use('/v1/auth/api-keys', apiKeysRoutes);
  return app;
};

describe('P0 category permissions and trash migration', () => {
  beforeEach(() => {
    getDatabase();
  });

  it('allows category read scope but blocks writes', async () => {
    const { apiKey } = createUserWithApiKey(['category:read']);
    const app = createCategoriesApp();

    const listResp = await request(app)
      .get('/v1/categories')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(listResp.status).toBe(200);

    const createResp = await request(app)
      .post('/v1/categories')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ key: unique('cat'), name: 'Cat' });
    expect(createResp.status).toBe(403);
  });

  it('keeps one-version compatibility for read/write scopes', async () => {
    const readUser = createUserWithApiKey(['read']);
    const writeUser = createUserWithApiKey(['write']);
    const noPermUser = createUserWithApiKey(['inbox:read']);
    const app = createCategoriesApp();

    const readResp = await request(app)
      .get('/v1/categories')
      .set('Authorization', `Bearer ${readUser.apiKey}`);
    expect(readResp.status).toBe(200);

    const writeResp = await request(app)
      .post('/v1/categories')
      .set('Authorization', `Bearer ${writeUser.apiKey}`)
      .send({ key: unique('legacy'), name: 'Legacy' });
    expect(writeResp.status).toBe(200);

    const noPermResp = await request(app)
      .get('/v1/categories')
      .set('Authorization', `Bearer ${noPermUser.apiKey}`);
    expect(noPermResp.status).toBe(403);
  });

  it('migrates items to trash when deleting a normal category', async () => {
    const { userId, apiKey } = createUserWithApiKey(['category:write']);
    const app = createCategoriesApp();
    const db = getDatabase();

    const createResp = await request(app)
      .post('/v1/categories')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ key: unique('to-delete'), name: 'ToDelete' });
    expect(createResp.status).toBe(200);
    const categoryId = createResp.body?.data?.id as string;
    const categoryKey = createResp.body?.data?.key as string;

    const createdItemIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = unique('item');
      createdItemIds.push(id);
      db.createItem({
        id,
        userId,
        originalContent: `content-${i}`,
        contentType: 'text',
        source: 'test',
        category: categoryKey,
        entities: {},
        status: 'pending',
        distributedTargets: [],
        distributionResults: [],
        routingStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    const deleteResp = await request(app)
      .delete(`/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${apiKey}`);

    expect(deleteResp.status).toBe(200);
    expect(deleteResp.body?.meta?.migratedCount).toBe(3);
    expect(deleteResp.body?.meta?.migratedTo).toBe('trash');

    for (const id of createdItemIds) {
      const item = db.getItemById(id);
      expect(item?.category).toBe('trash');
    }
  });

  it('rejects update/delete operations for system categories', async () => {
    const { apiKey } = createUserWithApiKey(['category:read', 'category:write']);
    const app = createCategoriesApp();

    const listResp = await request(app)
      .get('/v1/categories')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(listResp.status).toBe(200);

    const unknownCategory = listResp.body.data.find((item: any) => item.key === 'unknown');
    const trashCategory = listResp.body.data.find((item: any) => item.key === 'trash');
    expect(unknownCategory).toBeDefined();
    expect(trashCategory).toBeDefined();

    const updateUnknownResp = await request(app)
      .put(`/v1/categories/${unknownCategory.id}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ name: 'Renamed Unknown' });
    expect(updateUnknownResp.status).toBe(400);

    const deleteTrashResp = await request(app)
      .delete(`/v1/categories/${trashCategory.id}`)
      .set('Authorization', `Bearer ${apiKey}`);
    expect(deleteTrashResp.status).toBe(400);
  });

  it('rejects empty inbox update payload', async () => {
    const { apiKey } = createUserWithApiKey(['write']);
    const app = createInboxApp();

    const resp = await request(app)
      .put(`/v1/inbox/${unique('missing-item')}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .send({});

    expect(resp.status).toBe(400);
    expect(resp.body?.code).toBe('INBOX.INVALID_INPUT');
  });

  it('does not grant admin:full scope to normal register/login users', async () => {
    const app = createAuthApp();
    const username = uniqueUsername();
    const email = `${unique('mail')}@example.com`;
    const password = 'password123';

    const registerResp = await request(app)
      .post('/v1/auth/register')
      .send({ username, email, password });

    expect(registerResp.status).toBe(201);
    expect(registerResp.body?.data?.user?.role).toBe('user');
    expect(registerResp.body?.data?.user?.scopes).not.toContain('admin:full');
    expect(registerResp.body?.data?.user?.scopes).toEqual(
      expect.arrayContaining(['read', 'write', 'content:all'])
    );

    const loginResp = await request(app)
      .post('/v1/auth/login')
      .send({ username, password });

    expect(loginResp.status).toBe(200);
    expect(loginResp.body?.data?.user?.scopes).not.toContain('admin:full');
    expect(loginResp.body?.data?.user?.scopes).toEqual(
      expect.arrayContaining(['read', 'write', 'content:all'])
    );
  });

  it('grants admin:full scope only to admin role users on login', async () => {
    const app = createAuthApp();
    const db = getDatabase();
    const username = uniqueUsername();
    const password = 'password123';
    const passwordHash = await hashPassword(password);

    db.createUser({
      id: unique('admin-user'),
      username,
      email: `${unique('admin-mail')}@example.com`,
      passwordHash,
      role: 'admin',
    });

    const loginResp = await request(app)
      .post('/v1/auth/login')
      .send({ username, password });

    expect(loginResp.status).toBe(200);
    expect(loginResp.body?.data?.user?.role).toBe('admin');
    expect(loginResp.body?.data?.user?.scopes).toContain('admin:full');
  });

  it('blocks non-admin JWT user from creating global logs export task', async () => {
    const app = createLogsAndApiKeysApp();
    const userId = unique('jwt-user');
    const username = uniqueUsername();
    const email = `${unique('jwt-mail')}@example.com`;
    const db = getDatabase();

    db.createUser({
      id: userId,
      username,
      email,
      passwordHash: 'test-hash',
      role: 'user',
    });

    const token = createJwtToken({ userId, username, email, role: 'user' });

    const resp = await request(app)
      .post('/v1/auth/logs/export')
      .set('Authorization', `Bearer ${token}`)
      .send({
        format: 'json',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T23:59:59.999Z',
        includeFields: ['timestamp', 'endpoint'],
      });

    expect(resp.status).toBe(403);
    expect(resp.body?.code).toBe('AUTH.FORBIDDEN');
  });

  it('routes /auth/api-keys/:id/logs to owner-check endpoint for non-admin JWT users', async () => {
    const app = createLogsAndApiKeysApp();
    const db = getDatabase();
    const userId = unique('owner-user');
    const username = uniqueUsername();
    const email = `${unique('owner-mail')}@example.com`;
    const apiKeyId = unique('apk-owner');
    const plainApiKey = unique('sk-owner');

    db.createUser({
      id: userId,
      username,
      email,
      passwordHash: 'test-hash',
      role: 'user',
    });

    db.createApiKey({
      id: apiKeyId,
      keyValue: hashApiKey(plainApiKey),
      keyPreview: `${plainApiKey.slice(0, 8)}...`,
      userId,
      name: unique('owner-key'),
      scopes: ['read'],
    });

    const token = createJwtToken({ userId, username, email, role: 'user' });

    const resp = await request(app)
      .get(`/v1/auth/api-keys/${apiKeyId}/logs`)
      .set('Authorization', `Bearer ${token}`);

    expect(resp.status).toBe(200);
    expect(resp.body?.success).toBe(true);
    expect(resp.body?.data).toHaveProperty('logs');
  });
});
