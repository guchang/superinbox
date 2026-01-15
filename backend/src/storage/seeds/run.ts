/**
 * Database Seeds Runner
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database.js';

const seeds = {
  apiKeys: [
    {
      id: uuidv4(),
      keyValue: 'dev-key-change-this-in-production',
      userId: 'default-user',
      scopes: JSON.stringify(['read', 'write', 'distribute']),
      isActive: 1,
      createdAt: new Date().toISOString()
    }
  ]
};

export const runSeeds = async (): Promise<void> => {
  const db = getDatabase();

  console.log('Running seeds...');

  // Seed API keys
  for (const key of seeds.apiKeys) {
    const exists = checkApiKeyExists(key.keyValue);

    if (!exists) {
      console.log(`Seeding API key: ${key.keyValue}`);
      const stmt = (db as any).db.prepare(`
        INSERT INTO api_keys (id, key_value, user_id, scopes, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(key.id, key.keyValue, key.userId, key.scopes, key.isActive, key.createdAt);
    } else {
      console.log(`API key ${key.keyValue} already exists, skipping.`);
    }
  }

  console.log('Seeds completed successfully.');
};

const checkApiKeyExists = (keyValue: string): boolean => {
  const db = getDatabase();
  try {
    const stmt = (db as any).db.prepare('SELECT 1 FROM api_keys WHERE key_value = ?');
    return stmt.get(keyValue) !== undefined;
  } catch {
    return false;
  }
};

// Run seeds if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds()
    .then(() => {
      console.log('Seeds completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
