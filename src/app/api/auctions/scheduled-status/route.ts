/**
 * Scheduled Auctions Status API
 * 
 * GET endpoint to check the status of all scheduled auctions.
 * Useful for debugging scheduling issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auctions/scheduled-status
 * Returns all scheduled auctions with their details
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();

    // Find all scheduled auctions
    const scheduledAuctions = await db
      .select({
        auction: auctions,
        case: salvageCases,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.isScheduled, true),
          eq(auctions.status, 'scheduled')
        )
      );

    const auctionDetails = scheduledAuctions.map(({ auction, case: caseRecord }) => {
      const scheduledTime = auction.scheduledStartTime;
      const isPastDue = scheduledTime ? scheduledTime <= now : false;
      const timeUntilStart = scheduledTime ? scheduledTime.getTime() - now.getTime() : null;
      const minutesUntilStart = timeUntilStart ? Math.floor(timeUntilStart / 1000 / 60) : null;

      return {
        auctionId: auction.id,
        caseReference: caseRecord.claimReference,
        assetType: caseRecord.assetType,
        status: auction.status,
        isScheduled: auction.isScheduled,
        scheduledStartTime: scheduledTime?.toISOString(),
        scheduledStartTimeWAT: scheduledTime?.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
        currentTime: now.toISOString(),
        currentTimeWAT: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
        isPastDue,
        minutesUntilStart,
        shouldActivate: isPastDue,
      };
    });

    // Separate into past due and upcoming
    const pastDue = auctionDetails.filter(a => a.isPastDue);
    const upcoming = auctionDetails.filter(a => !a.isPastDue);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      timestampWAT: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      summary: {
        total: scheduledAuctions.length,
        pastDue: pastDue.length,
        upcoming: upcoming.length,
      },
      pastDue,
      upcoming,
      allScheduled: auctionDetails,
    });
  } catch (error) {
    console.error('[Scheduled Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch scheduled auctions status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
