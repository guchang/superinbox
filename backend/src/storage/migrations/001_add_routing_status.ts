/**
 * Migration: Add routing_status field to items table
 * 
 * This migration adds a routing_status field to track the state of routing distribution
 * for each inbox item.
 */

import type Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  console.log('Running migration: 001_add_routing_status');

  // Add routing_status column with default value 'pending'
  db.exec(`
    ALTER TABLE items 
    ADD COLUMN routing_status TEXT DEFAULT 'pending' 
    CHECK(routing_status IN ('pending', 'skipped', 'processing', 'completed', 'failed'));
  `);

  // Create index for routing_status for efficient querying
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_routing_status ON items(routing_status);
  `);

  // Update existing items based on their distribution_results
  // If they have distribution results, mark as 'completed', otherwise 'pending'
  db.exec(`
    UPDATE items 
    SET routing_status = CASE
      WHEN distributed_targets IS NOT NULL AND distributed_targets != '[]' THEN 'completed'
      ELSE 'pending'
    END;
  `);

  console.log('Migration completed: 001_add_routing_status');
}

export function down(db: Database.Database): void {
  console.log('Rolling back migration: 001_add_routing_status');

  // Drop the index
  db.exec(`DROP INDEX IF EXISTS idx_items_routing_status;`);

  // Remove the column (SQLite doesn't support DROP COLUMN directly in older versions)
  // We need to recreate the table without the column
  db.exec(`
    CREATE TABLE items_backup AS SELECT 
      id, user_id, original_content, content_type, source, category,
      entities, summary, suggested_title, status, distributed_targets,
      created_at, updated_at, processed_at
    FROM items;

    DROP TABLE items;

    CREATE TABLE items (
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
      distributed_targets TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT INTO items SELECT * FROM items_backup;
    DROP TABLE items_backup;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
  `);

  console.log('Rollback completed: 001_add_routing_status');
}
