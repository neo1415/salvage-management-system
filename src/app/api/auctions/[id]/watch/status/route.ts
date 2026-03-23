/**
 * Auction Watch Status API
 * GET /api/auctions/[id]/watch/status - Check if user is watching auction
 * 
 * Requirements: 20 (Watching Count Tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { isVendorWatching } from '@/features/auctions/services/watching.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

export async function GET(
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
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json({
        success: true,
        isWatching: false,
      });
    }

    // Check if vendor is watching this auction
    const isWatching = await isVendorWatching(auctionId, vendor.id);

    return NextResponse.json({
      success: true,
      isWatching,
    });
  } catch (error) {
    console.error('Error checking watch status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check watch status',
      },
      { status: 500 }
    );
  }
}