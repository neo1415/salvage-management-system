import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { and, desc, eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getKYCAuditService } from '@/features/kyc/services/audit.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { logAction, createAuditLogData, AuditActionType, AuditEntityType } from '@/lib/utils/audit-logger';

/**
 * POST /api/kyc/approvals/[id]/decision
 * Salvage Manager approves or rejects a Tier 2 KYC application.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager') {
    return NextResponse.json({ error: 'Access denied. Salvage Manager role required.' }, { status: 403 });
  }

  const { id: vendorId } = await params;
  const body = await request.json();
  const { decision, reason, rejectedSections = [] } = body as {
    decision: 'approve' | 'reject';
    reason?: string;
    rejectedSections?: string[];
  };
  const cleanRejectedSections = Array.isArray(rejectedSections)
    ? rejectedSections
        .map((section) => String(section).trim())
        .filter(Boolean)
    : [];

  if (!decision || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  if (decision === 'reject' && !reason?.trim()) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
  }

  if (decision === 'reject' && cleanRejectedSections.length === 0) {
    return NextResponse.json({ error: 'Select at least one rejected KYC section' }, { status: 400 });
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
    rejectedSections: cleanRejectedSections,
    decidedAt: now,
  });

  const [providerRecord] = await db
    .select()
    .from(providerVerificationRecords)
    .where(
      and(
        eq(providerVerificationRecords.vendorId, vendorId),
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.verificationType, 'tier2')
      )
    )
    .orderBy(desc(providerVerificationRecords.updatedAt))
    .limit(1);

  if (providerRecord) {
    const normalizedResult = {
      ...((providerRecord.normalizedResult as Record<string, unknown> | null) ?? {}),
      managerDecision: {
        decision,
        reason: reason?.trim() ?? null,
        rejectedSections: cleanRejectedSections,
        reviewedBy: session.user.id,
        reviewedAt: now.toISOString(),
        providerReference: providerRecord.providerReference,
      },
      auditTimeline: [
        ...(((providerRecord.normalizedResult as Record<string, unknown> | null)?.auditTimeline as unknown[]) ?? []),
        {
          event: decision === 'approve' ? 'approved' : 'rejected',
          actorId: session.user.id,
          timestamp: now.toISOString(),
        },
      ],
    };

    await db
      .update(providerVerificationRecords)
      .set({
        status: decision === 'approve' ? 'passed' : 'failed',
        reviewedBy: session.user.id,
        reviewedAt: now,
        finalDecision: decision,
        decisionReason: reason?.trim() ?? null,
        normalizedResult,
        displayMessage: decision === 'approve'
          ? 'Tier 2 verification approved by manager.'
          : 'Tier 2 verification rejected by manager.',
        updatedAt: now,
      })
      .where(eq(providerVerificationRecords.id, providerRecord.id));
  }

  await audit.logManagerDecision(vendorId, session.user.id, decision, reason);
  await logAction(
    createAuditLogData(
      request,
      session.user.id,
      decision === 'approve'
        ? AuditActionType.VENDOR_APPROVED_AFTER_VERIFICATION
        : AuditActionType.VENDOR_REJECTED_AFTER_VERIFICATION,
      AuditEntityType.KYC,
      vendorId,
      undefined,
      { decision, reason, rejectedSections: cleanRejectedSections }
    )
  );
  await logAction(
    createAuditLogData(
      request,
      session.user.id,
      decision === 'approve'
        ? AuditActionType.VENDOR_TIER2_APPROVED
        : AuditActionType.VENDOR_TIER2_REJECTED,
      AuditEntityType.KYC,
      vendorId,
      undefined,
      { decision, reason, rejectedSections: cleanRejectedSections, source: 'manager_review' }
    )
  );
  await logAction(
    createAuditLogData(
      request,
      session.user.id,
      decision === 'approve'
        ? AuditActionType.PROVIDER_VERIFICATION_APPROVED
        : AuditActionType.PROVIDER_VERIFICATION_REJECTED,
      AuditEntityType.KYC,
      providerRecord?.id ?? vendorId,
      undefined,
      {
        vendorId,
        providerReference: providerRecord?.providerReference,
        rejectedSections: cleanRejectedSections,
      }
    )
  );
  if (decision === 'approve') {
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.VENDOR_STATUS_UPDATED,
        AuditEntityType.VENDOR,
        vendorId,
        undefined,
        { tier: 'tier2_full', status: 'approved', source: 'tier2_manager_review' }
      )
    );
  }

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
      const emailResult = await notify.sendManagerApprovalNotification(target);
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          emailResult.emailSent ? AuditActionType.APPROVAL_EMAIL_SENT : AuditActionType.APPROVAL_EMAIL_FAILED,
          AuditEntityType.KYC,
          vendorId,
          undefined,
          { email: vendorUser.email, error: emailResult.emailError }
        )
      );
    } else {
      const emailResult = await notify.sendKYCRejectionNotification(
        target,
        reason ?? 'Application rejected',
        cleanRejectedSections
      );
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          emailResult.emailSent ? AuditActionType.REJECTION_EMAIL_SENT : AuditActionType.REJECTION_EMAIL_FAILED,
          AuditEntityType.KYC,
          vendorId,
          undefined,
          { email: vendorUser.email, rejectedSections: cleanRejectedSections, error: emailResult.emailError }
        )
      );
    }
  }

  return NextResponse.json({
    success: true,
    decision,
    message: decision === 'approve' ? 'Vendor upgraded to Tier 2' : 'Application rejected',
  });
}
