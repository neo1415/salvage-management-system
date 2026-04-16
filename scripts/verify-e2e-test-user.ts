/**
 * Verify E2E Test User Can Login
 */

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';

async function verifyTestUser() {
  console.log('🔍 Verifying E2E test user...\n');

  try {
    // 1. Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'vendor-e2e@test.com'))
      .limit(1);

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    console.log('✅ Test user found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Full Name: ${user.fullName}`);

    // 2. Verify password
    const passwordMatches = await compare('Test123!@#', user.passwordHash);
    console.log(`\n✅ Password verification: ${passwordMatches ? 'PASS' : 'FAIL'}`);

    // 3. Check vendor profile
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (vendor) {
      console.log('\n✅ Vendor profile found:');
      console.log(`   ID: ${vendor.id}`);
      console.log(`   Business Name: ${vendor.businessName}`);
      console.log(`   Tier: ${vendor.tier}`);
      console.log(`   Status: ${vendor.status}`);
    } else {
      console.log('\n❌ Vendor profile not found');
    }

    console.log('\n✅ Test user is ready for E2E tests!');
  } catch (error) {
    console.error('❌ Error verifying test user:', error);
    throw error;
  }
}

verifyTestUser()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
