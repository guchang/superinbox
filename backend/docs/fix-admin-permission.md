# Admin Permission Fix

## Problem

Users were seeing "权限不足" (Permission denied) error when accessing the logs pages, even after logging in with username and password.

## Root Cause

The system was creating all new users with `role: 'user'` by default, but the logs pages require `role: 'admin'` to access. There was no initial admin user or mechanism to promote users to admin role.

## Solution Implemented

### 1. Auto-Admin First User

Modified the registration logic in `backend/src/auth/auth.service.ts` to automatically make the **first registered user** an admin:

```typescript
// Check if this is the first user (make them admin)
const allUsers = db.getAllUsers();
const isFirstUser = !allUsers || allUsers.length === 0;
const userRole = isFirstUser ? 'admin' : 'user';
```

### 2. Added getAllUsers() Method

Added `getAllUsers()` method to the database class in `backend/src/storage/database.ts` to support checking if there are any existing users.

### 3. Debug Logging

Added console.log statements in both logs pages to help diagnose auth state issues:

- Logs the complete auth state on page load
- Logs when permission check fails
- Shows user details including role

## How to Fix Your Existing Account

If you already have a user account and it's not admin, you have two options:

### Option 1: Update Your Role in Database (Recommended)

Run this SQL command directly on your database:

```bash
cd backend
sqlite3 data/superinbox.db
```

Then in SQLite:
```sql
-- Check your current role
SELECT id, username, email, role FROM users;

-- Update your role to admin
UPDATE users SET role = 'admin' WHERE username = 'your_username';

-- Verify the change
SELECT id, username, email, role FROM users;
```

### Option 2: Create a New Admin Account

1. Delete the database file to start fresh:
```bash
cd backend
rm data/superinbox.db
npm run db:migrate
npm run db:seed
```

2. Register a new account - it will automatically become admin since it's the first user

## Verification

After the fix, you should see console output like this when accessing the logs page:

```javascript
[GlobalLogsPage] Auth state: {
  isLoading: false,
  isAuthenticated: true,
  hasUser: true,
  user: {
    id: "...",
    username: "...",
    email: "...",
    role: "admin"  // <-- This should be "admin"
  }
}
```

## Files Changed

- `backend/src/auth/auth.service.ts` - Auto-admin first user logic
- `backend/src/storage/database.ts` - Added getAllUsers() method
- `web/src/app/(dashboard)/settings/logs/page.tsx` - Debug logging
- `web/src/app/(dashboard)/settings/api-keys/[id]/logs/page.tsx` - Debug logging

## Future Improvements

- [ ] Add admin user management UI to promote/demote users
- [ ] Add role-based permissions middleware
- [ ] Create initial admin user via seed data
- [ ] Add role field to user profile settings
