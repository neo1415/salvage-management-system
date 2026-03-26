import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';

/**
 * GET /api/kyc/status
 * Returns current Tier 2 KYC status for the authenticated vendor.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  const repo = getKYCRepository();
  const status = await repo.getVerificationStatus(vendor.id);

  if (!status) {
    return NextResponse.json({ status: 'not_started', tier: 'tier1_bvn', steps: {} });
  }

  return NextResponse.json(status);
}
