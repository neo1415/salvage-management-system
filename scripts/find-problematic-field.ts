/**
 * Find Problematic Field
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function findField() {
  console.log('🔍 Finding Problematic Field\n');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'neowalker502@gmail.com'))
    .limit(1);

  if (!user) return;

  // Test address
  console.log('Testing: address');
  try {
    await db
      .select({ id: vendors.id, address: vendors.address })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);
    console.log('✅ address works');
  } catch (err) {
    console.log('❌ address FAILS');
  }

  // Test city
  console.log('\nTesting: city');
  try {
    await db
      .select({ id: vendors.id, city: vendors.city })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);
    console.log('✅ city works');
  } catch (err) {
    console.log('❌ city FAILS');
  }

  // Test state
  console.log('\nTesting: state');
  try {
    await db
      .select({ id: vendors.id, state: vendors.state })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);
    console.log('✅ state works');
  } catch (err) {
    console.log('❌ state FAILS');
  }

  // Test cacNumber
  console.log('\nTesting: cacNumber');
  try {
    await db
      .select({ id: vendors.id, cacNumber: vendors.cacNumber })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);
    console.log('✅ cacNumber works');
  } catch (err) {
    console.log('❌ cacNumber FAILS');
  }
}

findField()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
