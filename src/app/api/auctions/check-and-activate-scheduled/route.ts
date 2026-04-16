/**
 * Check and Activate Scheduled Auctions API
 * 
 * Called by client-side polling to activate scheduled auctions when their time arrives.
 * This replaces the need for cron jobs and works in both local dev and production.
 * 
 * Features:
 * - Finds scheduled auctions where scheduledStartTime <= now
 * - Activates them (status='active', isScheduled=false)
 * - Updates case status to 'active_auction'
 * - Notifies matching vendors
 * - Returns list of activated auctions for UI refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, lte, arrayContains } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/auctions/check-and-activate-scheduled
 * Checks for and activates scheduled auctions that are due
 */
export async function POST(request: NextRequest) {
  try {
    const now = new Date();
    console.log(`[Polling] Checking scheduled auctions at ${now.toISOString()} (${now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT)`);

    // Find scheduled auctions that should start now
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
          eq(auctions.status, 'scheduled'),
          lte(auctions.scheduledStartTime, now)
        )
      );

    console.log(`[Polling] Found ${scheduledAuctions.length} scheduled auction(s) to activate`);
    
    // Log details of each scheduled auction found
    for (const { auction, case: caseRecord } of scheduledAuctions) {
      console.log(`[Polling] - Auction ${auction.id}: ${caseRecord.claimReference}, scheduled for ${auction.scheduledStartTime?.toISOString()}`);
    }

    if (scheduledAuctions.length === 0) {
      return NextResponse.json({
        success: true,
        activated: [],
        count: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[Polling] Found ${scheduledAuctions.length} auctions to activate`);

    const activatedAuctions = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';

    for (const { auction, case: caseRecord } of scheduledAuctions) {
      try {
        console.log(`[Polling] Activating auction ${auction.id} for case ${caseRecord.claimReference}`);

        // Update auction status
        await db
          .update(auctions)
          .set({
            status: 'active',
            isScheduled: false,
            startTime: now,
            updatedAt: now,
          })
          .where(eq(auctions.id, auction.id));

        // Update case status
        await db
          .update(salvageCases)
          .set({
            status: 'active_auction',
            updatedAt: now,
          })
          .where(eq(salvageCases.id, caseRecord.id));

        // Log audit trail
        await logAction(
          createAuditLogData(
            request,
            'system',
            AuditActionType.AUCTION_STARTED,
            AuditEntityType.AUCTION,
            auction.id,
            { status: 'scheduled' },
            { 
              status: 'active',
              startedAt: now.toISOString(),
              scheduledStartTime: auction.scheduledStartTime?.toISOString(),
              activatedBy: 'client-polling',
            }
          )
        );

        // Notify matching vendors
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

        console.log(`[Polling] Notifying ${realVendors.length} vendors for auction ${auction.id}`);

        // Send notifications
        let notifiedCount = 0;
        for (const vendor of realVendors) {
          try {
            // Send SMS
            const smsMessage = `New auction started! ${assetType.toUpperCase()} - Reserve: ₦${caseRecord.reservePrice}. Ends in 5 days. Bid now: ${appUrl}/vendor/auctions/${auction.id}`;
            await smsService.sendSMS({
              to: vendor.phone,
              message: smsMessage,
            });

            // Send email
            await emailService.sendAuctionStartEmail(vendor.email, {
              vendorName: vendor.fullName,
              auctionId: auction.id,
              assetType: assetType,
              assetName: `${assetType.toUpperCase()} - ${caseRecord.claimReference}`,
              reservePrice: parseFloat(caseRecord.reservePrice),
              startTime: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
              endTime: auction.endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
              location: caseRecord.locationName,
              appUrl: appUrl,
            });

            notifiedCount++;
          } catch (error) {
            console.error(`[Polling] Failed to notify vendor ${vendor.vendorId}:`, error);
          }
        }

        activatedAuctions.push({
          auctionId: auction.id,
          caseReference: caseRecord.claimReference,
          assetType: caseRecord.assetType,
          notifiedVendors: notifiedCount,
        });

        console.log(`[Polling] Successfully activated auction ${auction.id}, notified ${notifiedCount} vendors`);
      } catch (error) {
        console.error(`[Polling] Error activating auction ${auction.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      activated: activatedAuctions,
      count: activatedAuctions.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[Polling] Error checking scheduled auctions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check scheduled auctions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
