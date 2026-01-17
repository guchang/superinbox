/**
 * Make a User Admin
 *
 * Usage: npm run make-admin <username>
 *
 * This script promotes a user to admin role.
 */

import { getDatabase } from '../src/storage/database.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npm run make-admin <username>');
  console.error('Example: npm run make-admin myusername');
  process.exit(1);
}

const username = args[0];

try {
  const db = getDatabase();

  // Get user by username
  const user = db.getUserByUsername(username);

  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(1);
  }

  console.log(`Found user:`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Current Role: ${user.role}`);

  if (user.role === 'admin') {
    console.log(`\nUser "${username}" is already an admin`);
    process.exit(0);
  }

  // Update user role to admin
  const stmt = (db as any).db.prepare('UPDATE users SET role = ? WHERE username = ?');
  stmt.run('admin', username);

  console.log(`\n✅ Successfully promoted "${username}" to admin!`);

  // Verify the change
  const updatedUser = db.getUserByUsername(username);
  console.log(`\nUpdated user:`);
  console.log(`  Username: ${updatedUser.username}`);
  console.log(`  Email: ${updatedUser.email}`);
  console.log(`  New Role: ${updatedUser.role}`);

  process.exit(0);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
