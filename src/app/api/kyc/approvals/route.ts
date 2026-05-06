import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';

/**
 * GET /api/kyc/approvals
 * Returns all pending Tier 2 KYC applications for Salvage Manager review.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied. Salvage Manager role required.' }, { status: 403 });
  }

  const repo = getKYCRepository();
  const approvals = await repo.getPendingApprovals();

  console.log('[KYC Approvals API] Fetched approvals:', {
    count: approvals.length,
    approvals: approvals.map(a => ({
      vendorId: a.vendorId,
      vendorName: a.vendorName,
      vendorEmail: a.vendorEmail,
      submittedAt: a.submittedAt,
    })),
  });

  return NextResponse.json(
    { approvals, total: approvals.length },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
      },
    }
  );
}

// Disable Next.js static optimization for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
