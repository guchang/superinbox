/**
 * API Integration Test Setup
 *
 * Provides test utilities, fixtures, and lifecycle hooks for API integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../../src/storage/database.js';
import crypto from 'crypto';

/**
 * Test fixtures
 */
export interface TestContext {
  testUserId: string;
  testApiKey: string;
  testApiKeyId: string;
}

let testContext: TestContext;

/**
 * Setup test environment before all tests
 */
beforeAll(() => {
  // Generate unique test user ID
  testContext = {
    testUserId: `test-user-${Date.now()}`,
    testApiKey: `test-key-${Date.now()}`,
    testApiKeyId: `test-key-id-${crypto.randomUUID()}`
  };

  // Get database instance
  const db = getDatabase();

  // Create test user first (required for foreign key constraint)
  db.createUser({
    id: testContext.testUserId,
    username: `testuser-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    passwordHash: 'test-hash',
    role: 'user'
  });

  // Create test API key (hashed value stored in DB)
  const hashedKey = crypto.createHash('sha256').update(testContext.testApiKey).digest('hex');

  db.createApiKey({
    id: testContext.testApiKeyId,
    keyValue: hashedKey,
    keyPreview: 'test...key',
    userId: testContext.testUserId,
    name: 'Test Integration Key',
    scopes: ['full']
  });
});

/**
 * Cleanup test data after all tests
 */
afterAll(() => {
  const db = getDatabase();

  // Delete test API key
  db.deleteApiKey(testContext.testApiKeyId);

  // Note: We don't delete the test user to avoid foreign key constraint issues
  // In production tests, you might want to clean up all test data
});

/**
 * Clear test data before each test if needed
 */
beforeEach(() => {
  // Reset any test-specific state here
  // Currently no-op as each test should clean up after itself
});

/**
 * Cleanup after each test if needed
 */
afterEach(() => {
  // Clean up any test-specific artifacts here
  // Currently no-op
});

/**
 * Export test context for use in tests
 */
export { testContext };

/**
 * Helper function to create a test item in the database
 */
export function createTestItem(overrides: Partial<any> = {}) {
  const db = getDatabase();
  const itemId = `test-item-${crypto.randomUUID()}`;

  const item = {
    id: itemId,
    userId: testContext.testUserId,
    originalContent: 'Test content for integration testing',
    contentType: 'text' as const,
    source: 'integration-test',
    intent: 'unknown' as const,
    entities: {},
    status: 'pending' as const,
    priority: 'medium' as const,
    distributedTargets: [],
    distributionResults: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  db.createItem(item);

  return item;
}

/**
 * Helper function to clean up test items
 */
export function cleanupTestItem(itemId: string): void {
  const db = getDatabase();
  db.deleteItem(itemId);
}
