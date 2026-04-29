/**
 * Test BVN Verification Gate Implementation
 * 
 * This script tests the BVN verification gate by checking:
 * 1. User and vendor records
 * 2. BVN verification status
 * 3. User status progression
 * 
 * Usage:
 *   npx tsx scripts/test-bvn-gate.ts +2348012345678
 */

import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function testBvnGate(phone: string) {
  console.log('🔍 Testing BVN Verification Gate Implementation\n');
  console.log(`Phone: ${phone}\n`);

  try {
    // 1. Check user record
    console.log('1️⃣ Checking user record...');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      console.log('\n💡 Create a user first:');
      console.log('   1. Register at /register');
      console.log('   2. Verify OTP');
      console.log('   3. Login with credentials');
      return;
    }

    console.log('✅ User found');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Last Login: ${user.lastLoginAt?.toISOString() || 'Never'}`);

    // 2. Check vendor record
    console.log('\n2️⃣ Checking vendor record...');
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ Vendor record not found');
      console.log('\n💡 Vendor record will be created during BVN verification');
      console.log('   Expected behavior:');
      console.log('   - User should be redirected to /vendor/kyc/tier1');
      console.log('   - After BVN verification, vendor record will be created');
      return;
    }

    console.log('✅ Vendor record found');
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Tier: ${vendor.tier}`);
    console.log(`   Status: ${vendor.status}`);
    console.log(`   BVN Verified: ${vendor.bvnVerifiedAt ? '✅ Yes' : '❌ No'}`);
    if (vendor.bvnVerifiedAt) {
      console.log(`   BVN Verified At: ${vendor.bvnVerifiedAt.toISOString()}`);
    }

    // 3. Check BVN verification status
    console.log('\n3️⃣ BVN Verification Gate Status:');
    const bvnVerified = !!vendor.bvnVerifiedAt;
    
    if (bvnVerified) {
      console.log('✅ BVN VERIFIED - User can access dashboard');
      console.log('\n📊 Expected Behavior:');
      console.log('   - User can access all dashboard routes');
      console.log('   - No redirect to /vendor/kyc/tier1');
      console.log('   - Session has bvnVerified: true');
      console.log('\n🧪 Test Steps:');
      console.log('   1. Login with credentials');
      console.log('   2. Navigate to /vendor/dashboard');
      console.log('   3. Should see dashboard (no redirect)');
    } else {
      console.log('❌ BVN NOT VERIFIED - User will be redirected');
      console.log('\n📊 Expected Behavior:');
      console.log('   - User redirected to /vendor/kyc/tier1');
      console.log('   - Cannot access dashboard routes');
      console.log('   - Session has bvnVerified: false');
      console.log('\n🧪 Test Steps:');
      console.log('   1. Login with credentials');
      console.log('   2. Try to access /vendor/dashboard');
      console.log('   3. Should redirect to /vendor/kyc/tier1');
      console.log('   4. Complete BVN verification');
      console.log('   5. Should redirect to dashboard');
    }

    // 4. Check user status progression
    console.log('\n4️⃣ User Status Progression:');
    console.log(`   Current Status: ${user.status}`);
    
    const statusProgression = {
      'unverified_tier_0': '📝 Registered, not verified',
      'phone_verified_tier_0': '📱 Phone verified via OTP',
      'verified_tier_1': '✅ BVN verified (Tier 1)',
      'verified_tier_2': '🏆 Full KYC verified (Tier 2)',
      'suspended': '🚫 Account suspended',
      'deleted': '❌ Account deleted',
    };

    console.log(`   Meaning: ${statusProgression[user.status as keyof typeof statusProgression] || 'Unknown'}`);

    if (user.status === 'phone_verified_tier_0' && !bvnVerified) {
      console.log('\n⚠️  User needs to complete BVN verification');
      console.log('   Next step: /vendor/kyc/tier1');
    } else if (user.status === 'verified_tier_1' && bvnVerified) {
      console.log('\n✅ User is fully verified for Tier 1');
      console.log('   Can bid up to ₦500,000');
    }

    // 5. Middleware behavior
    console.log('\n5️⃣ Middleware Behavior:');
    console.log('   Routes that will be checked:');
    console.log('   - /vendor/* (except /vendor/kyc/*)');
    console.log('   - /admin/*');
    console.log('   - /manager/*');
    console.log('   - /adjuster/*');
    console.log('   - /finance/*');
    console.log('\n   Routes that will NOT be checked:');
    console.log('   - /vendor/kyc/* (KYC routes)');
    console.log('   - /login, /register (auth routes)');
    console.log('   - /api/* (API routes)');

    // 6. Session structure
    console.log('\n6️⃣ Expected Session Structure:');
    console.log('   {');
    console.log(`     user: {`);
    console.log(`       id: "${user.id}",`);
    console.log(`       email: "${user.email}",`);
    console.log(`       role: "${user.role}",`);
    console.log(`       status: "${user.status}",`);
    console.log(`       bvnVerified: ${bvnVerified}`);
    console.log(`     }`);
    console.log('   }');

    // 7. Summary
    console.log('\n📋 Summary:');
    console.log(`   User Status: ${user.status}`);
    console.log(`   Vendor Tier: ${vendor.tier}`);
    console.log(`   BVN Verified: ${bvnVerified ? '✅ Yes' : '❌ No'}`);
    console.log(`   Dashboard Access: ${bvnVerified ? '✅ Allowed' : '❌ Blocked'}`);
    console.log(`   Redirect to KYC: ${bvnVerified ? '❌ No' : '✅ Yes'}`);

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Error testing BVN gate:', error);
    throw error;
  }
}

// Get phone from command line argument
const phone = process.argv[2];

if (!phone) {
  console.error('❌ Error: Phone number required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/test-bvn-gate.ts +2348012345678');
  process.exit(1);
}

testBvnGate(phone)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
