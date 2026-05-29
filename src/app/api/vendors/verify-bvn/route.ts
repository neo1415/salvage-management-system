import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyBVN, encryptBVN } from '@/features/vendors/services/bvn-verification.service';
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import { appPath } from '@/features/notifications/templates/email-urls';
import { logAction, createAuditLogData, AuditActionType, AuditEntityType } from '@/lib/utils/audit-logger';
import { auth } from '@/lib/auth/next-auth.config';
import { normalizeDojahBVNResult } from '@/features/kyc/services/dojah-normalizer.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { resolveUserLegalNamesForBvn } from '@/lib/utils/person-name';
import { isKycTestingMode } from '@/lib/kyc/kyc-testing-mode';
import { sanitizeVerificationUserMessage } from '@/lib/kyc/kyc-user-messages';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';

/**
 * POST /api/vendors/verify-bvn
 *
 * Tier 1 KYC Verification API
 * Verifies vendor BVN and auto-approves to Tier 1 on successful match
 *
 * Requirements: 4, Enterprise Standards Section 6.1
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login to continue.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Parse and validate request body
    const body = await request.json();
    const { bvn } = body;

    console.log('[BVN Verification] Request received:', {
      userId,
      bvnMasked: bvn ? `***${bvn.slice(-4)}` : 'missing',
      bodyKeys: Object.keys(body),
    });

    // Validate BVN format (11 digits)
    if (!bvn || typeof bvn !== 'string') {
      console.log('[BVN Verification] Validation failed: BVN missing or invalid type');
      return NextResponse.json(
        { error: 'BVN is required' },
        { status: 400 }
      );
    }

    if (!/^\d{11}$/.test(bvn)) {
      console.log('[BVN Verification] Validation failed: Invalid BVN format');
      return NextResponse.json(
        { error: 'Invalid BVN format. BVN must be exactly 11 digits.' },
        { status: 400 }
      );
    }

    // 3. Get user details from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is a vendor
    if (user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Only vendors can complete BVN verification' },
        { status: 403 }
      );
    }

    // Check if user has date of birth
    if (!user.dateOfBirth) {
      return NextResponse.json(
        {
          error: 'Date of birth not found',
          message: 'Your account is missing date of birth information. Please contact support to update your profile.',
        },
        { status: 400 }
      );
    }

    // 4. Check if vendor record exists, create if not
    let [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      // Create vendor record
      const [newVendor] = await db
        .insert(vendors)
        .values({
          userId,
          tier: 'tier0',
          status: 'pending',
          categories: [],
          performanceStats: {
            totalBids: 0,
            totalWins: 0,
            winRate: 0,
            avgPaymentTimeHours: 0,
            onTimePickupRate: 0,
            fraudFlags: 0,
          },
          rating: '0.00',
        })
        .returning();

      vendor = newVendor;
    }

    // One BVN verification per vendor (unless KYC testing mode is enabled)
    if (vendor.bvnVerifiedAt && !isKycTestingMode()) {
      return NextResponse.json(
        {
          error: 'BVN already verified',
          message: 'Your BVN has already been verified. You are a Tier 1 vendor.',
        },
        { status: 400 }
      );
    }

    // 5. Log BVN verification initiation
    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.BVN_VERIFICATION_INITIATED,
        AuditEntityType.KYC,
        vendor.id,
        undefined,
        { bvn: `***${bvn.slice(-4)}` }
      )
    );
    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.DOJAH_BVN_VERIFICATION_STARTED,
        AuditEntityType.KYC,
        vendor.id,
        undefined,
        { provider: 'dojah', bvn: `***${bvn.slice(-4)}` }
      )
    );

    // 6. BVN match: legal name parts + DOB (Dojah) + phone (BVN lookup)
    const dateOfBirth = user.dateOfBirth.toISOString().split('T')[0];
    const { primary, alternateAttempts } = resolveUserLegalNamesForBvn({
      fullName: user.fullName,
    });

    const runVerify = (parts: {
      firstName: string;
      lastName: string;
      middleName?: string;
    }) =>
      verifyBVN({
        bvn,
        firstName: parts.firstName,
        middleName: parts.middleName,
        lastName: parts.lastName,
        dateOfBirth,
        phone: user.phone,
      });

    let verificationResult = await runVerify(primary);

    for (const attempt of alternateAttempts) {
      if (verificationResult.verified) break;
      console.log('[BVN Verification] Retrying alternate name order:', attempt);
      const retry = await runVerify(attempt);
      if (retry.verified || (retry.matchScore ?? 0) > (verificationResult.matchScore ?? 0)) {
        verificationResult = retry;
      }
    }

    console.log('[BVN Verification] Final service response:', {
      bvnMasked: `***${bvn.slice(-4)}`,
      dateOfBirth,
      verified: verificationResult.verified,
    });

    console.log('[BVN Verification] Service response:', {
      success: verificationResult.success,
      verified: verificationResult.verified,
      matchScore: verificationResult.matchScore,
      error: verificationResult.error,
    });

    if (verificationResult.provider === 'dojah' && verificationResult.providerReference) {
      const raw = verificationResult.providerRawResponse as Parameters<typeof normalizeDojahBVNResult>[0];
      const normalized = normalizeDojahBVNResult(raw, verificationResult.providerReference);
      await getProviderVerificationService().persistVerification({
        userId,
        vendorId: vendor.id,
        actorId: userId,
        result: normalized,
        rawPayload: verificationResult.providerRawResponse,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown',
      });
    }

    // 7. Handle verification failure
    if (!verificationResult.success) {
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.DOJAH_BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          { error: verificationResult.error, provider: 'dojah' }
        )
      );
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          {
            error: verificationResult.error,
            bvn: `***${bvn.slice(-4)}`,
          }
        )
      );

      return NextResponse.json(
        {
          error: 'identity_verification_failed',
          message:
            'Our identity verification partner could not complete this BVN check right now. Please try again in a few minutes.',
          detail: sanitizeVerificationUserMessage(verificationResult.error) || undefined,
          errorSource: 'identity_provider',
        },
        { status: 400 }
      );
    }

    // 8. Handle verification mismatch
    if (!verificationResult.verified) {
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.DOJAH_BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          {
            matchScore: verificationResult.matchScore,
            mismatches: verificationResult.mismatches,
            provider: 'dojah',
          }
        )
      );
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          {
            matchScore: verificationResult.matchScore,
            mismatches: verificationResult.mismatches,
            bvn: `***${bvn.slice(-4)}`,
          }
        )
      );

      return NextResponse.json(
        {
          error: 'BVN details do not match',
          message:
            'The name, date of birth, or phone number on your account does not match this BVN. Use the same first name, middle name (if any), surname, date of birth, and BVN-linked phone as on your bank records.',
          matchScore: verificationResult.matchScore,
          mismatches: verificationResult.mismatches,
          errorSource: 'app',
        },
        { status: 400 }
      );
    }

    // 9. Encrypt and store BVN
    const encryptedBVN = encryptBVN(bvn);

    // 10. Update vendor record - Auto-approve to Tier 1
    await db
      .update(vendors)
      .set({
        bvnEncrypted: encryptedBVN,
        bvnVerifiedAt: new Date(),
        tier: 'tier1_bvn',
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendor.id));

    // 11. Update user status to verified_tier_1
    await db
      .update(users)
      .set({
        status: 'verified_tier_1',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 12. CRITICAL: Invalidate Redis cache to force session refresh
    // The JWT callback caches user data in Redis for 30 minutes
    // We must clear this cache so the next request gets fresh data with bvnVerified=true
    const { redis } = await import('@/lib/redis/client');
    const userCacheKey = `user:${userId}`;

    try {
      await redis.del(userCacheKey);
      console.log('[BVN Verification] Cleared user cache:', userCacheKey);
    } catch (cacheError) {
      console.error('[BVN Verification] Failed to clear user cache (non-fatal):', cacheError);
      // Continue - this is non-fatal, session will refresh eventually
    }

    // 13. Log successful verification
    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.DOJAH_BVN_VERIFICATION_PASSED,
        AuditEntityType.KYC,
        vendor.id,
        undefined,
        {
          provider: 'dojah',
          providerReference: verificationResult.providerReference,
          matchScore: verificationResult.matchScore,
        }
      )
    );

    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.BVN_VERIFICATION_SUCCESSFUL,
        AuditEntityType.KYC,
        vendor.id,
        { tier: vendor.tier, status: vendor.status },
        {
          tier: 'tier1_bvn',
          status: 'approved',
          bvn: `***${bvn.slice(-4)}`,
          matchScore: verificationResult.matchScore,
        }
      )
    );

    // 13. Send SMS notification
    const smsResult = await smsService.sendTier1ApprovalSMS(user.phone, user.fullName);
    if (!smsResult.success) {
      console.error('Failed to send Tier 1 approval SMS:', smsResult.error);
    }

    // 14. Send email notification
    const emailResult = await emailService.sendEmail({
      to: user.email,
      subject: 'Congratulations! Tier 1 Verification Complete',
      html: await getTier1ApprovalEmailTemplate(user.fullName),
    });
    if (!emailResult.success) {
      console.error('Failed to send Tier 1 approval email:', emailResult.error);
    }

    const effectivePolicy = await businessPolicyService.getEffectivePolicy();
    const maxBidAmount = effectivePolicy.onboarding.tier1BidLimit;

    // 15. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Congratulations! Your identity verification is complete. You can now bid within your current verification limits.',
        data: {
          tier: 'tier1_bvn',
          status: 'approved',
          bvnVerified: true,
          maxBidAmount,
        },
        // Signal to client to refresh session
        refreshSession: true,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('BVN verification API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * Get Tier 1 approval email template
 */
