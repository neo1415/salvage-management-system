/**
 * Check Vendor Business Name
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkVendorBusinessName() {
  console.log('🔍 Checking vendor business name...\n');

  try {
    const vendorId = '049ac348-f4e2-42e0-99cf-b9f4f811560c';

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      console.log('❌ Vendor not found!');
      return;
    }

    console.log('✅ Found vendor:');
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Business Name: "${vendor.businessName}"`);
    console.log(`   Business Name Type: ${typeof vendor.businessName}`);
    console.log(`   Business Name === null: ${vendor.businessName === null}`);
    console.log(`   Business Name === "null": ${vendor.businessName === 'null'}`);
    console.log(`   User ID: ${vendor.userId}`);
    console.log(`   Tier: ${vendor.tier}`);
    console.log('');

    // Check all fields
    console.log('All vendor fields:');
    console.log(JSON.stringify(vendor, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkVendorBusinessName()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
