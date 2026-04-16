/**
 * Admin Intelligence Dashboard API Endpoint
 * 
 * GET /api/intelligence/admin/dashboard
 * 
 * Returns comprehensive intelligence system metrics for admin dashboard.
 * Task 7.6.1: Create GET /api/intelligence/admin/dashboard route
 * 
 * @module api/intelligence/admin/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { predictions, recommendations, fraudAlerts } from '@/lib/db/schema/intelligence';
import { sql, desc, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoISO = sixtyDaysAgo.toISOString();

    // Get prediction accuracy metrics with timeout protection
    let predictionMetrics: any;
    try {
      predictionMetrics = await Promise.race([
        db.execute(sql`
          SELECT 
            COUNT(*)::int AS total_predictions,
            COUNT(*) FILTER (WHERE actual_price IS NOT NULL)::int AS completed_predictions,
            AVG(ABS(predicted_price - actual_price) / NULLIF(actual_price, 0) * 100) AS mean_percentage_error,
            AVG(confidence_score) AS avg_confidence_score
          FROM ${predictions}
          WHERE created_at > ${thirtyDaysAgoISO}
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Prediction metrics query failed:', error);
      // Return default values if query fails
      predictionMetrics = [{ 
        total_predictions: 0, 
        completed_predictions: 0, 
        mean_percentage_error: 0, 
        avg_confidence_score: 0 
      }];
    }

    // Get recommendation effectiveness metrics with timeout protection
    let recommendationMetrics: any;
    try {
      recommendationMetrics = await Promise.race([
        db.execute(sql`
          SELECT 
            COUNT(*)::int AS total_recommendations,
            COUNT(*) FILTER (WHERE clicked = true)::int AS clicked_count,
            COUNT(*) FILTER (WHERE bid_placed = true)::int AS bid_placed_count,
            (COUNT(*) FILTER (WHERE clicked = true)::float / NULLIF(COUNT(*), 0) * 100) AS click_through_rate,
            (COUNT(*) FILTER (WHERE bid_placed = true)::float / NULLIF(COUNT(*) FILTER (WHERE clicked = true), 0) * 100) AS bid_conversion_rate,
            AVG(match_score) AS avg_match_score
          FROM ${recommendations}
          WHERE created_at > ${thirtyDaysAgoISO}
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Recommendation metrics query failed:', error);
      recommendationMetrics = [{ 
        total_recommendations: 0, 
        clicked_count: 0, 
        bid_placed_count: 0,
        click_through_rate: 0,
        bid_conversion_rate: 0,
        avg_match_score: 0
      }];
    }

    // Get fraud alert metrics with timeout protection
    let fraudMetrics: any;
    try {
      fraudMetrics = await Promise.race([
        db.execute(sql`
          SELECT 
            COUNT(*)::int AS total_alerts,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_alerts,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_alerts,
            AVG(risk_score) AS avg_risk_score
          FROM ${fraudAlerts}
          WHERE created_at > ${thirtyDaysAgoISO}
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Fraud metrics query failed:', error);
      fraudMetrics = [{ 
        total_alerts: 0, 
        pending_alerts: 0, 
        confirmed_alerts: 0,
        avg_risk_score: 0
      }];
    }

    // Get recent fraud alerts with timeout protection
    let recentAlerts: any[];
    try {
      recentAlerts = await Promise.race([
        db
          .select()
          .from(fraudAlerts)
          .where(gte(fraudAlerts.createdAt, new Date(thirtyDaysAgoISO)))
          .orderBy(desc(fraudAlerts.riskScore), desc(fraudAlerts.createdAt))
          .limit(10),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Recent alerts query failed:', error);
      recentAlerts = [];
    }

    // Calculate previous period metrics for change comparison with timeout protection
    let previousPredictionMetrics: any;
    try {
      previousPredictionMetrics = await Promise.race([
        db.execute(sql`
          SELECT 
            AVG(ABS(predicted_price - actual_price) / NULLIF(actual_price, 0) * 100) AS mean_percentage_error
          FROM ${predictions}
          WHERE created_at BETWEEN ${sixtyDaysAgoISO} AND ${thirtyDaysAgoISO}
            AND actual_price IS NOT NULL
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Previous prediction metrics query failed:', error);
      previousPredictionMetrics = [{ mean_percentage_error: 0 }];
    }

    let previousRecommendationMetrics: any;
    try {
      previousRecommendationMetrics = await Promise.race([
        db.execute(sql`
          SELECT 
            (COUNT(*) FILTER (WHERE bid_placed = true)::float / NULLIF(COUNT(*) FILTER (WHERE clicked = true), 0) * 100) AS bid_conversion_rate
          FROM ${recommendations}
          WHERE created_at BETWEEN ${sixtyDaysAgoISO} AND ${thirtyDaysAgoISO}
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Previous recommendation metrics query failed:', error);
      previousRecommendationMetrics = [{ bid_conversion_rate: 0 }];
    }

    const currentAccuracy = 100 - parseFloat(predictionMetrics[0]?.mean_percentage_error || '0');
    const previousAccuracy = 100 - parseFloat(previousPredictionMetrics[0]?.mean_percentage_error || '0');
    const accuracyChange = currentAccuracy - previousAccuracy;

    const currentBidConversion = parseFloat(recommendationMetrics[0]?.bid_conversion_rate || '0');
    const previousBidConversion = parseFloat(previousRecommendationMetrics[0]?.bid_conversion_rate || '0');
    const conversionChange = currentBidConversion - previousBidConversion;

    // Get dismissed count with timeout protection
    let dismissedCount: any;
    try {
      dismissedCount = await Promise.race([
        db.execute(sql`
          SELECT COUNT(*)::int AS dismissed_count
          FROM ${fraudAlerts}
          WHERE status = 'dismissed'
            AND created_at > ${thirtyDaysAgoISO}
        `),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error('[Admin Dashboard API] Dismissed count query failed:', error);
      dismissedCount = [{ dismissed_count: 0 }];
    }

    return NextResponse.json({
      predictionAccuracy: {
        current: currentAccuracy,
        change: accuracyChange,
        avgError: parseFloat(predictionMetrics[0]?.mean_percentage_error || '0'),
        totalPredictions: predictionMetrics[0]?.total_predictions || 0,
      },
      recommendationEffectiveness: {
        bidConversionRate: currentBidConversion,
        change: conversionChange,
        avgMatchScore: parseFloat(recommendationMetrics[0]?.avg_match_score || '0'),
        totalRecommendations: recommendationMetrics[0]?.total_recommendations || 0,
      },
      fraudAlerts: {
        pending: fraudMetrics[0]?.pending_alerts || 0,
        confirmed: fraudMetrics[0]?.confirmed_alerts || 0,
        dismissed: dismissedCount[0]?.dismissed_count || 0,
        total: fraudMetrics[0]?.total_alerts || 0,
      },
      systemHealth: {
        cacheHitRate: 85.0, // TODO: Get from Redis stats
        avgResponseTime: 150, // TODO: Calculate from actual metrics
        jobsRunning: 6, // TODO: Get from job manager
        lastRefresh: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Admin Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
