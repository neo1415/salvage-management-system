/**
 * Scheduled Auction Starter Cron Job
 * 
 * Runs every minute to check for scheduled auctions that should start.
 * Finds auctions where isScheduled = true and scheduledStartTime <= now.
 * 
 * For each auction:
 * - Updates status from 'scheduled' to 'active'
 * - Sets isScheduled = false
 * - Updates case status to 'active_auction'
 * - Notifies matching vendors
 * - Logs audit trail
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/start-scheduled-auctions",
 *     "schedule": "* * * * *"
 *   }]
 * }
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
export const maxDuration = 60; // 60 seconds max execution time

/**
 * GET /api/cron/start-scheduled-auctions
 * Starts scheduled auctions that are due
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`[Cron] Starting scheduled auction check at ${now.toISOString()}`);

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

    console.log(`[Cron] Found ${scheduledAuctions.length} auctions to start`);

    const results = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';

    for (const { auction, case: caseRecord } of scheduledAuctions) {
      try {
        console.log(`[Cron] Starting auction ${auction.id} for case ${caseRecord.claimReference}`);

        // Update auction status
        await db
          .update(auctions)
          .set({
            status: 'active',
            isScheduled: false,
            startTime: now, // Update actual start time
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
            'system', // System-initiated action
            AuditActionType.AUCTION_STARTED,
            AuditEntityType.AUCTION,
            auction.id,
            { status: 'scheduled' },
            { 
              status: 'active',
              startedAt: now.toISOString(),
              scheduledStartTime: auction.scheduledStartTime?.toISOString(),
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

        console.log(`[Cron] Notifying ${realVendors.length} vendors for auction ${auction.id}`);

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
            console.error(`[Cron] Failed to notify vendor ${vendor.vendorId}:`, error);
          }
        }

        results.push({
          auctionId: auction.id,
          caseReference: caseRecord.claimReference,
          status: 'started',
          notifiedVendors: notifiedCount,
        });

        console.log(`[Cron] Successfully started auction ${auction.id}, notified ${notifiedCount} vendors`);
      } catch (error) {
        console.error(`[Cron] Error starting auction ${auction.id}:`, error);
        results.push({
          auctionId: auction.id,
          caseReference: caseRecord.claimReference,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`[Cron] Completed scheduled auction check. Started ${results.filter(r => r.status === 'started').length} auctions`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      auctionsChecked: scheduledAuctions.length,
      auctionsStarted: results.filter(r => r.status === 'started').length,
      results: results,
    });
  } catch (error) {
    console.error('[Cron] Error in scheduled auction starter:', error);
    return NextResponse.json(
      {
        error: 'Failed to start scheduled auctions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
