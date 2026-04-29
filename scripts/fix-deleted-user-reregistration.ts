#!/usr/bin/env node
/**
 * Fix Deleted User Re-registration Issue
 * 
 * This script handles users who were soft-deleted but want to re-register.
 * It provides two options:
 * 1. Hard delete (completely remove from database)
 * 2. Reactivate (restore the account)
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, and } from 'drizzle-orm';

const EMAIL_TO_FIX = 'danieloyeniyi@thevaultlyne.com';

async function main() {
  console.log('🔍 Checking deleted user:', EMAIL_TO_FIX);

  // Find the deleted user
  const [deletedUser] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.email, EMAIL_TO_FIX),
      eq(users.status, 'deleted')
    ))
    .limit(1);

  if (!deletedUser) {
    console.log('❌ No deleted user found with this email');
    return;
  }

  console.log('\n📧 Found deleted user:');
  console.log('  - User ID:', deletedUser.id);
  console.log('  - Email:', deletedUser.email);
  console.log('  - Phone:', deletedUser.phone);
  console.log('  - Status:', deletedUser.status);
  console.log('  - Created:', deletedUser.createdAt);

  // Find associated vendor profile
  const [vendorProfile] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, deletedUser.id))
    .limit(1);

  if (vendorProfile) {
    console.log('\n🏪 Found vendor profile:');
    console.log('  - Vendor ID:', vendorProfile.id);
    console.log('  - Tier:', vendorProfile.tier);
    console.log('  - Status:', vendorProfile.status);
  }

  // Count audit logs
  const auditLogCount = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, deletedUser.id));

  console.log('\n📋 Audit logs:', auditLogCount.length, 'records');

  console.log('\n⚠️  HARD DELETE OPTION');
  console.log('This will PERMANENTLY remove:');
  console.log('  - User record');
  console.log('  - Vendor profile');
  console.log('  - All audit logs (' + auditLogCount.length + ' records)');
  console.log('  - This action CANNOT be undone');
  console.log('  - User can then re-register with same email/phone');

  console.log('\n🔄 Performing HARD DELETE...');

  await db.transaction(async (tx) => {
    // Delete audit logs first (foreign key constraint)
    const deletedAuditLogs = await tx
      .delete(auditLogs)
      .where(eq(auditLogs.userId, deletedUser.id))
      .returning();
    console.log('  ✓ Deleted', deletedAuditLogs.length, 'audit logs');

    // Delete vendor profile
    if (vendorProfile) {
      await tx
        .delete(vendors)
        .where(eq(vendors.id, vendorProfile.id));
      console.log('  ✓ Deleted vendor profile');
    }

    // Delete user record
    await tx
      .delete(users)
      .where(eq(users.id, deletedUser.id));
    console.log('  ✓ Deleted user record');
  });

  console.log('\n✅ Hard delete complete!');
  console.log('User can now re-register with email:', EMAIL_TO_FIX);
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
