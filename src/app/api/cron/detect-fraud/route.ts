import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { shillBiddingDetectionService } from '@/features/fraud/services/shill-bidding-detection.service';
import { paymentFraudDetectionService } from '@/features/fraud/services/payment-fraud-detection.service';
import { fraudAlerts } from '@/lib/db/schema/intelligence';

/**
 * Daily Cron Job: Fraud Detection
 *
 * Runs daily to detect fraud patterns across all vendors:
 * - Shill bidding detection
 * - Payment fraud detection
 * - Creates fraud alerts for high-risk cases
 *
 * Schedule: Daily at 3 AM
 * Vercel Cron: 0 3 * * *
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable');
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

  console.log('[Fraud Cron] Starting daily fraud detection');

  const startTime = Date.now();
  let totalVendorsAnalyzed = 0;
  let shillBiddingAlertsCreated = 0;
  let paymentFraudAlertsCreated = 0;
  let errorCount = 0;

  try {
    const recentBidders = await db.execute(sql`
      SELECT DISTINCT vendor_id
      FROM bids
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const vendorIds = Array.isArray(recentBidders)
      ? recentBidders.map((row: any) => row.vendor_id)
      : [];

    console.log(`[Fraud Cron] Found ${vendorIds.length} vendors with recent bidding activity`);

    for (const vendorId of vendorIds) {
      try {
        console.log(`[Fraud Cron] Analyzing vendor: ${vendorId}`);

        const shillAnalysis = await shillBiddingDetectionService.analyzeVendorForShillBidding(vendorId);

        if (shillAnalysis.totalScore >= 60) {
          await createFraudAlert({
            type: 'shill_bidding',
            severity: shillAnalysis.riskLevel === 'critical' ? 'critical' : 'high',
            vendorId,
            description: `Shill bidding pattern detected (Score: ${shillAnalysis.totalScore}/100)`,
            metadata: shillAnalysis,
          });

          shillBiddingAlertsCreated++;
        }

        const paymentAnalysis = await paymentFraudDetectionService.analyzeVendorForPaymentFraud(vendorId);

        if (paymentAnalysis.totalScore >= 60) {
          await createFraudAlert({
            type: 'payment_fraud',
            severity: paymentAnalysis.riskLevel === 'critical' ? 'critical' : 'high',
            vendorId,
            description: `Payment fraud pattern detected (Score: ${paymentAnalysis.totalScore}/100)`,
            metadata: paymentAnalysis,
          });

          paymentFraudAlertsCreated++;
        }

        totalVendorsAnalyzed++;

        if (shillAnalysis.totalScore < 60 && paymentAnalysis.totalScore < 60) {
          console.log(`[Fraud Cron] No fraud detected for vendor ${vendorId}`);
        }
      } catch (error) {
        console.error(`[Fraud Cron] Error analyzing vendor ${vendorId}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    console.log('[Fraud Cron] Detection complete', {
      vendorsAnalyzed: totalVendorsAnalyzed,
      shillBiddingAlerts: shillBiddingAlertsCreated,
      paymentFraudAlerts: paymentFraudAlertsCreated,
      errors: errorCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      summary: {
        vendorsAnalyzed: totalVendorsAnalyzed,
        shillBiddingAlerts: shillBiddingAlertsCreated,
        paymentFraudAlerts: paymentFraudAlertsCreated,
        errors: errorCount,
        durationMs: duration,
      },
    });
  } catch (error) {
    console.error('[Fraud Cron] Fatal error in fraud detection:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run fraud detection',
      },
      { status: 500 }
    );
  }
}

async function createFraudAlert(data: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  vendorId: string;
  description: string;
  metadata: any;
}): Promise<void> {
  const riskScoreBySeverity = {
    low: 30,
    medium: 55,
    high: 75,
    critical: 95,
  } satisfies Record<typeof data.severity, number>;

  await db.insert(fraudAlerts).values({
    entityType: 'vendor',
    entityId: data.vendorId,
    riskScore: riskScoreBySeverity[data.severity],
    flagReasons: [data.type, data.description],
    status: 'pending',
    metadata: {
      ...data.metadata,
      source: 'cron_detect_fraud',
      riskLevel: data.severity,
      reasonCodes: [data.type],
      failedChecks: [data.type],
    },
  });

  console.log(`[Fraud Cron] Created fraud alert: ${data.type} (${data.severity}) for vendor ${data.vendorId}`);
}
