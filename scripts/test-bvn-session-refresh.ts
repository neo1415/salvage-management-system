import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Test BVN Session Refresh
 * 
 * This script checks if a vendor's BVN verification status is properly stored
 * and can be retrieved for session refresh.
 * 
 * Usage: npx tsx scripts/test-bvn-session-refresh.ts <phone_number>
 */

async function testBVNSessionRefresh(phoneNumber: string) {
  console.log('\n🔍 Testing BVN Session Refresh...\n');
  console.log(`Phone: ${phoneNumber}\n`);

  try {
    // 1. Find user by phone
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phoneNumber))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.fullName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}\n`);

    // 2. Check vendor record
    if (user.role === 'vendor') {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);

      if (!vendor) {
        console.log('❌ Vendor record not found');
        return;
      }

      console.log('✅ Vendor record found:');
      console.log(`   Vendor ID: ${vendor.id}`);
      console.log(`   Tier: ${vendor.tier}`);
      console.log(`   Status: ${vendor.status}`);
      console.log(`   BVN Verified: ${vendor.bvnVerifiedAt ? '✅ YES' : '❌ NO'}`);
      
      if (vendor.bvnVerifiedAt) {
        console.log(`   BVN Verified At: ${vendor.bvnVerifiedAt.toISOString()}`);
        console.log(`   BVN Encrypted: ${vendor.bvnEncrypted ? 'Yes (stored securely)' : 'No'}`);
      }
      
      console.log('\n📋 Session Token Values:');
      console.log(`   token.vendorId = "${vendor.id}"`);
      console.log(`   token.bvnVerified = ${!!vendor.bvnVerifiedAt}`);
      console.log(`   token.role = "${user.role}"`);
      console.log(`   token.status = "${user.status}"`);

      console.log('\n🔐 Middleware Check:');
      if (vendor.bvnVerifiedAt) {
        console.log('   ✅ PASS - User should be able to access dashboard');
        console.log('   ✅ Middleware will allow access to /vendor/dashboard');
      } else {
        console.log('   ❌ FAIL - User will be redirected to /vendor/kyc/tier1');
        console.log('   ❌ Middleware will block dashboard access');
      }

      console.log('\n💡 Next Steps:');
      if (!vendor.bvnVerifiedAt) {
        console.log('   1. Complete BVN verification at /vendor/kyc/tier1');
        console.log('   2. Use test BVN: 12345678901 (in test mode)');
        console.log('   3. After verification, session will auto-refresh');
        console.log('   4. You will be redirected to dashboard automatically');
      } else {
        console.log('   1. Login with this account');
        console.log('   2. You should go directly to /vendor/dashboard');
        console.log('   3. No BVN verification required');
      }

    } else {
      console.log('ℹ️  User is not a vendor - BVN verification not required');
      console.log(`   Role: ${user.role}`);
      console.log('   Non-vendors can access their dashboards directly');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n✅ Test complete\n');
  process.exit(0);
}

// Get phone number from command line
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.log('Usage: npx tsx scripts/test-bvn-session-refresh.ts <phone_number>');
  console.log('Example: npx tsx scripts/test-bvn-session-refresh.ts +2348012345678');
  process.exit(1);
}

testBVNSessionRefresh(phoneNumber);
