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
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and, lte, isNull } from 'drizzle-orm';
import * as fallbackService from '@/features/auction-deposit/services/fallback.service';
import { configService } from '@/features/auction-deposit/services/config.service';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveFallbackBufferHours,
} from '@/features/business-policy';
import { AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time

/**
 * GET /api/cron/check-document-deadlines
 * Checks for expired document deadlines and triggers fallback chain
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify cron secret (REQUIRED)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable!');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Security] Unauthorized cron attempt', {
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
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
    let effectiveBufferHours = testingMode && testingBufferMinutes > 0 
      ? testingBufferMinutes / 60 
      : fallbackBufferPeriod;

    const policy = await businessPolicyService.getEffectivePolicy();
    const fallbackBufferDecision = resolveFallbackBufferHours(policy);
    if (!testingMode && isBusinessPolicyEnforcementEnabled()) {
      effectiveBufferHours = fallbackBufferDecision.value ?? effectiveBufferHours;
    }
    console.log(`[Document Deadline Cron] Buffer period: ${effectiveBufferHours} hours ${testingMode ? '(TESTING MODE)' : ''}`);
    const systemActorId = await getSystemActorId();

    // Find auctions with expired document deadlines. Each candidate is then
    // checked against its own policy snapshot before fallback is triggered.
    const expiredAuctions = await db
      .select({
        auction: auctions,
        winner: auctionWinners,
        document: releaseForms,
      })
      .from(auctions)
      .innerJoin(auctionWinners, and(
        eq(auctionWinners.auctionId, auctions.id),
        eq(auctionWinners.vendorId, auctions.currentBidder),
        eq(auctionWinners.status, 'active')
      ))
      .innerJoin(releaseForms, and(
        eq(releaseForms.auctionId, auctions.id),
        eq(releaseForms.vendorId, auctionWinners.vendorId)
      ))
      .where(
        and(
          eq(auctions.status, 'closed'),
          lte(releaseForms.validityDeadline, now),
          isNull(releaseForms.signedAt)
        )
      );

    console.log(`[Document Deadline Cron] Found ${expiredAuctions.length} auctions with expired document deadlines`);

    const results = [];

    const processedAuctions = new Set<string>();

    for (const { auction, winner, document } of expiredAuctions) {
      try {
        if (processedAuctions.has(auction.id)) continue;
        processedAuctions.add(auction.id);

        if (!document.validityDeadline) {
          console.warn(`[Document Deadline Cron] Document ${document.id} has no validity deadline. Skipping.`);
          continue;
        }

        let candidateBufferHours = effectiveBufferHours;
        let candidateBufferDecision = fallbackBufferDecision;
        if (!testingMode && isBusinessPolicyEnforcementEnabled()) {
          const documentPolicy = await businessPolicyService.getPolicyForEntity('document', document.id);
          candidateBufferDecision = resolveFallbackBufferHours(documentPolicy);
          candidateBufferHours = candidateBufferDecision.value ?? candidateBufferHours;
        }
        const cutoffTime = new Date(now.getTime() - (candidateBufferHours * 60 * 60 * 1000));

        if (document.validityDeadline > cutoffTime) {
          console.log(`[Document Deadline Cron] Auction ${auction.id} document deadline expired, waiting for ${candidateBufferHours}-hour buffer.`);
          continue;
        }

        console.log(`[Document Deadline Cron] Processing auction ${auction.id}, winner ${winner.vendorId}`);
        console.log(`  - Document deadline: ${document.validityDeadline?.toISOString()}`);
        console.log(`  - Cutoff time: ${cutoffTime.toISOString()}`);
        console.log(`  - Buffer period elapsed: ${candidateBufferHours} hours`);

        await logPolicyDecision({
          userId: systemActorId,
          entityType: AuditEntityType.AUCTION,
          entityId: auction.id,
          ipAddress: 'system',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron:check-document-deadlines',
          decision: candidateBufferDecision.decision,
          context: {
            mode: getBusinessPolicyRuntimeMode(),
            cron: 'check-document-deadlines',
            winnerId: winner.vendorId,
            documentDeadline: document.validityDeadline?.toISOString() ?? null,
            cutoffTime: cutoffTime.toISOString(),
            legacyEffectiveBufferHours: effectiveBufferHours,
            effectiveBufferHours: candidateBufferHours,
            policyBufferHours: candidateBufferDecision.value,
            testingMode,
          },
        });

        // Trigger fallback chain
        const fallbackResult = await fallbackService.triggerFallback(
          auction.id,
          winner.vendorId,
          'failed_to_sign',
          'system'
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

async function getSystemActorId(): Promise<string> {
  const { users } = await import('@/lib/db/schema/users');
  const [systemAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);

  return systemAdmin?.id ?? '00000000-0000-0000-0000-000000000000';
}
