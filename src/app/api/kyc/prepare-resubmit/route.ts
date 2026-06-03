import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { prepareVendorTier2Resubmission } from '@/features/kyc/services/kyc-testing-reset.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kyc/prepare-resubmit
 * Clears manager rejection and stale Tier 2 workflow pointers so the vendor can resubmit immediately.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  await prepareVendorTier2Resubmission(vendor.id);

  return NextResponse.json({
    success: true,
    message: 'You can start verification again now.',
  });
}
