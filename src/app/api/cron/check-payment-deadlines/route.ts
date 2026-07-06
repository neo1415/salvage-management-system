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
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { forfeitureService } from '@/features/auction-deposit/services/forfeiture.service';
import { transferService } from '@/features/auction-deposit/services/transfer.service';
import * as fallbackService from '@/features/auction-deposit/services/fallback.service';
import { configService } from '@/features/auction-deposit/services/config.service';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveFallbackBufferHours,
  resolveForfeiturePercentage,
} from '@/features/business-policy';
import { AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time

/**
 * GET /api/cron/check-payment-deadlines
 * Checks for expired payment deadlines and triggers forfeiture + fallback
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
    console.log(`[Payment Deadline Cron] Starting check at ${now.toISOString()}`);

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
    const forfeitureDecision = resolveForfeiturePercentage(policy);
    if (!testingMode && isBusinessPolicyEnforcementEnabled()) {
      effectiveBufferHours = fallbackBufferDecision.value ?? effectiveBufferHours;
    }
    console.log(`[Payment Deadline Cron] Buffer period: ${effectiveBufferHours} hours ${testingMode ? '(TESTING MODE)' : ''}`);
    const systemActorId = await getSystemActorId();

    // Find auctions with expired payment deadlines. Each candidate is then
    // checked against its own policy snapshot before forfeiture/fallback.
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
          eq(auctions.status, 'awaiting_payment'),
          lte(releaseForms.paymentDeadline, now),
          isNotNull(releaseForms.signedAt)
        )
      );

    console.log(`[Payment Deadline Cron] Found ${expiredAuctions.length} auctions with expired payment deadlines`);

    const results = [];

    const processedAuctions = new Set<string>();

    for (const { auction, winner, document } of expiredAuctions) {
      try {
        if (processedAuctions.has(auction.id)) continue;
        processedAuctions.add(auction.id);

        const [verifiedPayment] = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.auctionId, auction.id),
              eq(payments.vendorId, winner.vendorId),
              eq(payments.status, 'verified')
            )
          )
          .limit(1);

        if (verifiedPayment) {
          console.log(`[Payment Deadline Cron] Auction ${auction.id} already has verified payment. Skipping.`);
          continue;
        }

        let candidateBufferHours = effectiveBufferHours;
        let candidateBufferDecision = fallbackBufferDecision;
        let candidateForfeitureDecision = forfeitureDecision;
        if (!testingMode && isBusinessPolicyEnforcementEnabled()) {
          const documentPolicy = await businessPolicyService.getPolicyForEntity('document', document.id);
          candidateBufferDecision = resolveFallbackBufferHours(documentPolicy);
          candidateForfeitureDecision = resolveForfeiturePercentage(documentPolicy);
          candidateBufferHours = candidateBufferDecision.value ?? candidateBufferHours;
        }
        const candidateForfeiturePercentage = isBusinessPolicyEnforcementEnabled()
          ? candidateForfeitureDecision.value ?? config.forfeiturePercentage
          : config.forfeiturePercentage;
        const cutoffTime = new Date(now.getTime() - (candidateBufferHours * 60 * 60 * 1000));

        if (document.paymentDeadline && document.paymentDeadline > cutoffTime) {
          console.log(`[Payment Deadline Cron] Auction ${auction.id} payment deadline expired, waiting for ${candidateBufferHours}-hour buffer.`);
          continue;
        }

        console.log(`[Payment Deadline Cron] Processing auction ${auction.id}, winner ${winner.vendorId}`);
        console.log(`  - Payment deadline: ${document.paymentDeadline?.toISOString()}`);
        console.log(`  - Cutoff time: ${cutoffTime.toISOString()}`);
        console.log(`  - Buffer period elapsed: ${candidateBufferHours} hours`);

        await logPolicyDecision({
          userId: systemActorId,
          entityType: AuditEntityType.AUCTION,
          entityId: auction.id,
          ipAddress: 'system',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron:check-payment-deadlines',
          decision: candidateBufferDecision.decision,
          context: {
            mode: getBusinessPolicyRuntimeMode(),
            cron: 'check-payment-deadlines',
            winnerId: winner.vendorId,
            paymentDeadline: document.paymentDeadline?.toISOString() ?? null,
            cutoffTime: cutoffTime.toISOString(),
            legacyEffectiveBufferHours: effectiveBufferHours,
            effectiveBufferHours: candidateBufferHours,
            policyBufferHours: candidateBufferDecision.value,
            testingMode,
          },
        });

        await logPolicyDecision({
          userId: systemActorId,
          entityType: AuditEntityType.PAYMENT,
          entityId: auction.id,
          ipAddress: 'system',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron:check-payment-deadlines',
          decision: candidateForfeitureDecision.decision,
          context: {
            mode: getBusinessPolicyRuntimeMode(),
            cron: 'check-payment-deadlines',
            winnerId: winner.vendorId,
            depositAmount: winner.depositAmount,
            legacyForfeiturePercentage: config.forfeiturePercentage,
            policyForfeiturePercentage: candidateForfeitureDecision.value,
            effectiveForfeiturePercentage: candidateForfeiturePercentage,
          },
        });

        // Step 1: Forfeit deposit
        console.log(`[Payment Deadline Cron] Forfeiting deposit for auction ${auction.id}`);
        const forfeitureResult = await forfeitureService.forfeitDeposit({
          auctionId: auction.id,
          vendorId: winner.vendorId,
          depositAmount: parseFloat(winner.depositAmount),
          reason: 'payment_deadline_expired',
          forfeiturePercentage: candidateForfeiturePercentage,
        });

        console.log(`[Payment Deadline Cron] ✅ Deposit forfeited: ₦${forfeitureResult.forfeitedAmount?.toLocaleString()}`);

        // Step 2: Transfer forfeited deposit before fallback changes auction status.
        console.log(`[Payment Deadline Cron] Transferring forfeited deposit for auction ${auction.id}`);
        const transferResult = await transferService.transferForfeitedFunds({
          auctionId: auction.id,
        });

        console.log(`[Payment Deadline Cron] Forfeited deposit transferred: ${transferResult.amount.toLocaleString()}`);

        // Step 3: Trigger fallback chain
        console.log(`[Payment Deadline Cron] Triggering fallback for auction ${auction.id}`);
        const fallbackResult = await fallbackService.triggerFallback(
          auction.id,
          winner.vendorId,
          'failed_to_pay',
          'system'
        );

        if (fallbackResult.success) {
          results.push({
            auctionId: auction.id,
            previousWinner: winner.vendorId,
            status: 'completed',
            forfeitedAmount: forfeitureResult.forfeitedAmount,
            transferTransactionId: transferResult.transactionId,
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
            transferTransactionId: transferResult.transactionId,
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

async function getSystemActorId(): Promise<string> {
  const { users } = await import('@/lib/db/schema/users');
  const [systemAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);

  return systemAdmin?.id ?? '00000000-0000-0000-0000-000000000000';
}
