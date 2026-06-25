import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { escrowService } from '@/features/payments/services/escrow.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveAuctionPaymentMethodAccess,
  validateWalletFundingAmount,
} from '@/features/business-policy';
import { AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/payments/wallet/fund
 * Initiate wallet funding via Paystack
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor ID from user
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const policy = await businessPolicyService.getEffectivePolicy();
    const walletFundingDecision = resolveAuctionPaymentMethodAccess(policy, 'wallet_funding');
    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logPolicyDecision({
      userId: session.user.id,
      entityType: AuditEntityType.PAYMENT,
      entityId: vendor.id,
      ipAddress,
      userAgent,
      deviceType: getDeviceTypeFromUserAgent(userAgent),
      decision: walletFundingDecision.decision,
      context: {
        source: 'api/payments/wallet/fund',
        runtimeMode: getBusinessPolicyRuntimeMode(),
        vendorId: vendor.id,
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit wallet funding decision', {
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    if (!walletFundingDecision.allowed && isBusinessPolicyEnforcementEnabled()) {
      return NextResponse.json(
        { error: 'Wallet funding is not enabled for this deployment.' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `wallet-fund:${vendor.id}`,
      limit: 8,
      window: 60,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many wallet funding attempts. Please wait and try again.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const fundingValidation = validateWalletFundingAmount(policy, amount);
    await logPolicyDecision({
      userId: session.user.id,
      entityType: AuditEntityType.PAYMENT,
      entityId: vendor.id,
      ipAddress,
      userAgent,
      deviceType: getDeviceTypeFromUserAgent(userAgent),
      decision: fundingValidation.decision,
      context: {
        source: 'api/payments/wallet/fund',
        runtimeMode: getBusinessPolicyRuntimeMode(),
        vendorId: vendor.id,
        amount,
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit wallet funding amount decision', {
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    if (!fundingValidation.allowed) {
      return NextResponse.json(
        { error: fundingValidation.message },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Initiate wallet funding
    const result = await escrowService.fundWallet(vendor.id, amount, session.user.id);

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error funding wallet:', error);
    
    // Return specific error message if available
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initiate wallet funding' },
      { status: 500 }
    );
  }
}
