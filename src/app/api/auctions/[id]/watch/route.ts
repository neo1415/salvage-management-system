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
  _request: NextRequest,
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

    // Get vendor ID from user ID
    const { db } = await import('@/lib/db/drizzle');
    const { vendors } = await import('@/lib/db/schema/vendors');
    const { eq } = await import('drizzle-orm');

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Start watching - increment count
    const result = await incrementWatchingCount(
      auctionId,
      vendor.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      watchingCount: result,
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
  _request: NextRequest,
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

    // Get vendor ID from user ID
    const { db } = await import('@/lib/db/drizzle');
    const { vendors } = await import('@/lib/db/schema/vendors');
    const { eq } = await import('drizzle-orm');

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Stop watching - decrement count
    const result = await decrementWatchingCount(
      auctionId,
      vendor.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      watchingCount: result,
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
