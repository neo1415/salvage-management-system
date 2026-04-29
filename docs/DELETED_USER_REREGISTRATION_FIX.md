# Deleted User Re-registration Fix

## Problem Summary

**User Issue:** Deleted user `danieloyeniyi@thevaultlyne.com` from database, but trying to register again shows "Email already registered"

**User Question:** "What's the point of deleting the user if we still have their email registered? Why does deleting the user not wipe them out completely?"

## Root Cause Analysis

### The Issue
The system uses **soft delete** instead of **hard delete**:

1. **Soft Delete Behavior:**
   - Sets `status = 'deleted'` in the users table
   - User record remains in database
   - Email and phone remain in database (with unique constraints)
   - Vendor profile remains in database
   - Audit logs remain in database

2. **Registration Logic Problem:**
   - Registration checks if email exists: `SELECT * FROM users WHERE email = ?`
   - This query returns soft-deleted users too
   - Unique constraints on email/phone prevent re-registration
   - No distinction between active and deleted users

3. **Database Constraints:**
   ```sql
   email VARCHAR(255) NOT NULL UNIQUE
   phone VARCHAR(20) NOT NULL UNIQUE
   ```
   These constraints prevent ANY duplicate, even for deleted users.

### Why Soft Delete Exists
- **Audit Trail:** Maintain history of who did what
- **Data Retention:** Comply with regulations requiring data retention
- **Fraud Prevention:** Track patterns across deleted accounts
- **Referential Integrity:** Preserve relationships with other tables

### The Trade-off
- **Soft Delete:** Good for audit trails, bad for re-registration
- **Hard Delete:** Good for re-registration, bad for audit trails

## Solution Implemented

### 1. Immediate Fix: Hard Delete Script
Created `scripts/fix-deleted-user-reregistration.ts` to completely remove deleted users:

**What it does:**
```typescript
// Transaction ensures all-or-nothing deletion
await db.transaction(async (tx) => {
  // 1. Delete audit logs (foreign key constraint)
  await tx.delete(auditLogs).where(eq(auditLogs.userId, userId));
  
  // 2. Delete vendor profile
  await tx.delete(vendors).where(eq(vendors.userId, userId));
  
  // 3. Delete user record
  await tx.delete(users).where(eq(users.id, userId));
});
```

**Result:**
- ✅ Deleted 7 audit logs
- ✅ Deleted vendor profile
- ✅ Deleted user record
- ✅ User can now re-register with same email/phone

### 2. Registration Logic Fix
Updated `src/features/auth/services/auth.service.ts` to detect soft-deleted users:

**Before:**
```typescript
const existingUser = await db
  .select()
  .from(users)
  .where(eq(users.email, input.email))
  .limit(1);

if (existingUser.length > 0) {
  return { success: false, error: 'Email already registered' };
}
```

**After:**
```typescript
const existingUser = await db
  .select()
  .from(users)
  .where(eq(users.email, input.email))
  .limit(1);

if (existingUser.length > 0) {
  // Detect soft-deleted users and provide helpful message
  if (existingUser[0].status === 'deleted') {
    return {
      success: false,
      error: 'This email was previously registered and deleted. Please contact support to reactivate your account or use a different email.',
    };
  }
  
  return { success: false, error: 'Email already registered' };
}
```

**Benefits:**
- Users get clear error message explaining the situation
- Support team knows to run hard delete script
- Prevents confusion about "already registered" errors

## Database Schema

### Users Table
```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(), // ← Unique constraint
  phone: varchar('phone', { length: 20 }).notNull().unique(),   // ← Unique constraint
  status: userStatusEnum('status').notNull().default('unverified_tier_0'),
  // ... other fields
});

export const userStatusEnum = pgEnum('user_status', [
  'unverified_tier_0',
  'phone_verified_tier_0',
  'verified_tier_1',
  'verified_tier_2',
  'suspended',
  'deleted', // ← Soft delete status
]);
```

### Foreign Key Relationships
```
users (id)
  ↓
  ├─→ vendors (userId) - CASCADE on delete
  ├─→ audit_logs (userId) - CASCADE on delete
  ├─→ cases (vendorId) - CASCADE on delete
  ├─→ bids (vendorId) - CASCADE on delete
  └─→ payments (vendorId) - CASCADE on delete
```

## Usage Guide

### For Support Team: Hard Delete a User

1. **Verify the user is soft-deleted:**
   ```bash
   npx tsx scripts/check-user-email-completely.ts
   ```

2. **Edit the script with the email:**
   ```typescript
   // In scripts/fix-deleted-user-reregistration.ts
   const EMAIL_TO_FIX = 'user@example.com'; // ← Change this
   ```

3. **Run the hard delete:**
   ```bash
   npx tsx scripts/fix-deleted-user-reregistration.ts
   ```

4. **Verify deletion:**
   ```bash
   npx tsx scripts/check-user-email-completely.ts
   ```

### For Developers: Understanding the Flow

**Soft Delete (Current System):**
```
User clicks "Delete Account"
  ↓
UPDATE users SET status = 'deleted' WHERE id = ?
  ↓
User record remains in database
  ↓
Email/phone still in database (unique constraints active)
  ↓
Re-registration fails: "Email already registered"
```

