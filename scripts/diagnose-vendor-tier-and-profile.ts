/**
 * Diagnose Vendor Tier and Profile Issues
 * 
 * This script checks:
 * 1. Vendor tier in database
 * 2. Profile API response
 * 3. Bidding limits based on tier
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseVendorTierAndProfile() {
  console.log('🔍 Diagnosing Vendor Tier and Profile Issues\n');

  try {
    // Find the test vendor
    const testEmail = 'neowalker502@gmail.com';
    console.log(`Looking for vendor with email: ${testEmail}`);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log('\n✅ User found:', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
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

    console.log('\n📊 Vendor Database State:');
    console.log('  ID:', vendor.id);
    console.log('  Business Name:', vendor.businessName);
    console.log('  Tier:', vendor.tier);
    console.log('  Status:', vendor.status);
    console.log('  Tier 2 Submitted At:', vendor.tier2SubmittedAt);
    console.log('  Tier 2 Approved At:', vendor.tier2ApprovedAt);
    console.log('  Tier 2 Approved By:', vendor.tier2ApprovedBy);
    console.log('  Tier 2 Expires At:', vendor.tier2ExpiresAt);
    console.log('  Tier 2 Rejection Reason:', vendor.tier2RejectionReason);

    // Check bidding limits
    console.log('\n💰 Bidding Limits:');
    if (vendor.tier === 'tier0') {
      console.log('  Tier 0: ₦0 (No bidding allowed)');
    } else if (vendor.tier === 'tier1_bvn') {
      console.log('  Tier 1: ₦500,000 (BVN verified)');
    } else if (vendor.tier === 'tier2_full') {
      console.log('  Tier 2: Unlimited (Full business KYC)');
    }

    // Check Tier 2 fields
    if (vendor.tier === 'tier2_full') {
      console.log('\n📋 Tier 2 Business Details:');
      console.log('  Business Type:', vendor.businessType || 'N/A');
      console.log('  Address:', vendor.address || 'N/A');
      console.log('  City:', vendor.city || 'N/A');
      console.log('  State:', vendor.state || 'N/A');
      console.log('  CAC Number:', vendor.cacNumber || 'N/A');
      console.log('  TIN:', vendor.tin || 'N/A');
      console.log('  Bank Name:', vendor.bankName || 'N/A');
      console.log('  Bank Account Number:', vendor.bankAccountNumber || 'N/A');
      console.log('  Bank Account Name:', vendor.bankAccountName || 'N/A');
    }

    // Simulate Profile API response
    console.log('\n📡 Profile API Response (simulated):');
    const profileResponse = {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        status: user.status,
        createdAt: user.createdAt,
      },
      vendor: {
        businessName: vendor.businessName,
        businessType: vendor.businessType,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        cacNumber: vendor.cacNumber,
        tin: vendor.tin,
        bankAccountNumber: vendor.bankAccountNumber,
        bankAccountName: vendor.bankAccountName,
        bankName: vendor.bankName,
        tier: vendor.tier,
        status: vendor.status,
        tier2ApprovedAt: vendor.tier2ApprovedAt,
        tier2ExpiresAt: vendor.tier2ExpiresAt,
      },
    };
    console.log(JSON.stringify(profileResponse, null, 2));

    // Check for potential issues
    console.log('\n🔍 Potential Issues:');
    const issues: string[] = [];

    if (vendor.tier !== 'tier2_full') {
      issues.push(`❌ Tier is not tier2_full (current: ${vendor.tier})`);
    }

    if (vendor.status !== 'approved') {
      issues.push(`❌ Status is not approved (current: ${vendor.status})`);
    }

    if (!vendor.tier2ApprovedAt) {
      issues.push('❌ Tier 2 approval timestamp is missing');
    }

    if (!vendor.tier2ExpiresAt) {
      issues.push('❌ Tier 2 expiry timestamp is missing');
    }

    if (vendor.tier === 'tier2_full' && !vendor.businessType) {
      issues.push('⚠️  Business type is missing (Tier 2 field)');
    }

    if (vendor.tier === 'tier2_full' && !vendor.address) {
      issues.push('⚠️  Address is missing (Tier 2 field)');
    }

    if (issues.length === 0) {
      console.log('✅ No issues found - vendor is properly configured as Tier 2');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

  } catch (error) {
    console.error('❌ Error diagnosing vendor:', error);
  }
}

diagnoseVendorTierAndProfile()
  .then(() => {
    console.log('\n✅ Diagnosis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });
