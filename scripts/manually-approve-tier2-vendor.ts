import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Manual Tier 2 Vendor Approval Script
 * 
 * This script manually approves a Tier 2 vendor and sets all required fields.
 * Use this when the approval endpoint fails or needs to be re-run.
 * 
 * Run with: npx tsx scripts/manually-approve-tier2-vendor.ts
 */

async function approveVendor() {
  try {
    const vendorEmail = 'neowalker502@gmail.com';
    
    console.log(`🔍 Finding vendor with email: ${vendorEmail}...\n`);

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, vendorEmail))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);
    console.log('   Name:', user.fullName);
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
    console.log('   Current tier:', vendor.tier);
    console.log('   Current status:', vendor.status);
    console.log('   tier2SubmittedAt:', vendor.tier2SubmittedAt);
    console.log('   tier2ApprovedAt:', vendor.tier2ApprovedAt);
    console.log('');

    // Check if already approved
    if (vendor.tier === 'tier2_full' && vendor.tier2ApprovedAt) {
      console.log('✅ Vendor is already approved for Tier 2');
      console.log('   Approved at:', vendor.tier2ApprovedAt);
      console.log('   Expires at:', vendor.tier2ExpiresAt);
      return;
    }

    // Approve vendor
    console.log('📝 Approving vendor for Tier 2...\n');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    await db
      .update(vendors)
      .set({
        tier: 'tier2_full',
        status: 'approved',
        tier2ApprovedAt: now,
        tier2ApprovedBy: user.id, // Using user's own ID as approver for manual approval
        tier2ExpiresAt: expiresAt,
        tier2RejectionReason: null,
        updatedAt: now,
      })
      .where(eq(vendors.id, vendor.id));

    console.log('✅ Vendor approved successfully!');
    console.log('');
    console.log('📊 Updated State:');
    console.log('   Tier: tier2_full');
    console.log('   Status: approved');
    console.log('   tier2ApprovedAt:', now.toISOString());
    console.log('   tier2ExpiresAt:', expiresAt.toISOString());
    console.log('');
    console.log('🎉 Vendor can now:');
    console.log('   ✓ Bid unlimited amounts');
    console.log('   ✓ Access leaderboard');
    console.log('   ✓ Get priority support');
    console.log('');
    console.log('⚠️  Note: Bank account details are missing. The vendor should update them in their profile.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

approveVendor();