async function getTier1ApprovalEmailTemplate(fullName: string): Promise<string> {
  const branding = await getEmailBranding();
  const supportEmail = getSupportEmail(branding);
  const supportPhone = getSupportPhone(branding);

  return wrapProfessionalEmail(
    'Tier 1 Verification Complete',
    `
      <p><strong>Dear ${escapeHtml(fullName)},</strong></p>
      <p>Your Tier 1 KYC verification is complete. Your identity has been verified and you are approved for eligible bidding.</p>
      <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.accentColor}; padding: 18px 20px; margin: 24px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: ${branding.primaryColor};">What You Can Do Now</h3>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>Browse auctions:</strong> View available salvage items.</li>
          <li><strong>Place eligible bids:</strong> Bid within your current verification limits.</li>
          <li><strong>Complete full verification:</strong> Add business verification for higher-value auctions.</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${appPath('/vendor/auctions')}" class="button" style="display: inline-block; padding: 14px 28px; background-color: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Auctions</a>
      </div>
      <div style="background-color: #fff8e1; border: 1px solid ${branding.accentColor}; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: ${branding.primaryColor};">Want to bid higher?</h3>
        <p>Complete full verification to unlock higher bidding access and business verification benefits.</p>
        <p><a href="${appPath('/vendor/kyc/tier2')}" style="color: ${branding.primaryColor}; font-weight: 600;">Continue Verification</a></p>
      </div>
      <p style="margin-top: 30px;">Best regards,<br><strong style="color: ${branding.primaryColor};">${brandTeamName(branding)}</strong></p>
      <p style="font-size: 13px; color: #666;">Need help? ${supportPhone} | ${supportEmail}</p>
    `,
    `Your ${branding.brandName} Tier 1 verification is complete.`
  );
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
