/**
 * Privacy Data Export API Endpoint
 * 
 * GET /api/intelligence/privacy/export
 * 
 * Export all intelligence data for requesting user (GDPR compliance).
 * Task 7.7.1: Create GET /api/intelligence/privacy/export route
 * 
 * Security: Requires authentication
 * 
 * @module api/intelligence/privacy/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { predictions, recommendations, interactions } from '@/lib/db/schema/intelligence';
import { vendors } from '@/lib/db/schema/vendors';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/intelligence/privacy/export
 * 
 * Export all intelligence data for user
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's vendor ID
    const vendorData = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendorData || vendorData.length === 0) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    const vendorId = vendorData[0].id;

    // Get all predictions for user's auctions
    const userPredictions: any = await db.execute(sql`
      SELECT 
        p.id,
        p.auction_id,
        p.predicted_price,
        p.lower_bound,
        p.upper_bound,
        p.confidence_score,
        p.confidence_level,
        p.method,
        p.created_at
      FROM ${predictions} p
      INNER JOIN auctions a ON p.auction_id = a.id
      INNER JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE sc.user_id = ${session.user.id}
      ORDER BY p.created_at DESC
    `);

    // Get all recommendations for user's vendor
    const userRecommendations = await db
      .select({
        id: recommendations.id,
        auctionId: recommendations.auctionId,
        matchScore: recommendations.matchScore,
        collaborativeScore: recommendations.collaborativeScore,
        contentScore: recommendations.contentScore,
        reasonCodes: recommendations.reasonCodes,
        clicked: recommendations.clicked,
        bidPlaced: recommendations.bidPlaced,
        createdAt: recommendations.createdAt,
      })
      .from(recommendations)
      .where(eq(recommendations.vendorId, vendorId))
      .orderBy(sql`${recommendations.createdAt} DESC`)
      .limit(1000);

    // Get all interactions for user's vendor
    const userInteractions = await db
      .select({
        id: interactions.id,
        auctionId: interactions.auctionId,
        eventType: interactions.eventType,
        sessionId: interactions.sessionId,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .where(eq(interactions.vendorId, vendorId))
      .orderBy(sql`${interactions.createdAt} DESC`)
      .limit(1000);

    // Anonymize sensitive data
    const exportData = {
      user: {
        id: session.user.id,
        email: 'REDACTED', // Anonymize email
        exportDate: new Date().toISOString(),
      },
      predictions: userPredictions.map((p: any) => ({
        id: p.id,
        auctionId: p.auction_id,
        predictedPrice: parseFloat(p.predicted_price),
        lowerBound: parseFloat(p.lower_bound),
        upperBound: parseFloat(p.upper_bound),
        confidenceScore: parseFloat(p.confidence_score),
        confidenceLevel: p.confidence_level,
        method: p.method,
        createdAt: p.created_at,
      })),
      recommendations: userRecommendations.map(r => ({
        id: r.id,
        auctionId: r.auctionId,
        matchScore: parseFloat(r.matchScore),
        collaborativeScore: parseFloat(r.collaborativeScore),
        contentScore: parseFloat(r.contentScore),
        reasonCodes: r.reasonCodes,
        clicked: r.clicked,
        bidPlaced: r.bidPlaced,
        createdAt: r.createdAt,
      })),
      interactions: userInteractions.map(i => ({
        id: i.id,
        auctionId: i.auctionId,
        eventType: i.eventType,
        sessionId: i.sessionId,
        createdAt: i.createdAt,
      })),
      summary: {
        totalPredictions: userPredictions.length,
        totalRecommendations: userRecommendations.length,
        totalInteractions: userInteractions.length,
      },
    };

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'privacy_data_exported',
      entityType: 'user',
      entityId: session.user.id,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        recordCount: exportData.summary,
      },
    });

    return NextResponse.json({
      success: true,
      data: exportData,
    }, { status: 200 });

  } catch (error) {
    console.error('[Privacy Export API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
