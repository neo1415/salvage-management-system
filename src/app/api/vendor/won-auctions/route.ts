/**
 * Won Auctions API
 * GET /api/vendor/won-auctions
 * 
 * Returns all auctions won by the current vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, desc, or, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Fetch all closed or awaiting_payment auctions won by this vendor
    // FIXED: Include awaiting_payment status so recent documents show up
    const wonAuctions = await db
      .select({
        id: auctions.id,
        caseId: auctions.caseId,
        currentBid: auctions.currentBid,
        status: auctions.status,
        endTime: auctions.endTime,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.currentBidder, vendorId),
          or(
            eq(auctions.status, 'closed'),
            eq(auctions.status, 'awaiting_payment')
          )
        )
      )
      .orderBy(desc(auctions.endTime));

    // Format asset names
    const formattedAuctions = wonAuctions.map((auction) => {
      const details = auction.assetDetails as Record<string, unknown>;
      let assetName = 'Salvage Item';

      switch (auction.assetType) {
        case 'vehicle':
          assetName = `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim() || 'Vehicle';
          break;
        case 'property':
          assetName = `${details.propertyType || 'Property'}`;
          break;
        case 'electronics':
          assetName = `${details.brand || ''} Electronics`.trim();
          break;
        case 'machinery':
          assetName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
          if (!assetName) {
            assetName = details.machineryType ? String(details.machineryType) : 'Machinery';
          }
          break;
      }

      return {
        id: auction.id,
        caseId: auction.caseId,
        currentBid: auction.currentBid,
        status: auction.status,
        closedAt: auction.endTime,
        assetName,
        assetType: auction.assetType,
      };
    });

    return NextResponse.json({
      status: 'success',
      data: {
        auctions: formattedAuctions,
        count: formattedAuctions.length,
      },
    });
  } catch (error) {
    console.error('Won auctions error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch won auctions',
      },
      { status: 500 }
    );
  }
}
