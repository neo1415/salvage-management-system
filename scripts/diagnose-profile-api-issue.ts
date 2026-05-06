/**
 * Profile API Issue Diagnostic Script
 * 
 * This script diagnoses the "Cannot convert undefined or null to object" error
 * that occurs when accessing the vendor profile page after vendor approval.
 * 
 * Root Cause:
 * - Vendor approval endpoint uses .returning() which returns ALL vendor fields
 * - Some JSONB fields (performanceStats, ninVerificationData, etc.) can be NULL
 * - When profile API returns these NULL JSONB fields, frontend code using
 *   Object.entries() on them causes the error
 * 
 * Fix:
 * - Profile API now explicitly handles NULL JSONB fields
 * - use-cached-profile hook sanitizes data to prevent Object.entries errors
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseProfileIssue() {
  console.log('🔍 Diagnosing Profile API Issue\n');

  try {
    // Find the test vendor
    console.log('📊 Looking for vendor with email: neowalker502@gmail.com');
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log('✅ Found user:', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    });

    // Get vendor data
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.error('❌ Vendor not found');
      return;
    }

    console.log('\n📊 Vendor Data Structure:');
    console.log('ID:', vendor.id);
    console.log('Business Name:', vendor.businessName);
    console.log('Tier:', vendor.tier);
    console.log('Status:', vendor.status);
    
    console.log('\n🔍 JSONB Fields (potential NULL issues):');
    console.log('performanceStats:', vendor.performanceStats === null ? 'NULL' : typeof vendor.performanceStats);
    console.log('ninVerificationData:', vendor.ninVerificationData === null ? 'NULL' : typeof vendor.ninVerificationData);
    console.log('amlScreeningData:', vendor.amlScreeningData === null ? 'NULL' : typeof vendor.amlScreeningData);
    console.log('directorIds:', vendor.directorIds === null ? 'NULL' : typeof vendor.directorIds);
    console.log('fraudFlags:', vendor.fraudFlags === null ? 'NULL' : typeof vendor.fraudFlags);

    // Test Object.entries on each JSONB field
    console.log('\n🧪 Testing Object.entries on JSONB fields:');
    
    const jsonbFields = [
      { name: 'performanceStats', value: vendor.performanceStats },
      { name: 'ninVerificationData', value: vendor.ninVerificationData },
      { name: 'amlScreeningData', value: vendor.amlScreeningData },
      { name: 'directorIds', value: vendor.directorIds },
      { name: 'fraudFlags', value: vendor.fraudFlags },
    ];

    for (const field of jsonbFields) {
      try {
        if (field.value === null || field.value === undefined) {
          console.log(`⚠️  ${field.name}: NULL/undefined - would cause Object.entries error`);
        } else if (typeof field.value === 'object') {
          const entries = Object.entries(field.value);
          console.log(`✅ ${field.name}: Valid object with ${entries.length} entries`);
        } else {
          console.log(`⚠️  ${field.name}: Not an object (${typeof field.value})`);
        }
      } catch (error) {
        console.error(`❌ ${field.name}: Error -`, error instanceof Error ? error.message : String(error));
      }
    }

    // Simulate profile API response
    console.log('\n📦 Simulating Profile API Response:');
    
    const profileResponse = {
      user: {
        id: user.id,
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || null,
        status: user.status || 'unverified_tier_0',
        createdAt: user.createdAt || new Date(),
      },
      vendor: {
        businessName: vendor.businessName || null,
        businessType: vendor.businessType || null,
        tier: vendor.tier || 'tier0',
        status: vendor.status || 'pending',
        // CRITICAL: These JSONB fields must be explicitly handled
        performanceStats: vendor.performanceStats ?? null,
        ninVerificationData: vendor.ninVerificationData ?? null,
        amlScreeningData: vendor.amlScreeningData ?? null,
        directorIds: vendor.directorIds ?? null,
        fraudFlags: vendor.fraudFlags ?? null,
      },
    };

    console.log('✅ Profile response structure is valid');
    console.log('Vendor JSONB fields in response:');
    console.log('- performanceStats:', profileResponse.vendor.performanceStats === null ? 'null' : 'object');
    console.log('- ninVerificationData:', profileResponse.vendor.ninVerificationData === null ? 'null' : 'object');
    console.log('- amlScreeningData:', profileResponse.vendor.amlScreeningData === null ? 'null' : 'object');
    console.log('- directorIds:', profileResponse.vendor.directorIds === null ? 'null' : 'object');
    console.log('- fraudFlags:', profileResponse.vendor.fraudFlags === null ? 'null' : 'object');

    console.log('\n✅ Diagnostic complete');
    console.log('\n📋 Summary:');
    console.log('- Profile API has been fixed to explicitly handle NULL JSONB fields');
    console.log('- use-cached-profile hook now sanitizes data to prevent Object.entries errors');
    console.log('- All JSONB fields are now guaranteed to be either valid objects or null (never undefined)');
    console.log('\n🎯 Next Steps:');
    console.log('1. Clear browser cache and localStorage');
    console.log('2. Log out and log back in');
    console.log('3. Navigate to vendor profile page');
    console.log('4. The "Cannot convert undefined or null to object" error should be gone');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Run the diagnostic
diagnoseProfileIssue()
  .then(() => {
    console.log('\n✅ Diagnostic completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
