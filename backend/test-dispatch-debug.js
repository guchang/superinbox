import { getDatabase } from './dist/storage/database.js';

const db = getDatabase();
const item = db.createItem({
  id: 'test-debug-item',
  userId: 'test-user',
  originalContent: 'Test content',
  contentType: 'text',
  source: 'test',
  intent: 'unknown',
  entities: {},
  status: 'pending',
  priority: 'medium',
  distributedTargets: [],
  distributionResults: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

console.log('Created item:', item);
const retrieved = db.getItemById('test-debug-item');
console.log('Retrieved item:', retrieved);
console.log('User ID match:', retrieved?.userId === 'test-user');
