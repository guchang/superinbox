/**
 * Database Migrations Runner
 */

import { getDatabase } from '../database.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const migrations = [
  {
    version: '001',
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        source TEXT NOT NULL,
        intent TEXT NOT NULL,
        entities TEXT,
        summary TEXT,
        suggested_title TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        distributed_targets TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS distribution_results (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        status TEXT NOT NULL,
        external_id TEXT,
        external_url TEXT,
        error TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_value TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        scopes TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );

      CREATE TABLE IF NOT EXISTS distribution_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        conditions TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_intent ON items(intent);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
      CREATE INDEX IF NOT EXISTS idx_distribution_results_item_id ON distribution_results(item_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
    `
  }
];

export const runMigrations = async (): Promise<void> => {
  const db = getDatabase();

  console.log('Running migrations...');

  for (const migration of migrations) {
    const alreadyApplied = checkMigrationApplied(migration.version);

    if (!alreadyApplied) {
      console.log(`Applying migration: ${migration.version} - ${migration.name}`);
      (db as any).db.exec(migration.up);
      recordMigration(migration.version, migration.name);
    } else {
      console.log(`Migration ${migration.version} already applied, skipping.`);
    }
  }

  console.log('Migrations completed successfully.');
};

const checkMigrationApplied = (version: string): boolean => {
  const db = getDatabase();
  try {
    const stmt = (db as any).db.prepare('SELECT 1 FROM migrations WHERE version = ?');
    return stmt.get(version) !== undefined;
  } catch {
    return false;
  }
};

const recordMigration = (version: string, name: string): void => {
  const db = getDatabase();
  const stmt = (db as any).db.prepare(
    'INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );
  stmt.run(version, name, new Date().toISOString());
};

// Run migrations if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
