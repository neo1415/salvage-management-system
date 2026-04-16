/**
 * Auction Restart API
 * 
 * Allows salvage managers to restart closed auctions.
 * Clears all bids and resets the auction with a new schedule.
 * 
 * POST /api/auctions/[id]/restart
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, arrayContains } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

interface RestartRequest {
  scheduleData: {
    mode: 'now' | 'scheduled';
    scheduledTime?: Date | string;
    durationHours?: number;
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Salvage Manager
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden: Only Salvage Managers can restart auctions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: RestartRequest = await request.json();

    if (!body.scheduleData || !body.scheduleData.mode) {
      return NextResponse.json(
        { error: 'Schedule data is required' },
        { status: 400 }
      );
    }

    // Get auction with case details
    const auctionId = params.id;
    const [auctionData] = await db
      .select({
        auction: auctions,
        case: salvageCases,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auctionData) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    const { auction, case: caseRecord } = auctionData;

    // Validate auction is closed
    if (auction.status !== 'closed') {
      return NextResponse.json(
        { error: `Cannot restart auction with status: ${auction.status}. Only closed auctions can be restarted.` },
        { status: 400 }
      );
    }

    // Calculate new times based on schedule
    const now = new Date();
    const scheduleData = body.scheduleData;
    
    // Get duration in hours (default 120 hours = 5 days)
    const durationHours = scheduleData.durationHours || 120;
    const durationMs = durationHours * 60 * 60 * 1000;
    
    let auctionStatus: 'scheduled' | 'active' = 'active';
    let scheduledStartTime: Date | null = null;
    let isScheduled = false;
    let startTime = now;
    let endTime: Date;
    
    if (scheduleData.mode === 'scheduled' && scheduleData.scheduledTime) {
      // Scheduled restart
      auctionStatus = 'scheduled';
      scheduledStartTime = new Date(scheduleData.scheduledTime);
      isScheduled = true;
      startTime = scheduledStartTime;
      // Use specified duration from scheduled start
      endTime = new Date(scheduledStartTime.getTime() + durationMs);
    } else {
      // Start now - use specified duration
      endTime = new Date(now.getTime() + durationMs);
    }

    // Delete all existing bids for this auction
    await db
      .delete(bids)
      .where(eq(bids.auctionId, auctionId));

    // Reset auction
    const [updatedAuction] = await db
      .update(auctions)
      .set({
        status: auctionStatus,
        startTime: startTime,
        endTime: endTime,
        originalEndTime: endTime,
        extensionCount: 0,
        currentBid: null,
        currentBidder: null,
        watchingCount: 0,
        scheduledStartTime: scheduledStartTime,
        isScheduled: isScheduled,
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionId))
      .returning();

    // Update case status
    const caseStatus = auctionStatus === 'scheduled' ? 'approved' : 'active_auction';
    await db
      .update(salvageCases)
      .set({
        status: caseStatus,
        updatedAt: now,
      })
      .where(eq(salvageCases.id, caseRecord.id));

    // Log audit trail
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.AUCTION_RESTARTED,
        AuditEntityType.AUCTION,
        auctionId,
        {
          status: 'closed',
          previousEndTime: auction.endTime.toISOString(),
        },
        {
          status: auctionStatus,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isScheduled: isScheduled,
          scheduledStartTime: scheduledStartTime?.toISOString(),
          restartedBy: session.user.id,
        }
      )
    );

    // Notify vendors only if starting now (not scheduled)
    let notifiedVendorsCount = 0;
    if (scheduleData.mode === 'now') {
      const assetType = caseRecord.assetType;
      const matchingVendors = await db
        .select({
          vendorId: vendors.id,
          userId: vendors.userId,
          phone: users.phone,
          email: users.email,
          fullName: users.fullName,
        })
        .from(vendors)
        .innerJoin(users, eq(vendors.userId, users.id))
        .where(
          and(
            eq(vendors.status, 'approved'),
            arrayContains(vendors.categories, [assetType])
          )
        );

      // Filter out test vendors
      const realVendors = matchingVendors.filter(vendor => {
        const isTestEmail = vendor.email.endsWith('@test.com') || vendor.email.endsWith('@example.com');
        return !isTestEmail;
      });

      console.log(`Notifying ${realVendors.length} vendors for restarted auction ${auctionId}`);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';

      for (const vendor of realVendors) {
        try {
          // Send SMS
          const smsMessage = `Auction restarted! ${assetType.toUpperCase()} - Reserve: ₦${caseRecord.reservePrice}. Ends in 5 days. Bid now: ${appUrl}/vendor/auctions/${auctionId}`;
          await smsService.sendSMS({
            to: vendor.phone,
            message: smsMessage,
          });

          // Send email
          await emailService.sendAuctionStartEmail(vendor.email, {
            vendorName: vendor.fullName,
            auctionId: auctionId,
            assetType: assetType,
            assetName: `${assetType.toUpperCase()} - ${caseRecord.claimReference}`,
            reservePrice: parseFloat(caseRecord.reservePrice),
            startTime: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
            endTime: endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
            location: caseRecord.locationName,
            appUrl: appUrl,
          });

          notifiedVendorsCount++;
        } catch (error) {
          console.error(`Failed to notify vendor ${vendor.vendorId}:`, error);
        }
      }
    }

    // TODO: Broadcast update via Socket.IO if available
    try {
      const { broadcastAuctionUpdate } = await import('@/lib/socket/server');
      await broadcastAuctionUpdate(auctionId, {
        type: 'auction_restarted',
        status: auctionStatus,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isScheduled: isScheduled,
      });
    } catch (error) {
      console.warn('Socket.IO broadcast failed (non-critical):', error);
    }

    return NextResponse.json({
      success: true,
      message: scheduleData.mode === 'scheduled'
        ? 'Auction scheduled for restart successfully'
        : 'Auction restarted successfully',
      data: {
        auction: {
          id: updatedAuction.id,
          status: updatedAuction.status,
          startTime: updatedAuction.startTime,
          endTime: updatedAuction.endTime,
          isScheduled: updatedAuction.isScheduled,
          scheduledStartTime: updatedAuction.scheduledStartTime,
        },
        bidsCleared: true,
        notifiedVendors: notifiedVendorsCount,
      },
    });
  } catch (error) {
    console.error('Auction restart error:', error);
    return NextResponse.json(
      {
        error: 'Failed to restart auction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