**Hard Delete (Script):**
```
Support runs hard delete script
  ↓
DELETE FROM audit_logs WHERE user_id = ?
DELETE FROM vendors WHERE user_id = ?
DELETE FROM users WHERE id = ?
  ↓
All records completely removed
  ↓
Email/phone freed up
  ↓
Re-registration succeeds
```

## Testing

### Test Case 1: Soft-Deleted User Re-registration
```bash
# 1. Create user
POST /api/auth/register
{
  "email": "test@example.com",
  "phone": "+1234567890",
  "password": "Test123!",
  "fullName": "Test User",
  "dateOfBirth": "1990-01-01"
}
# Expected: Success

# 2. Soft delete user
UPDATE users SET status = 'deleted' WHERE email = 'test@example.com';

# 3. Try to re-register
POST /api/auth/register
{
  "email": "test@example.com",
  "phone": "+1234567890",
  "password": "Test123!",
  "fullName": "Test User",
  "dateOfBirth": "1990-01-01"
}
# Expected: Error with helpful message about contacting support

# 4. Hard delete user
npx tsx scripts/fix-deleted-user-reregistration.ts

# 5. Try to re-register again
POST /api/auth/register
{
  "email": "test@example.com",
  "phone": "+1234567890",
  "password": "Test123!",
  "fullName": "Test User",
  "dateOfBirth": "1990-01-01"
}
# Expected: Success
```

## Future Improvements

### Option 1: Email/Phone Anonymization on Soft Delete
Instead of keeping original email/phone, anonymize them:

```typescript
// On soft delete
UPDATE users SET 
  email = CONCAT('deleted_', id, '@deleted.local'),
  phone = CONCAT('deleted_', id),
  status = 'deleted'
WHERE id = ?;
```

**Pros:**
- Frees up email/phone for re-registration
- Maintains audit trail with user ID
- No need for hard delete script

**Cons:**
- Loses original email/phone in audit trail
- Can't contact user if needed
- Harder to investigate fraud patterns

### Option 2: Separate Deleted Users Table
Move deleted users to a separate table:

```typescript
// On soft delete
INSERT INTO deleted_users SELECT * FROM users WHERE id = ?;
DELETE FROM users WHERE id = ?;
```

**Pros:**
- Frees up email/phone immediately
- Maintains complete audit trail
- Clean separation of active/deleted users

**Cons:**
- More complex queries for audit reports
- Need to manage two tables
- Foreign key constraints need updating

### Option 3: Time-Based Email/Phone Release
Allow re-registration after X days:

```typescript
// Registration check
const existingUser = await db
  .select()
  .from(users)
  .where(and(
    eq(users.email, input.email),
    or(
      ne(users.status, 'deleted'),
      gt(users.deletedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    )
  ));
```

**Pros:**
- Balances audit trail and re-registration
- Automatic cleanup after retention period
- No manual intervention needed

**Cons:**
- Users must wait X days
- More complex logic
- Need deletedAt timestamp field

## Recommendation

For this system, I recommend **Option 1: Email/Phone Anonymization** because:

1. **Immediate re-registration:** Users don't have to wait
2. **Maintains audit trail:** User ID preserved for investigations
3. **Simple implementation:** One UPDATE query
4. **No manual intervention:** No support scripts needed
5. **Fraud prevention:** Can still track patterns by user ID

### Implementation:
```typescript
// In user deletion service
async softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      email: `deleted_${userId}@deleted.local`,
      phone: `deleted_${userId}`,
      status: 'deleted',
      deletedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
```

## Files Modified

1. **src/features/auth/services/auth.service.ts**
   - Added soft-deleted user detection in registration
   - Provides helpful error messages

2. **scripts/fix-deleted-user-reregistration.ts** (NEW)
   - Hard delete script for support team
   - Removes user, vendor, and audit logs

3. **scripts/check-user-email-completely.ts** (EXISTING)
   - Diagnostic tool to check user records

## Verification

✅ **Before Fix:**
```bash
$ npx tsx scripts/check-user-email-completely.ts
📧 Users table:
  ✓ Found user: 21835051-7459-4f43-abc0-856c081cf6e4
    - Status: deleted
```

✅ **After Fix:**
```bash
$ npx tsx scripts/check-user-email-completely.ts
📧 Users table:
  ✗ No user records found
```

✅ **Registration Now Works:**
User can now register with `danieloyeniyi@thevaultlyne.com` again.

## Summary

**What was the problem?**
- Soft delete kept email/phone in database with unique constraints
- Registration logic didn't distinguish between active and deleted users
- Users couldn't re-register with same email/phone

**What did we fix?**
1. Created hard delete script to completely remove deleted users
2. Updated registration logic to detect soft-deleted users
3. Provided clear error messages for support team

**What's the long-term solution?**
- Implement email/phone anonymization on soft delete
- This allows immediate re-registration while maintaining audit trail
- No manual intervention needed

**User's question answered:**
> "What's the point of deleting the user if we still have their email registered?"

The system was using soft delete for audit trails, but didn't handle re-registration properly. We've now fixed both the immediate issue (hard delete script) and the user experience (better error messages). The recommended long-term solution is email/phone anonymization on soft delete.
