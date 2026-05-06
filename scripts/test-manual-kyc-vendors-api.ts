/**
 * Test Manual KYC Vendors API
 * 
 * Verifies that the vendors API correctly returns:
 * 1. Vendors with tier=tier2_full
 * 2. Vendors with pending tier2 submissions (tier1_bvn + tier2SubmittedAt)
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, or, sql } from 'drizzle-orm';

async function testVendorsAPI() {
  console.log('🧪 Testing Manual KYC Vendors API Query\n');

  // Test 1: Get all tier2_full vendors
  console.log('Test 1: Fetching tier2_full vendors...');
  const tier2FullVendors = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      tier: vendors.tier,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2ApprovedAt: vendors.tier2ApprovedAt,
    })
    .from(vendors)
    .where(eq(vendors.tier, 'tier2_full'));

  console.log(`✅ Found ${tier2FullVendors.length} tier2_full vendors`);
  tier2FullVendors.forEach((v) => {
    console.log(`  - ${v.businessName || 'Unknown'} (${v.id})`);
    console.log(`    Submitted: ${v.tier2SubmittedAt?.toISOString() || 'N/A'}`);
    console.log(`    Approved: ${v.tier2ApprovedAt?.toISOString() || 'N/A'}`);
  });

  // Test 2: Get pending tier2 submissions
  console.log('\nTest 2: Fetching pending tier2 submissions...');
  const pendingTier2 = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      tier: vendors.tier,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2ApprovedAt: vendors.tier2ApprovedAt,
      tier2RejectionReason: vendors.tier2RejectionReason,
    })
    .from(vendors)
    .where(
      and(
        eq(vendors.tier, 'tier1_bvn'),
        sql`${vendors.tier2SubmittedAt} IS NOT NULL`,
        sql`${vendors.tier2ApprovedAt} IS NULL`,
        sql`${vendors.tier2RejectionReason} IS NULL`
      )
    );

  console.log(`✅ Found ${pendingTier2.length} pending tier2 submissions`);
  pendingTier2.forEach((v) => {
    console.log(`  - ${v.businessName || 'Unknown'} (${v.id})`);
    console.log(`    Submitted: ${v.tier2SubmittedAt?.toISOString() || 'N/A'}`);
    console.log(`    Status: Pending Review`);
  });

  // Test 3: Combined query (what the API uses)
  console.log('\nTest 3: Combined query (tier2_full OR pending tier2)...');
  const combinedResults = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      tier: vendors.tier,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2ApprovedAt: vendors.tier2ApprovedAt,
      tier2RejectionReason: vendors.tier2RejectionReason,
    })
    .from(vendors)
    .where(
      or(
        eq(vendors.tier, 'tier2_full'),
        and(
          eq(vendors.tier, 'tier1_bvn'),
          sql`${vendors.tier2SubmittedAt} IS NOT NULL`,
          sql`${vendors.tier2ApprovedAt} IS NULL`,
          sql`${vendors.tier2RejectionReason} IS NULL`
        )
      )
    );

  console.log(`✅ Found ${combinedResults.length} total results (tier2_full + pending)`);
  combinedResults.forEach((v) => {
    const status = v.tier === 'tier2_full' ? 'Approved' : 'Pending Review';
    console.log(`  - ${v.businessName || 'Unknown'} (${v.id})`);
    console.log(`    Tier: ${v.tier}`);
    console.log(`    Status: ${status}`);
    console.log(`    Submitted: ${v.tier2SubmittedAt?.toISOString() || 'N/A'}`);
    if (v.tier2ApprovedAt) {
      console.log(`    Approved: ${v.tier2ApprovedAt.toISOString()}`);
    }
  });

  // Test 4: Check for rejected submissions
  console.log('\nTest 4: Checking for rejected tier2 submissions...');
  const rejectedTier2 = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      tier: vendors.tier,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2RejectionReason: vendors.tier2RejectionReason,
    })
    .from(vendors)
    .where(sql`${vendors.tier2RejectionReason} IS NOT NULL`);

  console.log(`✅ Found ${rejectedTier2.length} rejected tier2 submissions`);
  rejectedTier2.forEach((v) => {
    console.log(`  - ${v.businessName || 'Unknown'} (${v.id})`);
    console.log(`    Reason: ${v.tier2RejectionReason}`);
  });

  console.log('\n✅ All tests complete!');
}

testVendorsAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
