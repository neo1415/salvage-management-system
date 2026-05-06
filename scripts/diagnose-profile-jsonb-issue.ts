/**
 * Diagnose Profile JSONB Issue
 * 
 * Check if vendor JSONB fields are causing Object.entries errors
 * This started happening after the vendor approval fix
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 Diagnosing Profile JSONB Issue\n');

  try {
    // Find the test vendor
    console.log('1️⃣ Finding vendor with email: neowalker502@gmail.com');
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);

    // Fetch vendor with Drizzle ORM
    console.log('\n2️⃣ Fetching vendor with Drizzle ORM:');
    const [vendor] = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        tier: vendors.tier,
        status: vendors.status,
        performanceStats: vendors.performanceStats,
        ninVerificationData: vendors.ninVerificationData,
        amlScreeningData: vendors.amlScreeningData,
        directorIds: vendors.directorIds,
        fraudFlags: vendors.fraudFlags,
      })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ Vendor not found');
      return;
    }

    console.log('✅ Vendor found via Drizzle');
    console.log('Business Name:', vendor.businessName);
    console.log('Tier:', vendor.tier);
    console.log('Status:', vendor.status);

    // Check each JSONB field
    console.log('\n3️⃣ Checking JSONB fields:');
    
    const jsonbFields = [
      { name: 'performanceStats', value: vendor.performanceStats },
      { name: 'ninVerificationData', value: vendor.ninVerificationData },
      { name: 'amlScreeningData', value: vendor.amlScreeningData },
      { name: 'directorIds', value: vendor.directorIds },
      { name: 'fraudFlags', value: vendor.fraudFlags },
    ];

    for (const field of jsonbFields) {
      console.log(`\n${field.name}:`);
      console.log('  Type:', typeof field.value);
      console.log('  Value:', field.value === null ? 'NULL' : field.value === undefined ? 'UNDEFINED' : 'HAS VALUE');
      
      if (field.value !== null && field.value !== undefined) {
        console.log('  Content:', JSON.stringify(field.value));
        
        // Try Object.entries
        try {
          const entries = Object.entries(field.value as any);
          console.log(`  ✅ Object.entries works: ${entries.length} entries`);
        } catch (err) {
          console.log(`  ❌ Object.entries failed:`, err);
        }
      }
    }

    // Test the profile API endpoint
    console.log('\n4️⃣ Testing profile API endpoint simulation:');
    const profileResponse = {
      user: {
        id: user.id,
        fullName: 'Test',
        email: user.email,
        phone: '',
        dateOfBirth: null,
        status: 'verified_tier_1',
        createdAt: new Date(),
      },
      vendor: {
        businessName: vendor.businessName || null,
        businessType: null,
        address: null,
        city: null,
        state: null,
        cacNumber: null,
        tin: null,
        bankAccountNumber: null,
        bankAccountName: null,
        bankName: null,
        tier: vendor.tier || 'tier0',
        status: vendor.status || 'pending',
        tier2ApprovedAt: null,
        tier2ExpiresAt: null,
        // Use nullish coalescing to ensure null instead of undefined
        performanceStats: vendor.performanceStats ?? null,
        ninVerificationData: vendor.ninVerificationData ?? null,
        amlScreeningData: vendor.amlScreeningData ?? null,
        directorIds: vendor.directorIds ?? null,
        fraudFlags: vendor.fraudFlags ?? null,
      },
    };

    console.log('Profile response structure:');
    console.log(JSON.stringify(profileResponse, null, 2));

    console.log('\n✅ Diagnosis complete');
    console.log('\n📋 Summary:');
    console.log('- Check if any JSONB fields are undefined (should be null)');
    console.log('- Verify Object.entries works on all JSONB fields');
    console.log('- Confirm profile API response structure is correct');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
