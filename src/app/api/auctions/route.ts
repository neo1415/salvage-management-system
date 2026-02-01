/**
 * Auctions API Endpoint
 * 
 * GET /api/auctions - Fetch auctions with filters, search, and pagination
 * 
 * Requirements:
 * - Requirement 16: Mobile Auction Browsing
 * - NFR1.1: API response time <500ms
 * - Enterprise Standards Section 5: Business Logic Layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, gte, lte, or, like, desc, asc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
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

    // Build where conditions
    const conditions = [];

    // Only show active and extended auctions
    conditions.push(
      or(
        eq(auctions.status, 'active'),
        eq(auctions.status, 'extended')
      )
    );

    // Asset type filter
    if (assetType) {
      conditions.push(eq(salvageCases.assetType, assetType as 'vehicle' | 'property' | 'electronics'));
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
    if (search) {
      conditions.push(
        or(
          like(salvageCases.claimReference, `%${search}%`),
          // Search in asset details would require JSON operations
          // For now, just search claim reference
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
        orderBy = asc(auctions.endTime);
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

    return NextResponse.json({
      success: true,
      auctions: results,
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
