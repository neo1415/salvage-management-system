/**
 * Document Deadline Checker Cron Job
 * 
 * Runs every hour to check for expired document deadlines.
 * Waits fallback_buffer_period (default 24 hours) after deadline expires.
 * Then triggers fallback chain for auctions where winner failed to sign.
 * 
 * Testing Mode:
 * Set TESTING_MODE=true and TESTING_DOCUMENT_VALIDITY_MINUTES=5
 * to test with 5-minute deadlines instead of 48 hours.
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-document-deadlines",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * Requirements:
 * - Requirement 9.1: Trigger fallback chain after document deadline expires
 * - Requirement 9.2: Wait fallback_buffer_period before triggering
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctionWinners, auctionDocuments } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, lte, isNull } from 'drizzle-orm';
import * as fallbackService from '@/features/auction-deposit/services/fallback.service';
import { configService } from '@/features/auction-deposit/services/config.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time

/**
 * GET /api/cron/check-document-deadlines
 * Checks for expired document deadlines and triggers fallback chain
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Document Deadline Cron] Unauthorized attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`[Document Deadline Cron] Starting check at ${now.toISOString()}`);

    // Get system configuration
    const config = await configService.getConfig();
    const fallbackBufferPeriod = config.fallbackBufferPeriod; // Default 24 hours

    // Testing mode: Override buffer period with environment variable
    const testingMode = process.env.TESTING_MODE === 'true';
    const testingBufferMinutes = parseInt(process.env.TESTING_BUFFER_MINUTES || '0');
    const effectiveBufferHours = testingMode && testingBufferMinutes > 0 
      ? testingBufferMinutes / 60 
      : fallbackBufferPeriod;

    console.log(`[Document Deadline Cron] Buffer period: ${effectiveBufferHours} hours ${testingMode ? '(TESTING MODE)' : ''}`);

    // Calculate cutoff time (now - buffer period)
    const cutoffTime = new Date(now.getTime() - (effectiveBufferHours * 60 * 60 * 1000));

    // Find auctions with expired document deadlines (past cutoff)
    // Status should be 'awaiting_documents' and validityDeadline < cutoffTime
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
      .leftJoin(auctionDocuments, and(
        eq(auctionDocuments.auctionId, auctions.id),
        eq(auctionDocuments.vendorId, auctionWinners.vendorId)
      ))
      .where(
        and(
          eq(auctions.status, 'awaiting_documents'),
          lte(auctionDocuments.validityDeadline, cutoffTime),
          isNull(auctionDocuments.signedAt) // Not signed
        )
      );

    console.log(`[Document Deadline Cron] Found ${expiredAuctions.length} auctions with expired document deadlines`);

    const results = [];

    for (const { auction, winner, document } of expiredAuctions) {
      try {
        console.log(`[Document Deadline Cron] Processing auction ${auction.id}, winner ${winner.vendorId}`);
        console.log(`  - Document deadline: ${document.validityDeadline?.toISOString()}`);
        console.log(`  - Cutoff time: ${cutoffTime.toISOString()}`);
        console.log(`  - Buffer period elapsed: ${effectiveBufferHours} hours`);

        // Trigger fallback chain
        const fallbackResult = await fallbackService.triggerFallback(
          auction.id,
          winner.vendorId,
          'failed_to_sign'
        );

        if (fallbackResult.success) {
          results.push({
            auctionId: auction.id,
            previousWinner: winner.vendorId,
            status: 'fallback_triggered',
            newWinner: fallbackResult.newWinnerId,
            allFallbacksFailed: fallbackResult.allFallbacksFailed,
          });

          console.log(`[Document Deadline Cron] ✅ Fallback triggered for auction ${auction.id}`);
          if (fallbackResult.newWinnerId) {
            console.log(`  - New winner: ${fallbackResult.newWinnerId}`);
          } else if (fallbackResult.allFallbacksFailed) {
            console.log(`  - All fallbacks failed - manual intervention required`);
          }
        } else {
          results.push({
            auctionId: auction.id,
            previousWinner: winner.vendorId,
            status: 'error',
            error: fallbackResult.error,
          });

          console.error(`[Document Deadline Cron] ❌ Failed to trigger fallback for auction ${auction.id}:`, fallbackResult.error);
        }
      } catch (error) {
        console.error(`[Document Deadline Cron] Error processing auction ${auction.id}:`, error);
        results.push({
          auctionId: auction.id,
          previousWinner: winner.vendorId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'fallback_triggered').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`[Document Deadline Cron] Completed: ${successCount} fallbacks triggered, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      testingMode,
      bufferHours: effectiveBufferHours,
      auctionsChecked: expiredAuctions.length,
      fallbacksTriggered: successCount,
      errors: errorCount,
      results: results,
    });
  } catch (error) {
    console.error('[Document Deadline Cron] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check document deadlines',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
