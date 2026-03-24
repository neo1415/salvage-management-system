/**
 * Auctions API Endpoint
 * 
 * GET /api/auctions - Fetch auctions with filters, search, and pagination
 * 
 * Requirements:
 * - Requirement 16: Mobile Auction Browsing
 * - NFR1.1: API response time <500ms
 * - Enterprise Standards Section 5: Business Logic Layer
 * 
 * Supports tabs:
 * - active: Active and extended auctions (default)
 * - my_bids: Auctions where vendor has placed bids (any status)
 * - won: Auctions won by vendor (shows immediately after winning)
 * - completed: Closed auctions with verified payments (Finance approved only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, gte, lte, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get session for vendor-specific queries
    const session = await auth();
    const vendorId = session?.user?.vendorId;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Filters
    const assetType = searchParams.get('assetType') || '';
    const priceMin = searchParams.get('priceMin') || '';
    const priceMax = searchParams.get('priceMax') || '';
    const sortBy = searchParams.get('sortBy') || 'ending_soon';
    const location = searchParams.get('location') || '';
    const search = searchParams.get('search') || '';
    const tab = searchParams.get('tab') || 'active';

    // Build where conditions
    const conditions = [];

    // Tab-based filtering
    if (tab === 'active') {
      // Only show active and extended auctions
      conditions.push(
        or(
          eq(auctions.status, 'active'),
          eq(auctions.status, 'extended')
        )
      );
    } else if (tab === 'my_bids' && vendorId) {
      // Show auctions where vendor has placed bids (any status)
      // Use EXISTS subquery to avoid separate query and connection
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${bids} 
          WHERE ${bids.auctionId} = ${auctions.id} 
          AND ${bids.vendorId} = ${vendorId}
        )`
      );
    } else if (tab === 'won' && vendorId) {
      // Show auctions won by vendor (closed with vendor as winner)
      // Shows immediately after winning, regardless of payment status
      conditions.push(
        and(
          eq(auctions.status, 'closed'),
          eq(auctions.currentBidder, vendorId)
        )
      );
    } else if (tab === 'completed') {
      // Show only closed auctions where payment has been verified by Finance
      // Use EXISTS subquery to avoid separate query and connection
      conditions.push(
        and(
          eq(auctions.status, 'closed'),
          sql`EXISTS (
            SELECT 1 FROM ${payments} 
            WHERE ${payments.auctionId} = ${auctions.id} 
            AND ${payments.status} = 'verified'
          )`
        )
      );
    }

    // Asset type filter - supports multiple values (comma-separated)
    // Requirement 8.1: Multi-Category Filter OR Logic
    if (assetType) {
      const assetTypes = assetType.split(',').map(t => t.trim()).filter(Boolean);
      if (assetTypes.length === 1) {
        conditions.push(eq(salvageCases.assetType, assetTypes[0] as 'vehicle' | 'property' | 'electronics'));
      } else if (assetTypes.length > 1) {
        conditions.push(inArray(salvageCases.assetType, assetTypes as ('vehicle' | 'property' | 'electronics')[]));
      }
    }

    // Price range filter (using reserve price or current bid)
    if (priceMin) {
      conditions.push(
        or(
          gte(auctions.currentBid, priceMin),
          and(
            sql`${auctions.currentBid} IS NULL`,
            gte(salvageCases.reservePrice, priceMin)
          )
        )
      );
    }

    if (priceMax) {
      conditions.push(
        or(
          lte(auctions.currentBid, priceMax),
          and(
            sql`${auctions.currentBid} IS NULL`,
            lte(salvageCases.reservePrice, priceMax)
          )
        )
      );
    }

    // Location filter
    if (location) {
      conditions.push(like(salvageCases.locationName, `%${location}%`));
    }

    // Search filter (asset name or claim reference)
    // Search in claimReference and assetDetails JSON fields (make, model, description)
    if (search) {
      const searchLower = search.toLowerCase();
      conditions.push(
        or(
          like(salvageCases.claimReference, `%${search}%`),
          // Search in JSON assetDetails fields using PostgreSQL JSON operators
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'make' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'model' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'description' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'brand' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'propertyType' AS TEXT)) LIKE ${`%${searchLower}%`}`
        )
      );
    }

    // Determine sort order
    let orderBy;
    switch (sortBy) {
      case 'newest':
        orderBy = desc(auctions.createdAt);
        break;
      case 'price_low':
        orderBy = asc(
          sql`COALESCE(${auctions.currentBid}, ${salvageCases.reservePrice})`
        );
        break;
      case 'price_high':
        orderBy = desc(
          sql`COALESCE(${auctions.currentBid}, ${salvageCases.reservePrice})`
        );
        break;
      case 'ending_soon':
      default:
        // For completed auctions, sort by end time descending (most recent first)
        if (tab === 'completed' || tab === 'won') {
          orderBy = desc(auctions.endTime);
        } else {
          orderBy = asc(auctions.endTime);
        }
        break;
    }

    // Fetch auctions with case details
    const auctionsList = await db
      .select({
        id: auctions.id,
        caseId: auctions.caseId,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
        currentBid: auctions.currentBid,
        minimumIncrement: auctions.minimumIncrement,
        status: auctions.status,
        watchingCount: auctions.watchingCount,
        currentBidder: auctions.currentBidder,
        case: {
          id: salvageCases.id,
          claimReference: salvageCases.claimReference,
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
          marketValue: salvageCases.marketValue,
          estimatedSalvageValue: salvageCases.estimatedSalvageValue,
          reservePrice: salvageCases.reservePrice,
          damageSeverity: salvageCases.damageSeverity,
          locationName: salvageCases.locationName,
          photos: salvageCases.photos,
        },
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit + 1) // Fetch one extra to check if there are more
      .offset(offset);

    // Check if there are more results
    const hasMore = auctionsList.length > limit;
    const results = hasMore ? auctionsList.slice(0, limit) : auctionsList;

    // For my_bids and won tabs, add flag to indicate if user won
    const enrichedResults = results.map(auction => ({
      ...auction,
      isWinner: vendorId && auction.currentBidder === vendorId,
    }));

    return NextResponse.json({
      success: true,
      auctions: enrichedResults,
      hasMore,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching auctions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch auctions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
