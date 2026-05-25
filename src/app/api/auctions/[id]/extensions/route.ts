/**
 * Grace Extension API Route
 * Allows Finance Officers to grant deadline extensions
 * 
 * Requirements:
 * - Requirement 7: Grace Period Extension by Finance Officer
 * 
 * SECURITY: Role-based access control (Finance Officer only)
 * AUDIT: Complete audit trail with reason and officer ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import * as extensionService from '@/features/auction-deposit/services/extension.service';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  logPolicyDecision,
  resolveGraceExtensionDurationHours,
  resolveGraceExtensionLimit,
} from '@/features/business-policy';
import { AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

/**
 * POST /api/auctions/[id]/extensions
 * Grant grace extension for document signing or payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is Finance Officer
    const authorizedRoles = ['finance_officer', 'salvage_manager', 'system_admin'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - Finance Officer role required' 
        },
        { status: 403 }
      );
    }

    // Verify auction exists
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason for extension is required' },
        { status: 400 }
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Reason must be 500 characters or less' },
        { status: 400 }
      );
    }

    if (!auction.currentBidder) {
      return NextResponse.json(
        { success: false, error: 'Auction has no winning vendor to extend' },
        { status: 400 }
      );
    }

    // Grant extension for the winning vendor, granted by the finance officer/admin.
    const result = await extensionService.grantExtension(
      auctionId,
      auction.currentBidder,
      session.user.id,
      reason.trim()
    );

    const policy = await businessPolicyService.getEffectivePolicy();
    const currentExtensionCount = result.extensionCount !== undefined
      ? Math.max(result.extensionCount - (result.success ? 1 : 0), 0)
      : 0;
    const limitDecision = resolveGraceExtensionLimit(policy, currentExtensionCount);
    const durationDecision = resolveGraceExtensionDurationHours(policy);

    await logPolicyDecision({
      userId: session.user.id,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      deviceType: DeviceType.DESKTOP,
      decision: {
        ...limitDecision.decision,
        entityId: auctionId,
      },
      context: {
        mode: getBusinessPolicyRuntimeMode(),
        surface: 'auction_extension_route',
        auctionId,
        vendorId: auction.currentBidder,
        legacyResultSuccess: result.success,
        legacyMaxExtensions: result.maxExtensions ?? null,
      },
    });

    await logPolicyDecision({
      userId: session.user.id,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      deviceType: DeviceType.DESKTOP,
      decision: {
        ...durationDecision.decision,
        entityId: auctionId,
      },
      context: {
        mode: getBusinessPolicyRuntimeMode(),
        surface: 'auction_extension_route',
        auctionId,
        vendorId: auction.currentBidder,
        legacyNewDeadline: result.newDeadline?.toISOString() ?? null,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newDeadline: result.newDeadline,
      extensionCount: result.extensionCount,
      maxExtensions: result.maxExtensions,
      canGrantMore: result.extensionCount < result.maxExtensions,
      message: `Extension granted. New deadline: ${result.newDeadline.toLocaleString()}`,
    });
  } catch (error) {
    console.error('Extension grant error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to grant extension. Please try again.'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auctions/[id]/extensions
 * Get extension history for an auction
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is authorized
    const authorizedRoles = ['finance_officer', 'salvage_manager', 'system_admin', 'vendor'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden' 
        },
        { status: 403 }
      );
    }

    // Get extension history
    const result = await extensionService.getExtensionHistory(auctionId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      extensions: result.extensions,
      count: result.extensions?.length || 0,
    });
  } catch (error) {
    console.error('Get extensions error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve extensions. Please try again.'
      },
      { status: 500 }
    );
  }
}
