/**
 * Delete All Users Script
 * WARNING: This will delete ALL users from the database!
 * Use with caution - this action cannot be undone.
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';
import { vendors } from '../src/lib/db/schema/vendors';
import { auditLogs } from '../src/lib/db/schema/audit-logs';

async function deleteAllUsers() {
  try {
    console.log('\n⚠️  WARNING: This will delete ALL users from the database!');
    console.log('⚠️  This action cannot be undone.\n');

    // First, get count of users
    const allUsers = await db.select().from(users);
    const userCount = allUsers.length;

    if (userCount === 0) {
      console.log('✅ No users found in the database.');
      process.exit(0);
    }

    console.log(`📊 Found ${userCount} user(s) in the database:\n`);
    
    // Display all users
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName} (${user.email}) - ${user.phone}`);
    });

    console.log('\n🗑️  Deleting all users...\n');

    // Delete related audit logs first (to avoid foreign key constraints)
    const deletedAuditLogs = await db.delete(auditLogs).returning();
    console.log(`✅ Deleted ${deletedAuditLogs.length} audit log(s)`);

    // Delete related vendors (to avoid foreign key constraints)
    const deletedVendors = await db.delete(vendors).returning();
    console.log(`✅ Deleted ${deletedVendors.length} vendor record(s)`);

    // Delete all users
    const deletedUsers = await db.delete(users).returning();
    console.log(`✅ Deleted ${deletedUsers.length} user(s)`);

    console.log('\n✅ All users have been deleted successfully!');
    console.log('💡 You can now register with the same credentials.\n');

  } catch (error) {
    console.error('❌ Error deleting users:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

deleteAllUsers();
