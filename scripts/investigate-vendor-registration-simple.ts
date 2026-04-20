/**
 * Simple Investigation Script: Vendor Registration Fee System
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, desc } from 'drizzle-orm';

async function investigate() {
  console.log('🔍 VENDOR REGISTRATION FEE SYSTEM INVESTIGATION\n');

  // 1. Get sample vendor with user data
  console.log('📊 1. SAMPLE VENDOR RECORD');
  console.log('-'.repeat(80));
  
  const sampleVendors = await db
    .select()
    .from(vendors)
    .leftJoin(users, eq(vendors.userId, users.id))
    .orderBy(desc(vendors.createdAt))
    .limit(1);
  
  if (sampleVendors.length > 0) {
    const vendor = sampleVendors[0].vendors;
    const user = sampleVendors[0].users;
    
    console.log('Vendor fields:');
    console.log(JSON.stringify(vendor, null, 2));
    console.log('\nUser fields:');
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log('No vendors found');
  }

  // 2. Check environment variables
  console.log('\n📊 2. PAYSTACK ENVIRONMENT');
  console.log('-'.repeat(80));
  console.log(`PAYSTACK_SECRET_KEY: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`PAYSTACK_PUBLIC_KEY: ${process.env.PAYSTACK_PUBLIC_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'Not set'}`);

  console.log('\n✅ Investigation complete\n');
}

investigate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
