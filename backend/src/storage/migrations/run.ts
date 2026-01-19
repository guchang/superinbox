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
        category TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
      CREATE INDEX IF NOT EXISTS idx_distribution_results_item_id ON distribution_results(item_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
    `
  },
  {
    version: '002',
    name: 'enhance_access_logs',
    up: `
      -- Drop existing api_access_logs table and recreate with enhanced fields
      DROP TABLE IF EXISTS api_access_logs;

      CREATE TABLE IF NOT EXISTS api_access_logs (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL,
        api_key_name TEXT,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        full_url TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        status TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        request_size INTEGER DEFAULT 0,
        response_size INTEGER DEFAULT 0,
        duration INTEGER NOT NULL,
        request_headers TEXT,
        request_body TEXT,
        query_params TEXT,
        response_body TEXT,
        error_code TEXT,
        error_message TEXT,
        error_details TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_api_key_id ON api_access_logs(api_key_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_user_id ON api_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_timestamp ON api_access_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_status ON api_access_logs(status);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_method ON api_access_logs(method);
      CREATE INDEX IF NOT EXISTS idx_api_access_logs_endpoint ON api_access_logs(endpoint);

      -- Create export tasks table
      CREATE TABLE IF NOT EXISTS export_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        filters TEXT,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        expires_at TEXT,
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_export_tasks_user_id ON export_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_export_tasks_status ON export_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_export_tasks_expires_at ON export_tasks(expires_at);
    `
  },
  {
    version: '003',
    name: 'rename_intent_to_category',
    up: `
      -- Drop old index on intent
      DROP INDEX IF EXISTS idx_items_intent;

      -- Rename intent column to category
      ALTER TABLE items RENAME COLUMN intent TO category;

      -- Create new index on category
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
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
