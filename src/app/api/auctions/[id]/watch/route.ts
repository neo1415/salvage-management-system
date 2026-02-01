/**
 * Auction Watch API
 * POST /api/auctions/[id]/watch - Start watching auction
 * DELETE /api/auctions/[id]/watch - Stop watching auction
 * 
 * Requirements: 20 (Watching Count Tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { incrementWatchingCount, decrementWatchingCount } from '@/features/auctions/services/watching.service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: auctionId } = await context.params;

    // Start watching - increment count
    const watchingCount = await incrementWatchingCount(
      auctionId,
      session.user.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      watchingCount,
    });
  } catch (error) {
    console.error('Error starting watch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start watching',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: auctionId } = await context.params;

    // Stop watching - decrement count
    const watchingCount = await decrementWatchingCount(
      auctionId,
      session.user.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      watchingCount,
    });
  } catch (error) {
    console.error('Error stopping watch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop watching',
      },
      { status: 500 }
    );
  }
}
