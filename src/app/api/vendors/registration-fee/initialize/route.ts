import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { registrationFeeService } from '@/features/vendors/services/registration-fee.service';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  isOnboardingPolicyEnforced,
  logPolicyDecision,
  resolveRegistrationFeePaymentAccess,
} from '@/features/business-policy';
import { AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/vendors/registration-fee/initialize
 * 
 * Initialize registration fee payment with Paystack
 * Called after Tier 1 KYC (BVN verification) is complete
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
    const userEmail = session.user.email;
    const userName = session.user.name || 'Vendor';

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // 2. Get vendor record
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    const policy = await businessPolicyService.getEffectivePolicy();
    const registrationFeeDecision = resolveRegistrationFeePaymentAccess(policy, {
      tier: vendor.tier === 'tier2_full' ? 'tier2_full' : vendor.tier === 'tier1_bvn' ? 'tier1_bvn' : 'tier0',
      bvnVerified: Boolean(vendor.bvnVerifiedAt),
      registrationFeePaid: Boolean(vendor.registrationFeePaid),
    });
    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logPolicyDecision({
      userId,
      entityType: AuditEntityType.PAYMENT,
      entityId: vendor.id,
      ipAddress,
      userAgent,
      deviceType: getDeviceTypeFromUserAgent(userAgent),
      decision: registrationFeeDecision.decision,
      context: {
        source: 'api/vendors/registration-fee/initialize',
        runtimeMode: getBusinessPolicyRuntimeMode(),
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit registration fee payment decision', {
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    const policyEnforcementEnabled = isOnboardingPolicyEnforced() || isBusinessPolicyEnforcementEnabled();

    if (!registrationFeeDecision.allowed && policyEnforcementEnabled) {
      const status = registrationFeeDecision.value === 'already_paid' ? 400 : 403;
      return NextResponse.json(
        {
          error: 'Registration fee payment unavailable',
          message: registrationFeeDecision.message,
          reason: registrationFeeDecision.value,
        },
        { status }
      );
    }

    if (vendor.registrationFeePaid) {
      return NextResponse.json(
        { 
          error: 'Registration fee already paid',
          message: 'You have already paid the registration fee.',
          data: {
            paid: true,
            amount: vendor.registrationFeeAmount ? parseFloat(vendor.registrationFeeAmount) : null,
            paidAt: vendor.registrationFeePaidAt,
            reference: vendor.registrationFeeReference,
          },
        },
        { status: 400 }
      );
    }

    // 5. Initialize payment
    const result = await registrationFeeService.initializeRegistrationFeePayment({
      vendorId: vendor.id,
      userEmail,
      userName,
    });

    // 6. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          paymentId: result.paymentId,
          authorizationUrl: result.authorizationUrl,
          accessCode: result.accessCode,
          amount: result.amount,
          reference: result.reference,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Registration fee initialization error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to initialize payment',
      },
      { status: 500 }
    );
  }
}
