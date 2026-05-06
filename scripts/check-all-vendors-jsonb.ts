/**
 * Check All Vendors JSONB Fields
 * 
 * Find any vendors with problematic JSONB fields
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema';

async function checkAllVendors() {
  console.log('🔍 Checking All Vendors JSONB Fields\n');

  try {
    // Fetch all vendors
    console.log('1️⃣ Fetching all vendors...');
    const allVendors = await db
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
      .from(vendors);

    console.log(`✅ Found ${allVendors.length} vendors\n`);

    let problemCount = 0;

    for (const vendor of allVendors) {
      const problems: string[] = [];

      // Check each JSONB field
      const jsonbFields = [
        { name: 'performanceStats', value: vendor.performanceStats },
        { name: 'ninVerificationData', value: vendor.ninVerificationData },
        { name: 'amlScreeningData', value: vendor.amlScreeningData },
        { name: 'directorIds', value: vendor.directorIds },
        { name: 'fraudFlags', value: vendor.fraudFlags },
      ];

      for (const field of jsonbFields) {
        // Check if undefined (should be null or object)
        if (field.value === undefined) {
          problems.push(`${field.name} is UNDEFINED (should be null or object)`);
        }
        // Check if it's an object but Object.entries fails
        else if (field.value !== null && typeof field.value === 'object') {
          try {
            Object.entries(field.value as any);
          } catch (err) {
            problems.push(`${field.name} causes Object.entries error: ${err}`);
          }
        }
      }

      if (problems.length > 0) {
        problemCount++;
        console.log(`❌ Vendor ${vendor.id} (${vendor.businessName || 'No name'}):`);
        console.log(`   Tier: ${vendor.tier}, Status: ${vendor.status}`);
        problems.forEach(p => console.log(`   - ${p}`));
        console.log('');
      }
    }

    if (problemCount === 0) {
      console.log('✅ No problems found! All vendors have valid JSONB fields.');
    } else {
      console.log(`\n⚠️  Found ${problemCount} vendors with JSONB field problems`);
    }

  } catch (error) {
    console.error('❌ Error during check:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

checkAllVendors()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
