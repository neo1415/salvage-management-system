/**
 * Auction Close API Endpoint
 * 
 * Called by client-side timer when auction expires.
 * Closes the auction immediately and determines winner.
 * 
 * POST /api/auctions/[id]/close
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AuctionClosureService } from '@/features/auctions/services/closure.service';
import { redis } from '@/lib/redis/client';

// Use the correct closure service that generates documents
const closureService = new AuctionClosureService();

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authentication check (any authenticated user can trigger closure)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[Auction Close API] Closing auction ${auctionId} triggered by user ${session.user.id}`);

    // CRITICAL FIX: Acquire distributed lock to prevent concurrent closure
    // This prevents duplicate payment records when multiple clients trigger closure simultaneously
    const lockKey = `auction:close:${auctionId}`;
    const lockValue = `${session.user.id}:${Date.now()}`;
    
    console.log(`[Auction Close API] Attempting to acquire lock: ${lockKey}`);
    
    const lockAcquired = await redis.set(lockKey, lockValue, {
      nx: true, // Only set if key doesn't exist (atomic operation)
      ex: 60,   // Expire after 60 seconds (prevents deadlock if process crashes)
    });

    if (!lockAcquired) {
      console.log(`[Auction Close API] Lock already held for auction ${auctionId} - closure in progress`);
      return NextResponse.json({
        success: true,
        message: 'Auction closure already in progress',
        note: 'Another process is closing this auction. Please wait.',
      });
    }

    console.log(`[Auction Close API] Lock acquired for auction ${auctionId}`);

    try {
      // Close the auction using the closure service that generates documents
      const result = await closureService.closeAuction(auctionId);

      if (!result.success) {
        console.error(`[Auction Close API] Failed to close auction ${auctionId}:`, result.error);
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to close auction',
          },
          { status: 400 }
        );
      }

      console.log(`[Auction Close API] Successfully closed auction ${auctionId}`);

      return NextResponse.json({
        success: true,
        auctionId,
        winnerId: result.winnerId,
        winningBid: result.winningBid,
        message: result.winnerId 
          ? `Auction closed. Winner: ${result.winnerId}` 
          : 'Auction closed with no bids',
      });
    } finally {
      // CRITICAL: Always release lock, even if closure fails
      await redis.del(lockKey);
      console.log(`[Auction Close API] Lock released for auction ${auctionId}`);
    }
  } catch (error) {
    console.error('[Auction Close API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to close auction. Please try again.'
      },
      { status: 500 }
    );
  }
}
