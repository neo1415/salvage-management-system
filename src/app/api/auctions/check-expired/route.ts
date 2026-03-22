/**
 * API Route: Check and Close Expired Auctions
 * 
 * This endpoint checks if auctions have expired and closes them immediately.
 * Implements real-time auction closure instead of waiting for daily cron job.
 * 
 * Requirements:
 * - Close auctions immediately when endTime passes
 * - Support both single auction check and batch check
 * - Idempotent (safe to call multiple times)
 * - Handle race conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auctionClosureService } from '@/features/auctions/services/closure.service';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, lte } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auctionId, checkAll } = body;

    // Option 1: Check specific auction
    if (auctionId) {
      // Get auction details
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        return NextResponse.json(
          { error: 'Auction not found' },
          { status: 404 }
        );
      }

      // Check if auction has expired
      const now = new Date();
      const hasExpired = auction.endTime <= now;
      const isActive = auction.status === 'active';

      if (hasExpired && isActive) {
        // Close the auction
        const result = await auctionClosureService.closeAuction(auctionId);
        
        return NextResponse.json({
          success: true,
          closed: true,
          auction: result,
        });
      }

      // Auction hasn't expired or already closed
      return NextResponse.json({
        success: true,
        closed: false,
        status: auction.status,
        endTime: auction.endTime,
        hasExpired,
      });
    }

    // Option 2: Check all active auctions
    if (checkAll) {
      const result = await auctionClosureService.closeExpiredAuctions();
      
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json(
      { error: 'Please provide auctionId or set checkAll to true' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error checking expired auctions:', error);
    return NextResponse.json(
      { error: 'Failed to check expired auctions' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking if a specific auction has expired
 * Used by client-side polling
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auctionId = searchParams.get('auctionId');

    if (!auctionId) {
      return NextResponse.json(
        { error: 'auctionId is required' },
        { status: 400 }
      );
    }

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Check if auction has expired
    const now = new Date();
    const hasExpired = auction.endTime <= now;
    const isActive = auction.status === 'active';
    const shouldClose = hasExpired && isActive;

    if (shouldClose) {
      // Close the auction
      const result = await auctionClosureService.closeAuction(auctionId);
      
      return NextResponse.json({
        success: true,
        closed: true,
        auction: result,
      });
    }

    // Return auction status
    return NextResponse.json({
      success: true,
      closed: false,
      status: auction.status,
      endTime: auction.endTime,
      hasExpired,
      isActive,
    });
  } catch (error) {
    console.error('Error checking expired auction:', error);
    return NextResponse.json(
      { error: 'Failed to check expired auction' },
      { status: 500 }
    );
  }
}
