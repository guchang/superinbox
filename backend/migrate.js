/**
 * Manual migration script to add routing_status column
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'superinbox.db');

console.log('Opening database:', dbPath);
const db = new Database(dbPath);

try {
  console.log('Adding routing_status column...');
  
  // Add the column
  db.exec(`
    ALTER TABLE items 
    ADD COLUMN routing_status TEXT DEFAULT 'pending' 
    CHECK(routing_status IN ('pending', 'skipped', 'processing', 'completed', 'failed'));
  `);
  
  console.log('Creating index...');
  
  // Create index
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_routing_status ON items(routing_status);
  `);
  
  console.log('Updating existing items...');
  
  // Update existing items based on their distribution_results
  db.exec(`
    UPDATE items 
    SET routing_status = CASE
      WHEN distributed_targets IS NOT NULL AND distributed_targets != '[]' THEN 'completed'
      ELSE 'pending'
    END;
  `);
  
  console.log('Migration completed successfully!');
  
  // Verify
  const count = db.prepare('SELECT COUNT(*) as count FROM items').get();
  console.log(`Total items: ${count.count}`);
  
  const statusCounts = db.prepare(`
    SELECT routing_status, COUNT(*) as count 
    FROM items 
    GROUP BY routing_status
  `).all();
  
  console.log('Status distribution:');
  statusCounts.forEach(row => {
    console.log(`  ${row.routing_status}: ${row.count}`);
  });
  
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
