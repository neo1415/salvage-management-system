/**
 * Fix Incomplete Vendor Data
 * 
 * Finds and fixes vendors with null business names by using their user's full name
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

async function fixIncompleteVendorData() {
  console.log('🔍 Finding vendors with incomplete data...\n');

  try {
    // Find all vendors with null business names
    const incompleteVendors = await db
      .select({
        vendor: vendors,
        user: users,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(isNull(vendors.businessName));

    console.log(`Found ${incompleteVendors.length} vendors with null business names\n`);

    if (incompleteVendors.length === 0) {
      console.log('✅ No vendors need fixing');
      return;
    }

    // Fix each vendor
    for (const { vendor, user } of incompleteVendors) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Vendor ID: ${vendor.id}`);
      console.log(`User: ${user.fullName} (${user.email})`);
      console.log(`Current Business Name: ${vendor.businessName}`);
      console.log(`Status: ${vendor.status}`);
      console.log('');

      // Use the user's full name as the business name
      const newBusinessName = user.fullName || 'Individual Vendor';

      console.log(`Setting business name to: "${newBusinessName}"`);

      await db
        .update(vendors)
        .set({
          businessName: newBusinessName,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));

      console.log('✅ Updated\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ Fixed ${incompleteVendors.length} vendor records`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixIncompleteVendorData()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
