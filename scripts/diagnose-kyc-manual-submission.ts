import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vendors } from '../src/lib/db/schema/vendors';
import { users } from '../src/lib/db/schema/users';
import { eq, isNotNull, sql, and } from 'drizzle-orm';

/**
 * Diagnostic script for KYC manual submission issues
 * 
 * This script checks:
 * 1. Vendors with tier2SubmittedAt but no tier2ApprovedAt (should be pending)
 * 2. Document URLs stored in the database
 * 3. Vendor status vs tier2 approval status
 */

async function diagnoseKYCSubmissions() {
  console.log('🔍 Diagnosing KYC Manual Submissions...\n');

  try {
    // Get all vendors with Tier 2 submissions
    const pendingVendors = await db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        tier: vendors.tier,
        status: vendors.status,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
        cacCertificateUrl: vendors.cacCertificateUrl,
        ninCardUrl: vendors.ninCardUrl,
        addressProofUrl: vendors.addressProofUrl,
        bankStatementUrl: vendors.bankStatementUrl,
        photoIdUrl: vendors.photoIdUrl,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(
        and(
          isNotNull(vendors.tier2SubmittedAt),
          sql`${vendors.tier2ApprovedAt} IS NULL`,
          sql`${vendors.tier2RejectionReason} IS NULL`
        )
      )
      .orderBy(vendors.tier2SubmittedAt);

    console.log(`📊 Found ${pendingVendors.length} pending Tier 2 KYC submissions\n`);

    if (pendingVendors.length === 0) {
      console.log('✅ No pending submissions found');
      return;
    }

    for (const vendor of pendingVendors) {
      console.log('─'.repeat(80));
      console.log(`\n📋 Vendor: ${vendor.businessName}`);
      console.log(`   ID: ${vendor.vendorId}`);
      console.log(`   Email: ${vendor.userEmail}`);
      console.log(`   Phone: ${vendor.userPhone}`);
      console.log(`\n📊 Status Information:`);
      console.log(`   Tier: ${vendor.tier}`);
      console.log(`   Status: ${vendor.status}`);
      console.log(`   Submitted At: ${vendor.tier2SubmittedAt}`);
      console.log(`   Approved At: ${vendor.tier2ApprovedAt || 'NOT APPROVED'}`);
      console.log(`   Rejection Reason: ${vendor.tier2RejectionReason || 'NONE'}`);

      console.log(`\n📄 Document URLs:`);
      console.log(`   CAC Certificate: ${vendor.cacCertificateUrl || 'NOT PROVIDED'}`);
      console.log(`   NIN Card: ${vendor.ninCardUrl || 'MISSING'}`);
      console.log(`   Address Proof: ${vendor.addressProofUrl || 'MISSING'}`);
      console.log(`   Bank Statement: ${vendor.bankStatementUrl || 'MISSING'}`);
      console.log(`   Photo ID: ${vendor.photoIdUrl || 'MISSING'}`);

      // Count documents
      const documentCount = [
        vendor.cacCertificateUrl,
        vendor.ninCardUrl,
        vendor.addressProofUrl,
        vendor.bankStatementUrl,
        vendor.photoIdUrl,
      ].filter(Boolean).length;

      console.log(`\n📊 Document Count: ${documentCount}/5`);

      // Check for issues
      const issues: string[] = [];
      
      if (vendor.tier === 'tier2_full' && !vendor.tier2ApprovedAt) {
        issues.push('⚠️  Tier is tier2_full but tier2ApprovedAt is NULL (should be pending)');
      }
      
      if (vendor.status === 'approved' && !vendor.tier2ApprovedAt) {
        issues.push('⚠️  Status is "approved" but Tier 2 is not approved (confusing for managers)');
      }

      if (documentCount < 4) {
        issues.push(`⚠️  Only ${documentCount} documents uploaded (expected at least 4)`);
      }

      if (issues.length > 0) {
        console.log(`\n🚨 Issues Found:`);
        issues.forEach(issue => console.log(`   ${issue}`));
      } else {
        console.log(`\n✅ No issues found`);
      }

      console.log('\n');
    }

    console.log('─'.repeat(80));
    console.log('\n✅ Diagnosis complete\n');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

diagnoseKYCSubmissions();
