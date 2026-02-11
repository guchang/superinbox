import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import categoriesRoutes from '../../src/ai/routes/categories.routes.js';
import inboxRoutes from '../../src/capture/routes/inbox.routes.js';
import { getDatabase } from '../../src/storage/database.js';
import { hashApiKey } from '../../src/utils/api-key.js';

const unique = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
});
