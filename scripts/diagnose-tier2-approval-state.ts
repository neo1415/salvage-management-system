import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Diagnostic script to check Tier 2 KYC approval state
 * Run with: npx tsx scripts/diagnose-tier2-approval-state.ts
 */

async function diagnose() {
  try {
    console.log('🔍 Checking vendor state for neowalker502@gmail.com...\n');

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);
    console.log('   Name:', user.fullName);
    console.log('   Email:', user.email);
    console.log('   Phone:', user.phone);
    console.log('');

    // Find vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ Vendor not found');
      return;
    }

    console.log('✅ Vendor found:', vendor.id);
    console.log('');
    console.log('📊 Current State:');
    console.log('   Business Name:', vendor.businessName);
    console.log('   Tier:', vendor.tier);
    console.log('   Status:', vendor.status);
    console.log('');
    console.log('📅 Tier 2 KYC Timestamps:');
    console.log('   tier2SubmittedAt:', vendor.tier2SubmittedAt);
    console.log('   tier2ApprovedAt:', vendor.tier2ApprovedAt);
    console.log('   tier2ApprovedBy:', vendor.tier2ApprovedBy);
    console.log('   tier2ExpiresAt:', vendor.tier2ExpiresAt);
    console.log('   tier2RejectionReason:', vendor.tier2RejectionReason);
    console.log('');
    console.log('🏦 Bank Account Details:');
    console.log('   bankName:', vendor.bankName);
    console.log('   bankAccountName:', vendor.bankAccountName);
    console.log('   bankAccountNumber:', vendor.bankAccountNumber);
    console.log('');
    console.log('📝 Business Details:');
    console.log('   businessType:', vendor.businessType);
    console.log('   cacNumber:', vendor.cacNumber);
    console.log('   tin:', vendor.tin);
    console.log('');
    console.log('🔐 Verification Data:');
    console.log('   ninEncrypted:', vendor.ninEncrypted ? 'Yes (encrypted)' : 'No');
    console.log('   bvnEncrypted:', vendor.bvnEncrypted ? 'Yes (encrypted)' : 'No');
    console.log('   ninVerified:', vendor.ninVerified);
    console.log('   bvnVerifiedAt:', vendor.bvnVerifiedAt);
    console.log('');
    console.log('💰 Registration Fee:');
    console.log('   registrationFeePaid:', vendor.registrationFeePaid);
    console.log('   registrationFeeAmount:', vendor.registrationFeeAmount);
    console.log('   registrationFeePaidAt:', vendor.registrationFeePaidAt);
    console.log('');

    // Determine what the KYC status API would return
    let kycStatus = 'not_started';
    if (vendor.tier === 'tier2_full' && vendor.tier2ApprovedAt) {
      const now = new Date();
      kycStatus = vendor.tier2ExpiresAt && vendor.tier2ExpiresAt < now ? 'expired' : 'approved';
    } else if (vendor.tier2RejectionReason) {
      kycStatus = 'rejected';
    } else if (vendor.tier2SubmittedAt && !vendor.tier2ApprovedAt && !vendor.tier2RejectionReason) {
      kycStatus = 'pending_review';
    } else if (vendor.tier2SubmittedAt) {
      kycStatus = 'in_progress';
    }

    console.log('🎯 Expected KYC Status API Response:', kycStatus);
    console.log('');

    // Check if there are any issues
    const issues = [];
    
    if (vendor.tier2ApprovedAt && vendor.tier !== 'tier2_full') {
      issues.push('❌ ISSUE: tier2ApprovedAt is set but tier is not tier2_full');
    }
    
    if (vendor.tier === 'tier2_full' && !vendor.tier2ApprovedAt) {
      issues.push('❌ ISSUE: tier is tier2_full but tier2ApprovedAt is not set');
    }
    
    if (vendor.tier2SubmittedAt && !vendor.bankName) {
      issues.push('⚠️  WARNING: Tier 2 submitted but no bank account details');
    }
    
    if (vendor.tier === 'tier2_full' && !vendor.tier2ExpiresAt) {
      issues.push('⚠️  WARNING: Tier 2 approved but no expiry date set');
    }

    if (issues.length > 0) {
      console.log('🚨 Issues Found:');
      issues.forEach(issue => console.log('   ' + issue));
      console.log('');
    } else {
      console.log('✅ No issues found - vendor state looks correct');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

diagnose();
