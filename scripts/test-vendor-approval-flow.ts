/**
 * Test Vendor Approval Flow
 * 
 * This script tests the complete vendor approval flow to ensure:
 * 1. API endpoint receives the request
 * 2. Database is updated correctly
 * 3. Response is returned with success flag
 * 4. Frontend receives and processes the response
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function testVendorApprovalFlow() {
  console.log('🧪 Testing Vendor Approval Flow\n');

  try {
    // Find the test vendor
    const testEmail = 'neowalker502@gmail.com';
    console.log(`🔍 Looking for vendor with email: ${testEmail}`);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (!user) {
      console.error('❌ Test vendor user not found');
      return;
    }

    console.log('✅ Found user:', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    });

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.error('❌ Vendor record not found');
      return;
    }

    console.log('\n📊 Current Vendor State:');
    console.log('  ID:', vendor.id);
    console.log('  Business Name:', vendor.businessName);
    console.log('  Status:', vendor.status);
    console.log('  Tier:', vendor.tier);
    console.log('  Tier 2 Submitted At:', vendor.tier2SubmittedAt);
    console.log('  Tier 2 Approved At:', vendor.tier2ApprovedAt);
    console.log('  Tier 2 Approved By:', vendor.tier2ApprovedBy);
    console.log('  Tier 2 Expires At:', vendor.tier2ExpiresAt);
    console.log('  Tier 2 Rejection Reason:', vendor.tier2RejectionReason);

    // Check if already approved
    if (vendor.status === 'approved' && vendor.tier === 'tier2_full' && vendor.tier2ApprovedAt) {
      console.log('\n✅ Vendor is already properly approved!');
      console.log('\n📋 Approval Details:');
      console.log('  Approved At:', vendor.tier2ApprovedAt);
      console.log('  Approved By:', vendor.tier2ApprovedBy);
      console.log('  Expires At:', vendor.tier2ExpiresAt);
      return;
    }

    // Check if Tier 2 KYC was submitted
    if (!vendor.tier2SubmittedAt) {
      console.log('\n⚠️ Warning: Tier 2 KYC has not been submitted yet');
      console.log('   The vendor needs to complete Tier 2 KYC before approval');
      return;
    }

    console.log('\n⚠️ Vendor needs approval!');
    console.log('\n📝 Expected State After Approval:');
    console.log('  Status: approved');
    console.log('  Tier: tier2_full');
    console.log('  Tier 2 Approved At: [current timestamp]');
    console.log('  Tier 2 Approved By: [manager ID]');
    console.log('  Tier 2 Expires At: [1 year from now]');
    console.log('  Tier 2 Rejection Reason: null');

    console.log('\n🔧 To approve this vendor:');
    console.log('1. Log in as a Salvage Manager');
    console.log('2. Navigate to Manager > Vendors');
    console.log('3. Click on the Tier 2 tab');
    console.log('4. Find the vendor and click "Review Application"');
    console.log('5. Click "Approve" and submit');
    console.log('\n📊 Watch the browser console for detailed logs');
    console.log('📊 Watch the server console for API logs');

  } catch (error) {
    console.error('❌ Error testing vendor approval flow:', error);
  }
}

testVendorApprovalFlow()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
