/**
 * Auction Polling Fallback API
 * 
 * Provides polling-based updates for auction state when WebSocket connection fails.
 * This is a fallback mechanism for production environments (like Vercel) where
 * WebSocket connections may not be reliable.
 * 
 * Features:
 * - Returns current auction state (bid, bidder, status, endTime, watchingCount)
 * - Rate limiting: max 1 request per 2 seconds per user
 * - ETag support for efficient caching (304 Not Modified)
 * - Lightweight response payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';
import { configService } from '@/features/auction-deposit/services/config.service';

// Rate limiting: 1 request per 2 seconds per user
const RATE_LIMIT_WINDOW = 2000; // 2 seconds in milliseconds

/**
 * GET /api/auctions/[id]/poll
 * 
 * Poll for auction state updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const auctionId = resolvedParams.id;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Rate limiting check
    const rateLimitKey = `auction:poll:${userId}:${auctionId}`;
    const lastPollTime = await redis.get(rateLimitKey);

    if (lastPollTime && typeof lastPollTime === 'string') {
      const timeSinceLastPoll = Date.now() - parseInt(lastPollTime, 10);
      if (timeSinceLastPoll < RATE_LIMIT_WINDOW) {
        const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastPoll) / 1000);
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: remainingTime,
          },
          { 
            status: 429,
            headers: {
              'Retry-After': remainingTime.toString(),
            },
          }
        );
      }
    }

    // Update rate limit timestamp
    await redis.set(rateLimitKey, Date.now().toString(), { ex: 3 }); // Expire after 3 seconds

    // Fetch auction data
    const [auction] = await db
      .select({
        id: auctions.id,
        currentBid: auctions.currentBid,
        currentBidder: auctions.currentBidder,
        status: auctions.status,
        endTime: auctions.endTime,
        updatedAt: auctions.updatedAt,
      })
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Check if payment is verified (for awaiting_payment status)
    let hasVerifiedPayment = false;
    if (auction.status === 'awaiting_payment') {
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.status, 'verified')
          )
        )
        .limit(1);
      hasVerifiedPayment = !!payment;
    }

    // Get watching count from Redis
    let watchingCount = 0;
    try {
      const watchingKey = `auction:${auctionId}:watching`;
      const count = await redis.get(watchingKey);
      watchingCount = count && typeof count === 'string' ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Failed to get watching count from Redis:', error);
      // Continue without watching count
    }

    // Get system configuration for minimum bid increment
    const config = await configService.getConfig();

    // Calculate minimum bid using configured increment
    const currentBid = auction.currentBid ? parseFloat(auction.currentBid) : null;
    const minimumBid = currentBid ? currentBid + config.minimumBidIncrement : null;

    // Create response data
    const responseData = {
      auctionId: auction.id,
      currentBid: currentBid,
      currentBidder: auction.currentBidder,
      minimumBid,
      status: auction.status,
      endTime: auction.endTime,
      watchingCount,
      hasVerifiedPayment,
      timestamp: new Date().toISOString(),
    };

    // Generate ETag based on auction state (include hasVerifiedPayment in hash)
    const etag = `"${auction.id}-${auction.currentBid}-${auction.status}-${hasVerifiedPayment}-${auction.updatedAt?.getTime()}"`;
    
    // Check if client has cached version
    const clientEtag = request.headers.get('if-none-match');
    if (clientEtag === etag) {
      // No changes - return 304 Not Modified
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Return updated data
    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      {
        status: 200,
        headers: {
          'ETag': etag,
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Error polling auction:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
