import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/kyc/status
 * Returns the current KYC status for the authenticated vendor.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor record
    const [vendor] = await db
      .select({
        tier: vendors.tier,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2ExpiresAt: vendors.tier2ExpiresAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
      })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Determine status
    let status = 'not_started';
    
    // Check if Tier 2 is approved and active
    if (vendor.tier === 'tier2_full' && vendor.tier2ApprovedAt) {
      const now = new Date();
      status = vendor.tier2ExpiresAt && vendor.tier2ExpiresAt < now ? 'expired' : 'approved';
    } 
    // Check if rejected
    else if (vendor.tier2RejectionReason) {
      status = 'rejected';
    } 
    // Check if pending review (submitted but not yet approved or rejected)
    else if (vendor.tier2SubmittedAt && !vendor.tier2ApprovedAt && !vendor.tier2RejectionReason) {
      status = 'pending_review';
    }
    // Otherwise not started or in progress
    else if (vendor.tier2SubmittedAt) {
      status = 'in_progress';
    }

    return NextResponse.json({
      status,
      tier: vendor.tier,
      submittedAt: vendor.tier2SubmittedAt,
      approvedAt: vendor.tier2ApprovedAt,
      expiresAt: vendor.tier2ExpiresAt,
      rejectionReason: vendor.tier2RejectionReason,
    });
  } catch (error) {
    console.error('[KYC Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC status' },
      { status: 500 }
    );
  }
}
