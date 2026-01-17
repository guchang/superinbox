import { getDatabase } from './dist/storage/database.js';

const db = getDatabase();
const items = db.getItemsByUserId('default-user', { limit: 1 });

if (items.length > 0) {
  const item = items[0];
  console.log('Latest item:');
  console.log('ID:', item.id);
  console.log('Content:', item.originalContent);
  console.log('Status:', item.status);
  console.log('Intent:', item.intent);
  console.log('Created:', item.createdAt);
  console.log('Processed:', item.processedAt);
  console.log('Analysis:', JSON.stringify(item.summary || item.entities, null, 2));
} else {
  console.log('No items found');
}
