import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bids } from '@/lib/db/schema/auctions';
import { fraudAlerts } from '@/lib/db/schema/fraud-detection';
import { gte, sql } from 'drizzle-orm';
import { shillBiddingDetectionService } from '@/features/fraud/services/shill-bidding-detection.service';
import { paymentFraudDetectionService } from '@/features/fraud/services/payment-fraud-detection.service';
import crypto from 'crypto';

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
  console.log('🔍 Starting daily fraud detection...\n');
  
  const startTime = Date.now();
  let totalVendorsAnalyzed = 0;
  let shillBiddingAlertsCreated = 0;
  let paymentFraudAlertsCreated = 0;
  let errorCount = 0;
  
  try {
    // Get all vendors who bid in last 7 days
    const recentBidders = await db.execute(sql`
      SELECT DISTINCT vendor_id
      FROM bids
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    const vendorIds = Array.isArray(recentBidders) 
      ? recentBidders.map((row: any) => row.vendor_id)
      : [];
    
    console.log(`📊 Found ${vendorIds.length} vendors with recent bidding activity\n`);
    
    // Analyze each vendor
    for (const vendorId of vendorIds) {
      try {
        console.log(`\n🔄 Analyzing vendor: ${vendorId}`);
        
        // 1. Shill Bidding Detection
        const shillAnalysis = await shillBiddingDetectionService.analyzeVendorForShillBidding(vendorId);
        
        if (shillAnalysis.totalScore >= 60) {
          console.log(`🚨 Shill bidding detected! Score: ${shillAnalysis.totalScore}`);
          
          await createFraudAlert({
            type: 'shill_bidding',
            severity: shillAnalysis.riskLevel === 'critical' ? 'critical' : 'high',
            vendorId,
            description: `Shill bidding pattern detected (Score: ${shillAnalysis.totalScore}/100)`,
            metadata: shillAnalysis,
          });
          
          shillBiddingAlertsCreated++;
        }
        
        // 2. Payment Fraud Detection
        const paymentAnalysis = await paymentFraudDetectionService.analyzeVendorForPaymentFraud(vendorId);
        
        if (paymentAnalysis.totalScore >= 60) {
          console.log(`🚨 Payment fraud detected! Score: ${paymentAnalysis.totalScore}`);
          
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
        
        // Log summary for this vendor
        if (shillAnalysis.totalScore < 60 && paymentAnalysis.totalScore < 60) {
          console.log(`✅ No fraud detected for vendor ${vendorId}`);
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing vendor ${vendorId}:`, error);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FRAUD DETECTION COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Vendors Analyzed: ${totalVendorsAnalyzed}`);
    console.log(`🚨 Shill Bidding Alerts: ${shillBiddingAlertsCreated}`);
    console.log(`🚨 Payment Fraud Alerts: ${paymentFraudAlertsCreated}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(60)}\n`);
    
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
    console.error('\n❌ Fatal error in fraud detection:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run fraud detection',
      },
      { status: 500 }
    );
  }
}

/**
 * Create a fraud alert
 */
async function createFraudAlert(data: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  vendorId: string;
  description: string;
  metadata: any;
}): Promise<void> {
  try {
    await db.insert(fraudAlerts).values({
      id: crypto.randomUUID(),
      severity: data.severity,
      type: data.type,
      description: data.description,
      userId: data.vendorId,
      metadata: data.metadata,
      status: 'pending',
      createdAt: new Date(),
    });
    
    console.log(`✅ Fraud alert created: ${data.type} (${data.severity})`);
  } catch (error) {
    console.error('❌ Failed to create fraud alert:', error);
    throw error;
  }
}
