import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getKYCAuditService } from '@/features/kyc/services/audit.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';

/**
 * POST /api/kyc/approvals/[id]/decision
 * Salvage Manager approves or rejects a Tier 2 KYC application.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied. Salvage Manager role required.' }, { status: 403 });
  }

  const vendorId = params.id;
  const body = await request.json();
  const { decision, reason } = body as { decision: 'approve' | 'reject'; reason?: string };

  if (!decision || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  if (decision === 'reject' && !reason?.trim()) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
  }

  // Verify vendor exists
  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  // Get vendor user details for notification
  const [vendorUser] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, vendor.userId))
    .limit(1);

  const repo = getKYCRepository();
  const audit = getKYCAuditService();
  const notify = getKYCNotificationService();

  const now = new Date();

  await repo.recordDecision(vendorId, {
    decision,
    managerId: session.user.id,
    reason,
    decidedAt: now,
  });

  await audit.logManagerDecision(vendorId, session.user.id, decision, reason);

  if (vendorUser) {
    const target = {
      vendorId,
      userId: vendorUser.id,
      phone: vendorUser.phone,
      email: vendorUser.email,
      fullName: vendorUser.fullName,
    };

    if (decision === 'approve') {
      await audit.logTierChange(vendorId, session.user.id, 'tier1_bvn', 'tier2_full', 'manager_approved');
      await notify.sendManagerApprovalNotification(target);
    } else {
      await notify.sendKYCRejectionNotification(target, reason ?? 'Application rejected');
    }
  }

  return NextResponse.json({
    success: true,
    decision,
    message: decision === 'approve' ? 'Vendor upgraded to Tier 2' : 'Application rejected',
  });
}
