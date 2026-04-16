/**
 * Auction Details API
 * GET /api/auctions/[id]
 * 
 * Fetches detailed information about a specific auction including:
 * - Auction data
 * - Associated salvage case data
 * - Bid history
 * 
 * Requirements: 16-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { eq, desc, and } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

export async function GET(
  _request: NextRequest, // Required by Next.js API route signature
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate auction ID
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Auction ID is required' },
        { status: 400 }
      );
    }

    // SCALABILITY: Cache auction details for 5 minutes
    // Auction details change less frequently than list
    const cacheKey = `auction:details:${id}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return NextResponse.json(cached);
    }
    console.log(`❌ Cache MISS: ${cacheKey}`);

    // Fetch auction with case details
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, id),
      with: {
        case: true,
      },
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Fetch bid history
    const bidHistory = await db
      .select({
        id: bids.id,
        amount: bids.amount,
        createdAt: bids.createdAt,
        vendorId: bids.vendorId,
      })
      .from(bids)
      .where(eq(bids.auctionId, id))
      .orderBy(desc(bids.createdAt));

    // Check if payment is verified (for awaiting_payment status)
    let hasVerifiedPayment = false;
    if (auction.status === 'awaiting_payment') {
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, id),
            eq(payments.status, 'verified')
          )
        )
        .limit(1);
      hasVerifiedPayment = !!payment;
    }

    // Format response
    const response = {
      success: true,
      auction: {
        ...auction,
        bids: bidHistory,
        hasVerifiedPayment,
      },
    };

    // SCALABILITY: Cache for 5 minutes (300 seconds)
    await cache.set(cacheKey, response, 300);
    console.log(`✅ Cached response: ${cacheKey}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching auction details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auction details',
      },
      { status: 500 }
    );
  }
}
