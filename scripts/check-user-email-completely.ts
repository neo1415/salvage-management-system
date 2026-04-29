import { db } from '../src/lib/db/drizzle';
import { users, vendors, auditLogs } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Check all records associated with an email address
 */
async function checkUserEmail() {
  const email = 'danieloyeniyi@thevaultlyne.com';

  console.log(`\n🔍 Checking all records for: ${email}\n`);

  // Check users table
  const userRecords = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  console.log('📧 Users table:');
  if (userRecords.length > 0) {
    userRecords.forEach((user) => {
      console.log(`  ✓ Found user: ${user.id}`);
      console.log(`    - Email: ${user.email}`);
      console.log(`    - Phone: ${user.phone}`);
      console.log(`    - Role: ${user.role}`);
      console.log(`    - Status: ${user.status}`);
      console.log(`    - Created: ${user.createdAt}`);
    });
  } else {
    console.log('  ✗ No user records found');
  }

  // Check vendors table (by userId if user exists)
  if (userRecords.length > 0) {
    const userId = userRecords[0].id;
    
    const vendorRecords = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId));

    console.log('\n🏪 Vendors table:');
    if (vendorRecords.length > 0) {
      vendorRecords.forEach((vendor) => {
        console.log(`  ✓ Found vendor: ${vendor.id}`);
        console.log(`    - User ID: ${vendor.userId}`);
        console.log(`    - Tier: ${vendor.tier}`);
        console.log(`    - Status: ${vendor.status}`);
      });
    } else {
      console.log('  ✗ No vendor records found');
    }

    // Check audit logs
    const auditRecords = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .limit(5);

    console.log('\n📋 Audit Logs (first 5):');
    if (auditRecords.length > 0) {
      auditRecords.forEach((log) => {
        console.log(`  ✓ ${log.actionType} - ${log.createdAt}`);
      });
    } else {
      console.log('  ✗ No audit log records found');
    }
  }

  console.log('\n✅ Check complete\n');
}

checkUserEmail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
