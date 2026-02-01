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
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { eq, desc } from 'drizzle-orm';

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

    // Format response
    const response = {
      success: true,
      auction: {
        ...auction,
        bids: bidHistory,
      },
    };

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
