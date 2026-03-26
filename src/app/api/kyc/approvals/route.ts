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

  return NextResponse.json({ approvals, total: approvals.length });
}
