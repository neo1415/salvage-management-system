/**
 * Auction Watching Count API
 * GET /api/auctions/[id]/watching-count - Get current watching count
 * 
 * Requirements: 20 (Watching Count Tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWatchingCount } from '@/features/auctions/services/watching.service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await context.params;

    // Get watching count from Redis
    const count = await getWatchingCount(auctionId);

    return NextResponse.json({
      success: true,
      watchingCount: count,
    });
  } catch (error) {
    console.error('Error getting watching count:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get watching count',
        watchingCount: 0, // Return 0 as fallback
      },
      { status: 500 }
    );
  }
}
