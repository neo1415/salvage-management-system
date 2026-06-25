/**
 * Auction Bids API Route
 * Handles bid placement with OTP verification and deposit-based freezing
 * 
 * Requirements:
 * - Requirement 18: Bid Placement with OTP
 * - Requirement 1: Dynamic Deposit Calculation
 * - Requirement 2: Pre-Bid Eligibility Validation
 * - Requirement 3: Deposit Freeze on Bid Placement
 * - Enterprise Standards Section 5: Business Logic Layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { biddingService } from '@/features/auctions/services/bidding.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';

const bidRequestSchema = z.object({
  amount: z.union([z.number(), z.string()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isFinite(value) && value > 0, 'Bid amount must be a positive number')
    .refine((value) => value <= 1_000_000_000_000, 'Bid amount is too large'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'A valid 6-digit OTP is required')
    .optional(),
});

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

    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60,
      identifier: `bid:${vendor.id}:${id}`,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many bid attempts. Please slow down and try again.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const parsed = bidRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid bid request' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Get IP address, user agent, and device fingerprint for fraud detection
    const { getRealIPAddress, generateDeviceFingerprint } = await import('@/lib/utils/device-fingerprint');
    const ipAddress = getRealIPAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceFingerprint = generateDeviceFingerprint(request);

    const { amount: bidAmount, otp } = parsed.data;

    // Place bid (bidding service handles all deposit/escrow logic internally)
    const result = await biddingService.placeBid({
      auctionId: id,
      vendorId: vendor.id,
      amount: bidAmount,
      otp,
      ipAddress,
      userAgent,
      deviceFingerprint,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          errors: result.errors 
        },
      { status: 400, headers: rateLimitHeaders }
      );
    }

    // Track vendor interaction (async, don't wait)
    trackVendorBid(vendor.id, id).catch(error => {
      console.error('Failed to track vendor bid:', error);
    });

    // Return bid confirmation
    return NextResponse.json(
      {
        success: true,
        bid: result.bid,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Bid placement error:', error);
    
    // SECURITY FIX: Sanitize error messages - don't expose internal details
    const sanitizedError = error instanceof Error && error.message.includes('Bid too low')
      ? error.message // Safe error message
      : 'Failed to place bid. Please try again.'; // Generic error for unexpected issues
    
    return NextResponse.json(
      { 
        success: false, 
        error: sanitizedError
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
    
    // SECURITY FIX: Sanitize error messages
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve bids. Please try again.'
      },
      { status: 500 }
    );
  }
}


/**
 * Track vendor bidding on an auction for recommendations
 */
async function trackVendorBid(vendorId: string, auctionId: string): Promise<void> {
  try {
    const { db } = await import('@/lib/db/drizzle');
    const { vendorInteractions } = await import('@/lib/db/schema/fraud-tracking');
    const crypto = await import('crypto');
    
    await db.insert(vendorInteractions).values({
      id: crypto.randomUUID(),
      vendorId,
      auctionId,
      interactionType: 'bid',
      timestamp: new Date(),
    });
    
    console.log(`📊 Tracked bid: vendor ${vendorId} bid on auction ${auctionId}`);
  } catch (error) {
    // Silent fail - don't block bidding
    console.error('Failed to track vendor bid:', error);
  }
}
