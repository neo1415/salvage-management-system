/**
 * Prediction Accuracy Trend API
 * 
 * GET /api/intelligence/admin/accuracy-trend
 * Returns daily prediction accuracy metrics for the specified time period
 * 
 * Task: 11.1.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { predictions } from '@/lib/db/schema/intelligence';
import { sql } from 'drizzle-orm';

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

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Calculate the date threshold in JavaScript
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const dateThresholdISO = dateThreshold.toISOString();

    // Calculate daily accuracy metrics
    const accuracyData = await db.execute(sql`
      WITH daily_predictions AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_predictions,
          COUNT(*) FILTER (WHERE actual_price IS NOT NULL) as completed_predictions,
          AVG(
            CASE 
              WHEN actual_price IS NOT NULL AND actual_price > 0
              THEN ABS((predicted_price - actual_price) / actual_price) * 100
              ELSE NULL
            END
          ) as avg_error_pct,
          AVG(confidence_score) as avg_confidence
        FROM ${predictions}
        WHERE created_at >= ${dateThresholdISO}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      )
      SELECT 
        date,
        total_predictions as predictions,
        completed_predictions,
        COALESCE(100 - avg_error_pct, 0) as accuracy,
        COALESCE(avg_error_pct, 0) as avg_error,
        avg_confidence
      FROM daily_predictions
      WHERE completed_predictions > 0
      ORDER BY date ASC
    `);

    return NextResponse.json({
      success: true,
      data: Array.from(accuracyData).map((row: any) => ({
        date: row.date,
        accuracy: parseFloat(row.accuracy),
        avgError: parseFloat(row.avg_error),
        predictions: parseInt(row.predictions, 10),
        confidence: parseFloat(row.avg_confidence || 0),
      })),
    });
  } catch (error) {
    console.error('Error fetching accuracy trend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accuracy trend' },
      { status: 500 }
    );
  }
}
