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

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    if (!result.newDeadline) {
      return NextResponse.json(
        {
          success: false,
          error: 'Extension was granted but no new deadline was returned',
        },
        { status: 500 }
      );
    }

    const extensionCount = result.extensionCount ?? 0;
    const maxExtensions = result.maxExtensions ?? extensionCount;

    return NextResponse.json({
      success: true,
      newDeadline: result.newDeadline,
      extensionCount,
      maxExtensions,
      canGrantMore: extensionCount < maxExtensions,
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

    const extensions = await extensionService.getExtensionHistory(auctionId);

    return NextResponse.json({
      success: true,
      extensions,
      count: extensions.length,
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
