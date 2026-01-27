/**
 * Migration Script: Mark unknown category items as failed
 *
 * This script updates all items with category='unknown' and status='completed'
 * to have status='failed' since they represent failed AI processing.
 */

import Database from 'better-sqlite3';
import { config } from '../config/index.js';

async function migrate() {
  const db = new Database(config.database.path);

  try {
    console.log('Starting migration: unknown -> failed status...\n');

    // Get all items with category='unknown' and status='completed'
    const rows = db.prepare(`
      SELECT * FROM items
      WHERE category = 'unknown' AND status = 'completed'
    `).all();

    console.log(`Found ${rows.length} items to migrate\n`);

    if (rows.length === 0) {
      console.log('No items need migration. Exiting.');
      db.close();
      return;
    }

    // Update each item
    let successCount = 0;
    const updateStmt = db.prepare('UPDATE items SET status = ? WHERE id = ?');

    for (const row of rows) {
      try {
        updateStmt.run('failed', row.id);
        successCount++;
        console.log(`✓ Updated item ${row.id}: "${row.original_content.substring(0, 50)}..."`);
      } catch (error) {
        console.error(`✗ Failed to update item ${row.id}:`, error);
      }
    }

    console.log(`\nMigration complete: ${successCount}/${rows.length} items updated`);
    db.close();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
