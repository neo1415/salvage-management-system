/**
 * Prediction Inspection API Endpoint
 * 
 * GET /api/intelligence/admin/inspect/[predictionId]
 * 
 * Inspect detailed prediction breakdown for debugging and analysis.
 * Task 7.6.3: Create GET /api/intelligence/admin/inspect/[predictionId] route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/admin/inspect
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { predictions } from '@/lib/db/schema/intelligence';
import { predictionLogs } from '@/lib/db/schema/ml-training';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * GET /api/intelligence/admin/inspect/[predictionId]
 * 
 * Get detailed prediction breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { predictionId: string } }
) {
  try {
    // Authentication check
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Authorization: Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const predictionId = params.predictionId;

    // Get prediction details
    const predictionData = await db
      .select({
        prediction: predictions,
        auction: auctions,
        case: salvageCases,
      })
      .from(predictions)
      .innerJoin(auctions, eq(predictions.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(predictions.id, predictionId))
      .limit(1);

    if (!predictionData || predictionData.length === 0) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      );
    }

    const { prediction, auction, case: caseData } = predictionData[0];

    // Get prediction logs for algorithm steps
    const logs = await db
      .select()
      .from(predictionLogs)
      .where(eq(predictionLogs.predictionId, predictionId))
      .orderBy(desc(predictionLogs.createdAt))
      .limit(1);

    const algorithmSteps = logs.length > 0 ? logs[0].calculationDetails : null;

    // Find similar auctions used in prediction
    const similarAuctions: any = await db.execute(sql`
      WITH similar_auctions AS (
        SELECT 
          a.id,
          a.current_bid,
          sc.asset_type,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          a.end_time,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE 
          a.status = 'closed'
          AND a.current_bid IS NOT NULL
          AND sc.asset_type = ${caseData.assetType}
          AND a.end_time > NOW() - INTERVAL '12 months'
          AND a.id != ${auction.id}
        GROUP BY a.id, sc.id
        ORDER BY a.end_time DESC
        LIMIT 10
      )
      SELECT * FROM similar_auctions
    `);

    // Get market conditions
    const marketConditions: any = await db.execute(sql`
      WITH recent_auctions AS (
        SELECT 
          COUNT(*) AS total_auctions,
          AVG(a.current_bid) AS avg_price,
          AVG(bid_counts.bid_count) AS avg_bids
        FROM ${auctions} a
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN (
          SELECT auction_id, COUNT(*) AS bid_count
          FROM ${bids}
          GROUP BY auction_id
        ) bid_counts ON bid_counts.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time > NOW() - INTERVAL '30 days'
          AND sc.asset_type = ${caseData.assetType}
      )
      SELECT * FROM recent_auctions
    `);

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'prediction_inspected',
      entityType: 'prediction',
      entityId: predictionId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        auctionId: auction.id,
        predictedPrice: prediction.predictedPrice,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        prediction: {
          id: prediction.id,
          auctionId: prediction.auctionId,
          predictedPrice: prediction.predictedPrice,
          lowerBound: prediction.lowerBound,
          upperBound: prediction.upperBound,
          confidenceScore: prediction.confidenceScore,
          confidenceLevel: prediction.confidenceLevel,
          method: prediction.method,
          sampleSize: prediction.sampleSize,
          metadata: prediction.metadata,
          algorithmVersion: prediction.algorithmVersion,
          createdAt: prediction.createdAt,
        },
        auction: {
          id: auction.id,
          status: auction.status,
          currentBid: auction.currentBid,
          watchingCount: auction.watchingCount,
          endTime: auction.endTime,
        },
        case: {
          id: caseData.id,
          assetType: caseData.assetType,
          assetDetails: caseData.assetDetails,
          damageSeverity: caseData.damageSeverity,
          marketValue: caseData.marketValue,
          estimatedSalvageValue: caseData.estimatedSalvageValue,
        },
        similarAuctions: similarAuctions.map((a: any) => ({
          id: a.id,
          finalPrice: parseFloat(a.current_bid),
          assetDetails: a.asset_details,
          damageSeverity: a.damage_severity,
          marketValue: parseFloat(a.market_value),
          bidCount: parseInt(a.bid_count),
          endTime: a.end_time,
        })),
        marketConditions: marketConditions.length > 0 ? {
          totalAuctions: parseInt(marketConditions[0].total_auctions || '0'),
          avgPrice: parseFloat(marketConditions[0].avg_price || '0'),
          avgBids: parseFloat(marketConditions[0].avg_bids || '0'),
        } : null,
        algorithmSteps,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Prediction Inspection API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
