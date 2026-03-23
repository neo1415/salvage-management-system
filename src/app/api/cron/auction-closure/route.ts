/**
 * Auction Closure Cron Job API Route
 * 
 * This endpoint should be called periodically (e.g., every 5 minutes) by a cron service
 * like Vercel Cron, GitHub Actions, or an external cron service.
 * 
 * Requirements:
 * - Requirement 24: Paystack Instant Payment
 * - Enterprise Standards Section 5: Business Logic Layer
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/auction-closure",
 *     "schedule": "every 5 minutes"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auctionClosureService } from '@/features/auctions/services/closure.service';

/**
 * GET /api/cron/auction-closure
 * Close all expired auctions
 * 
 * Security: This endpoint should be protected by:
 * 1. Vercel Cron secret header verification
 * 2. Or API key authentication
 * 3. Or IP whitelist
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (if using Vercel Cron)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Starting auction closure cron job...');

    // Close all expired auctions
    const result = await auctionClosureService.closeExpiredAuctions();

    console.log(
      `Auction closure cron job completed: ${result.successful} successful, ${result.failed} failed`
    );

    return NextResponse.json({
      success: true,
      message: 'Auction closure completed',
      result: {
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Auction closure cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/auction-closure
 * Alternative endpoint for POST requests (some cron services prefer POST)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
