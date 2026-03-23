/**
 * Auction Bids API Route
 * Handles bid placement with OTP verification
 * 
 * Requirements:
 * - Requirement 18: Bid Placement with OTP
 * - Enterprise Standards Section 5: Business Logic Layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { biddingService } from '@/features/auctions/services/bidding.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auctions/[id]/bids
 * Place a bid on an auction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+)
    const { id } = await params;

    // Get session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor ID from user ID
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount, otp } = body;

    // Validate input
    if (!amount || !otp) {
      return NextResponse.json(
        { success: false, error: 'Bid amount and OTP are required' },
        { status: 400 }
      );
    }

    // Get IP address and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Place bid
    const result = await biddingService.placeBid({
      auctionId: id,
      vendorId: vendor.id,
      amount: parseFloat(amount),
      otp,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          errors: result.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bid: result.bid,
    });
  } catch (error) {
    console.error('Bid placement error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to place bid' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auctions/[id]/bids
 * Get all bids for an auction
 */
export async function GET(
  _request: NextRequest, // Prefixed with _ as it's required by Next.js but not used
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+)
    const { id } = await params;

    // Get session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get auction bids
    const bids = await biddingService.getAuctionBids(id);

    return NextResponse.json({
      success: true,
      bids,
    });
  } catch (error) {
    console.error('Get bids error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get bids' 
      },
      { status: 500 }
    );
  }
}
