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
import { eq, desc, and, inArray } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';
import { auth } from '@/lib/auth/next-auth.config';
import { sanitizeAuctionCaseForViewer } from '@/features/auctions/services/public-auction-case';
import { getAuctionDetailsCacheKey } from '@/features/auctions/services/auction-details-cache';
import { calculateAuctionPaymentProgress } from '@/features/auction-deposit/services/payment-progress';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await auth();
    const staffRoles = new Set([
      'system_admin',
      'salvage_manager',
      'claims_adjuster',
      'finance_officer',
    ]);
    const canViewInternalCaseData = staffRoles.has(session?.user?.role ?? '');

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
    const cacheKey = getAuctionDetailsCacheKey(
      id,
      canViewInternalCaseData ? 'staff' : 'public'
    );
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
      const confirmedPayments = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, id),
            auction.currentBidder ? eq(payments.vendorId, auction.currentBidder) : undefined,
            inArray(payments.status, ['partially_verified', 'verified'])
          )
        );
      hasVerifiedPayment = calculateAuctionPaymentProgress(
        Number(auction.currentBid || 0),
        confirmedPayments.map((payment) => Number(payment.amount))
      ).isComplete;
    }

    // Format response
    const caseRecord = auction.case;
    const safeCase = sanitizeAuctionCaseForViewer(caseRecord, canViewInternalCaseData);
    const response = {
      success: true,
      auction: {
        ...auction,
        case: safeCase,
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
