/**
 * Payment Deadline Checker Cron Job
 * 
 * Runs every hour to check for expired payment deadlines.
 * Triggers forfeiture for auctions where winner signed but didn't pay.
 * Then triggers fallback chain after buffer period.
 * 
 * Testing Mode:
 * Set TESTING_MODE=true and TESTING_PAYMENT_DEADLINE_MINUTES=10
 * to test with 10-minute deadlines instead of 72 hours.
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-payment-deadlines",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * Requirements:
 * - Requirement 9.7: Trigger forfeiture for payment failure
 * - Requirement 11.1: Forfeit deposit when winner fails to pay
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctionWinners, auctionDocuments } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { forfeitureService } from '@/features/auction-deposit/services/forfeiture.service';
import * as fallbackService from '@/features/auction-deposit/services/fallback.service';
import { configService } from '@/features/auction-deposit/services/config.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time

/**
 * GET /api/cron/check-payment-deadlines
 * Checks for expired payment deadlines and triggers forfeiture + fallback
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Payment Deadline Cron] Unauthorized attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`[Payment Deadline Cron] Starting check at ${now.toISOString()}`);

    // Get system configuration
    const config = await configService.getConfig();
    const fallbackBufferPeriod = config.fallbackBufferPeriod; // Default 24 hours

    // Testing mode: Override buffer period with environment variable
    const testingMode = process.env.TESTING_MODE === 'true';
    const testingBufferMinutes = parseInt(process.env.TESTING_BUFFER_MINUTES || '0');
    const effectiveBufferHours = testingMode && testingBufferMinutes > 0 
      ? testingBufferMinutes / 60 
      : fallbackBufferPeriod;

    console.log(`[Payment Deadline Cron] Buffer period: ${effectiveBufferHours} hours ${testingMode ? '(TESTING MODE)' : ''}`);

    // Calculate cutoff time (now - buffer period)
    const cutoffTime = new Date(now.getTime() - (effectiveBufferHours * 60 * 60 * 1000));

    // Find auctions with expired payment deadlines (past cutoff)
    // Status should be 'awaiting_payment' and paymentDeadline < cutoffTime
    const expiredAuctions = await db
      .select({
        auction: auctions,
        winner: auctionWinners,
        document: auctionDocuments,
      })
      .from(auctions)
      .innerJoin(auctionWinners, and(
        eq(auctionWinners.auctionId, auctions.id),
        eq(auctionWinners.rank, 1), // Current winner
        eq(auctionWinners.status, 'active')
      ))
      .innerJoin(auctionDocuments, and(
        eq(auctionDocuments.auctionId, auctions.id),
        eq(auctionDocuments.vendorId, auctionWinners.vendorId)
      ))
      .where(
        and(
          eq(auctions.status, 'awaiting_payment'),
          lte(auctionDocuments.paymentDeadline, cutoffTime),
          isNotNull(auctionDocuments.signedAt) // Signed but not paid
        )
      );

    console.log(`[Payment Deadline Cron] Found ${expiredAuctions.length} auctions with expired payment deadlines`);

    const results = [];

    for (const { auction, winner, document } of expiredAuctions) {
      try {
        console.log(`[Payment Deadline Cron] Processing auction ${auction.id}, winner ${winner.vendorId}`);
        console.log(`  - Payment deadline: ${document.paymentDeadline?.toISOString()}`);
        console.log(`  - Cutoff time: ${cutoffTime.toISOString()}`);
        console.log(`  - Buffer period elapsed: ${effectiveBufferHours} hours`);

        // Step 1: Forfeit deposit
        console.log(`[Payment Deadline Cron] Forfeiting deposit for auction ${auction.id}`);
        const forfeitureResult = await forfeitureService.forfeitDeposit(
          auction.id,
          winner.vendorId,
          'payment_deadline_expired'
        );

        if (!forfeitureResult.success) {
          results.push({
            auctionId: auction.id,
            winner: winner.vendorId,
            status: 'forfeiture_error',
            error: forfeitureResult.error,
          });

          console.error(`[Payment Deadline Cron] ❌ Failed to forfeit deposit for auction ${auction.id}:`, forfeitureResult.error);
          continue;
        }

        console.log(`[Payment Deadline Cron] ✅ Deposit forfeited: ₦${forfeitureResult.forfeitedAmount?.toLocaleString()}`);

        // Step 2: Trigger fallback chain
        console.log(`[Payment Deadline Cron] Triggering fallback for auction ${auction.id}`);
        const fallbackResult = await fallbackService.triggerFallback(
          auction.id,
          winner.vendorId,
          'failed_to_pay'
        );

        if (fallbackResult.success) {
          results.push({
            auctionId: auction.id,
            previousWinner: winner.vendorId,
            status: 'completed',
            forfeitedAmount: forfeitureResult.forfeitedAmount,
            newWinner: fallbackResult.newWinnerId,
            allFallbacksFailed: fallbackResult.allFallbacksFailed,
          });

          console.log(`[Payment Deadline Cron] ✅ Fallback triggered for auction ${auction.id}`);
          if (fallbackResult.newWinnerId) {
            console.log(`  - New winner: ${fallbackResult.newWinnerId}`);
          } else if (fallbackResult.allFallbacksFailed) {
            console.log(`  - All fallbacks failed - manual intervention required`);
          }
        } else {
          results.push({
            auctionId: auction.id,
            previousWinner: winner.vendorId,
            status: 'fallback_error',
            forfeitedAmount: forfeitureResult.forfeitedAmount,
            error: fallbackResult.error,
          });

          console.error(`[Payment Deadline Cron] ❌ Failed to trigger fallback for auction ${auction.id}:`, fallbackResult.error);
        }
      } catch (error) {
        console.error(`[Payment Deadline Cron] Error processing auction ${auction.id}:`, error);
        results.push({
          auctionId: auction.id,
          winner: winner.vendorId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'completed').length;
    const errorCount = results.filter(r => r.status.includes('error')).length;

    console.log(`[Payment Deadline Cron] Completed: ${successCount} processed, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      testingMode,
      bufferHours: effectiveBufferHours,
      auctionsChecked: expiredAuctions.length,
      processed: successCount,
      errors: errorCount,
      results: results,
    });
  } catch (error) {
    console.error('[Payment Deadline Cron] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check payment deadlines',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
