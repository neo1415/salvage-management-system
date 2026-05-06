/**
 * Test Minimal Vendor Query
 * 
 * Test with progressively more fields to find which one causes the error
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function testMinimal() {
  console.log('🔍 Testing Minimal Vendor Query\n');

  try {
    // Find the test vendor
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);

    // Test 1: Just ID
    console.log('\n1️⃣ Test: Select just ID');
    try {
      const [v1] = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success:', v1?.id);
    } catch (err) {
      console.log('❌ Failed:', err);
    }

    // Test 2: ID + tier
    console.log('\n2️⃣ Test: Select ID + tier');
    try {
      const [v2] = await db
        .select({ id: vendors.id, tier: vendors.tier })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success:', v2?.tier);
    } catch (err) {
      console.log('❌ Failed:', err);
    }

    // Test 3: ID + tier + status
    console.log('\n3️⃣ Test: Select ID + tier + status');
    try {
      const [v3] = await db
        .select({ id: vendors.id, tier: vendors.tier, status: vendors.status })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success:', v3?.status);
    } catch (err) {
      console.log('❌ Failed:', err);
    }

    // Test 4: Add businessName
    console.log('\n4️⃣ Test: Add businessName');
    try {
      const [v4] = await db
        .select({ 
          id: vendors.id, 
          tier: vendors.tier, 
          status: vendors.status,
          businessName: vendors.businessName 
        })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success:', v4?.businessName);
    } catch (err) {
      console.log('❌ Failed:', err);
    }

    // Test 5: Add all string fields
    console.log('\n5️⃣ Test: Add all string fields');
    try {
      const [v5] = await db
        .select({ 
          id: vendors.id, 
          tier: vendors.tier, 
          status: vendors.status,
          businessName: vendors.businessName,
          businessType: vendors.businessType,
          address: vendors.address,
          city: vendors.city,
          state: vendors.state,
        })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success');
    } catch (err) {
      console.log('❌ Failed:', err);
    }

    // Test 6: Add timestamp fields
    console.log('\n6️⃣ Test: Add timestamp fields');
    try {
      const [v6] = await db
        .select({ 
          id: vendors.id, 
          tier: vendors.tier, 
          status: vendors.status,
          businessName: vendors.businessName,
          tier2ApprovedAt: vendors.tier2ApprovedAt,
          tier2ExpiresAt: vendors.tier2ExpiresAt,
        })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);
      console.log('✅ Success');
    } catch (err) {
      console.log('❌ Failed:', err);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

testMinimal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
