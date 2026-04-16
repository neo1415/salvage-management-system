/**
 * Intelligence System Health Check Endpoint
 * Task 13.5.1: Implement health check endpoints
 * 
 * GET /api/intelligence/health
 * 
 * Returns health status of intelligence system components
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { redis } from '@/lib/cache/redis';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // Check database connectivity
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis cache
    try {
      const pingStart = Date.now();
      await redis.ping();
      checks.redis = {
        status: 'healthy',
        responseTime: Date.now() - pingStart,
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check intelligence tables exist
    try {
      const tables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'predictions', 
            'recommendations', 
            'interactions', 
            'fraud_alerts',
            'asset_performance_analytics',
            'vendor_bidding_patterns_mv',
            'market_conditions_mv'
          )
      `);
      
      const tableNames = tables.map((t: any) => t.table_name);
      const requiredTables = [
        'predictions',
        'recommendations',
        'interactions',
        'fraud_alerts',
        'asset_performance_analytics',
      ];
      
      const missingTables = requiredTables.filter(t => !tableNames.includes(t));
      
      checks.intelligenceTables = {
        status: missingTables.length === 0 ? 'healthy' : 'unhealthy',
        tablesFound: tableNames.length,
        missingTables: missingTables.length > 0 ? missingTables : undefined,
      };
    } catch (error) {
      checks.intelligenceTables = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check materialized views
    try {
      const views = await db.execute(sql`
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
          AND matviewname IN ('vendor_bidding_patterns_mv', 'market_conditions_mv')
      `);
      
      checks.materializedViews = {
        status: views.length === 2 ? 'healthy' : 'degraded',
        viewsFound: views.length,
        expectedViews: 2,
      };
    } catch (error) {
      checks.materializedViews = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check recent predictions
    try {
      const recentPredictions: any = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM predictions
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      
      checks.predictions = {
        status: 'healthy',
        recentCount: parseInt(recentPredictions[0]?.count || '0'),
      };
    } catch (error) {
      checks.predictions = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check recent recommendations
    try {
      const recentRecommendations: any = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM recommendations
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      
      checks.recommendations = {
        status: 'healthy',
        recentCount: parseInt(recentRecommendations[0]?.count || '0'),
      };
    } catch (error) {
      checks.recommendations = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Overall health status
    const allHealthy = Object.values(checks).every(
      (check: any) => check.status === 'healthy' || check.status === 'degraded'
    );

    const overallStatus = allHealthy ? 'healthy' : 'unhealthy';
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        checks,
        version: process.env.INTELLIGENCE_ALGORITHM_VERSION || 'v1.2.0',
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('[Intelligence Health Check] Error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checks,
      },
      { status: 503 }
    );
  }
}
