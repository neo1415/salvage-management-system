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
  request: NextRequest,
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

    // Track vendor interaction (async, don't wait)
    trackVendorView(request, id).catch(error => {
      console.error('Failed to track vendor view:', error);
    });

    // SCALABILITY: Cache auction details for 5 minutes
    // Auction details change less frequently than list
    // CRITICAL FIX: Validate cache freshness to prevent stale status
    const cacheKey = `auction:details:${id}`;
    const cached = await cache.get(cacheKey) as { 
      success: boolean; 
      auction?: { 
        status: string;
        [key: string]: any;
      } 
    } | null;
    
    if (cached?.auction) {
      // CRITICAL: Verify cached data is not stale by checking auction status in DB
      // This prevents returning "closed" when status is actually "awaiting_payment"
      const [currentAuction] = await db
        .select({ status: auctions.status, updatedAt: auctions.updatedAt })
        .from(auctions)
        .where(eq(auctions.id, id))
        .limit(1);
      
      if (currentAuction && currentAuction.status === cached.auction.status) {
        // Cache is fresh - status matches
        console.log(`✅ Cache HIT: ${cacheKey} (status: ${cached.auction.status})`);
        return NextResponse.json(cached);
      } else {
        // Cache is stale - status changed, invalidate and fetch fresh data
        console.log(`⚠️  Cache STALE: ${cacheKey} (cached: ${cached.auction.status}, actual: ${currentAuction?.status})`);
        await cache.del(cacheKey);
      }
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


/**
 * Track vendor viewing an auction for recommendations
 */
async function trackVendorView(request: NextRequest, auctionId: string): Promise<void> {
  try {
    const { auth } = await import('@/lib/auth/next-auth.config');
    const session = await auth();
    
    if (!session?.user?.id) {
      return; // Only track authenticated vendors
    }
    
    // Get vendor ID
    const { db } = await import('@/lib/db/drizzle');
    const { vendors } = await import('@/lib/db/schema/vendors');
    const { eq } = await import('drizzle-orm');
    
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });
    
    if (!vendor) {
      return; // Not a vendor
    }
    
    // Track interaction
    const { vendorInteractions } = await import('@/lib/db/schema/fraud-tracking');
    const crypto = await import('crypto');
    
    await db.insert(vendorInteractions).values({
      id: crypto.randomUUID(),
      vendorId: vendor.id,
      auctionId,
      interactionType: 'view',
      timestamp: new Date(),
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-user-ip') || 'unknown',
      },
    });
    
    console.log(`📊 Tracked view: vendor ${vendor.id} viewed auction ${auctionId}`);
  } catch (error) {
    // Silent fail - don't block auction viewing
    console.error('Failed to track vendor view:', error);
  }
}
