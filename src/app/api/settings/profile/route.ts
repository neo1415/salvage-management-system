import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { MFA_LOGIN_ENFORCED, normalizeMfaChannel } from '@/lib/settings/mfa';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { hasProviderVerificationStorage } from '@/features/kyc/services/provider-verification-readiness';
import { buildDojahEvidenceSections } from '@/features/kyc/utils/provider-evidence-display';

/**
 * GET /api/settings/profile — all authenticated dashboard roles
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        dateOfBirth: users.dateOfBirth,
        status: users.status,
        createdAt: users.createdAt,
        mfaEnabled: users.mfaEnabled,
        mfaChannel: users.mfaChannel,
        mfaPhone: users.mfaPhone,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let vendor = null;
    if (user.role === 'vendor') {
      const [row] = await db
        .select({
          id: vendors.id,
          businessName: vendors.businessName,
          businessType: vendors.businessType,
          cacNumber: vendors.cacNumber,
          tin: vendors.tin,
          tier: vendors.tier,
          status: vendors.status,
          bankAccountNumber: vendors.bankAccountNumber,
          bankAccountName: vendors.bankAccountName,
          bankName: vendors.bankName,
          bvnVerifiedAt: vendors.bvnVerifiedAt,
          ninVerified: vendors.ninVerified,
          bankAccountVerified: vendors.bankAccountVerified,
          addressVerifiedAt: vendors.addressVerifiedAt,
          amlRiskLevel: vendors.amlRiskLevel,
          fraudRiskScore: vendors.fraudRiskScore,
          registrationFeePaid: vendors.registrationFeePaid,
          registrationFeePaidAt: vendors.registrationFeePaidAt,
          tier2SubmittedAt: vendors.tier2SubmittedAt,
          tier2ApprovedAt: vendors.tier2ApprovedAt,
          tier2RejectionReason: vendors.tier2RejectionReason,
          tier2ExpiresAt: vendors.tier2ExpiresAt,
          tier2DojahReferenceId: vendors.tier2DojahReferenceId,
        })
        .from(vendors)
        .where(eq(vendors.userId, session.user.id))
        .limit(1);

      if (row) {
        let latestProviderEvidence = null;
        const providerStorageReady = await hasProviderVerificationStorage().catch(() => false);

        if (providerStorageReady) {
          const [providerRecord] = await db
            .select()
            .from(providerVerificationRecords)
            .where(
              and(
                eq(providerVerificationRecords.vendorId, row.id),
                eq(providerVerificationRecords.provider, 'dojah'),
                eq(providerVerificationRecords.verificationType, 'tier2')
              )
            )
            .orderBy(desc(providerVerificationRecords.updatedAt))
            .limit(1);

          if (providerRecord) {
            latestProviderEvidence = {
              provider: providerRecord.provider,
              providerReference: providerRecord.providerReference,
              workflowReference: providerRecord.workflowReference,
              status: providerRecord.status,
              riskLevel: providerRecord.riskLevel,
              checksCompleted: providerRecord.checksCompleted ?? [],
              pendingChecks: providerRecord.pendingChecks ?? [],
              failedChecks: providerRecord.failedChecks ?? [],
              reasonCodes: providerRecord.reasonCodes ?? [],
              displayMessage: providerRecord.displayMessage,
              updatedAt: providerRecord.updatedAt,
              sections: buildDojahEvidenceSections(
                providerRecord.normalizedResult,
                {
                  provider: providerRecord.provider,
                  providerReference: providerRecord.providerReference,
                  workflowReference: providerRecord.workflowReference,
                  status: providerRecord.status,
                  riskLevel: providerRecord.riskLevel,
                  displayMessage: providerRecord.displayMessage,
                  updatedAt: providerRecord.updatedAt,
                  checksCompleted: providerRecord.checksCompleted ?? [],
                  pendingChecks: providerRecord.pendingChecks ?? [],
                  failedChecks: providerRecord.failedChecks ?? [],
                  reasonCodes: providerRecord.reasonCodes ?? [],
                }
              ),
            };
          }
        }

        const tier2ReviewStatus = row.tier2ApprovedAt
          ? 'approved'
          : row.tier2RejectionReason
            ? 'rejected'
            : row.tier2SubmittedAt || latestProviderEvidence
              ? 'pending_review'
              : 'not_submitted';

        vendor = {
          ...row,
          tier2ReviewStatus,
          latestProviderEvidence,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        dateOfBirth: user.dateOfBirth,
        status: user.status,
        createdAt: user.createdAt,
      },
      vendor,
      security: {
        mfaEnabled: user.mfaEnabled,
        mfaChannel: normalizeMfaChannel(user.mfaChannel),
        mfaPhone: user.mfaPhone,
        loginMfaEnforced: MFA_LOGIN_ENFORCED,
      },
    });
  } catch (error) {
    console.error('GET /api/settings/profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
