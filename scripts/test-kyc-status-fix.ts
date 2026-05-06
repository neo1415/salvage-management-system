/**
 * Test KYC Status Fix
 * 
 * This script tests the KYC status determination logic to ensure:
 * 1. Vendors with tier2SubmittedAt but no tier2ApprovedAt show as "pending"
 * 2. Vendors with tier2ApprovedAt show as "approved"
 * 3. Vendors with tier2RejectionReason show as "rejected"
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vendors } from '../src/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

async function testKYCStatusFix() {
  console.log('🔍 Testing KYC Status Fix...\n');

  try {
    // Find the vendor we just submitted
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.businessName, 'The Vaultlyne'))
      .limit(1);

    if (!vendor) {
      console.error('❌ Vendor not found');
      return;
    }

    console.log('📋 Vendor:', vendor.businessName);
    console.log('📧 Email:', vendor.user?.email || 'N/A');
    console.log('🎯 Tier:', vendor.tier);
    console.log('📅 Tier 2 Submitted:', vendor.tier2SubmittedAt ? new Date(vendor.tier2SubmittedAt).toLocaleString() : 'NOT SUBMITTED');
    console.log('✅ Tier 2 Approved:', vendor.tier2ApprovedAt ? new Date(vendor.tier2ApprovedAt).toLocaleString() : 'NOT APPROVED');
    console.log('❌ Tier 2 Rejected:', vendor.tier2RejectionReason || 'NOT REJECTED');
    console.log('');

    // Determine status using the same logic as the API
    let kycStatus: 'pending' | 'approved' | 'rejected' = 'pending';
    
    if (vendor.tier2ApprovedAt) {
      kycStatus = 'approved';
    } else if (vendor.tier2RejectionReason) {
      kycStatus = 'rejected';
    } else if (vendor.tier2SubmittedAt) {
      kycStatus = 'pending';
    } else if (vendor.status === 'suspended') {
      kycStatus = 'rejected';
    } else {
      kycStatus = 'pending';
    }

    console.log('🎯 Calculated KYC Status:', kycStatus);
    console.log('');

    // Verify the status is correct
    if (vendor.tier2SubmittedAt && !vendor.tier2ApprovedAt && !vendor.tier2RejectionReason) {
      if (kycStatus === 'pending') {
        console.log('✅ PASS: Status is correctly "pending" for submitted but not yet approved vendor');
      } else {
        console.log('❌ FAIL: Status should be "pending" but is:', kycStatus);
      }
    } else if (vendor.tier2ApprovedAt) {
      if (kycStatus === 'approved') {
        console.log('✅ PASS: Status is correctly "approved" for approved vendor');
      } else {
        console.log('❌ FAIL: Status should be "approved" but is:', kycStatus);
      }
    } else if (vendor.tier2RejectionReason) {
      if (kycStatus === 'rejected') {
        console.log('✅ PASS: Status is correctly "rejected" for rejected vendor');
      } else {
        console.log('❌ FAIL: Status should be "rejected" but is:', kycStatus);
      }
    }

    console.log('');
    console.log('📄 Document URLs:');
    console.log('  CAC Certificate:', vendor.cacCertificateUrl || 'NOT PROVIDED');
    console.log('  NIN Card:', vendor.ninCardUrl || 'NOT PROVIDED');
    console.log('  Address Proof:', vendor.addressProofUrl || 'NOT PROVIDED');
    console.log('  Bank Statement:', vendor.bankStatementUrl || 'NOT PROVIDED');
    console.log('  Photo ID:', vendor.photoIdUrl || 'NOT PROVIDED');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testKYCStatusFix();
