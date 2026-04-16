/**
 * Match Score Distribution API Endpoint
 * 
 * GET /api/intelligence/admin/match-score-distribution
 * 
 * Returns recommendation match score distribution for bar chart
 * Task: 11.1.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recommendations } from '@/lib/db/schema/intelligence';
import { sql } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
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

    // Get match score distribution
    const distribution: any = await db.execute(sql`
      WITH score_ranges AS (
        SELECT 
          CASE 
            WHEN match_score::numeric >= 80 THEN '80-100'
            WHEN match_score::numeric >= 60 THEN '60-79'
            WHEN match_score::numeric >= 40 THEN '40-59'
            WHEN match_score::numeric >= 20 THEN '20-39'
            ELSE '0-19'
          END AS range,
          COUNT(*)::int AS count
        FROM ${recommendations}
        WHERE created_at >= ${thirtyDaysAgoISO}
        GROUP BY range
      )
      SELECT 
        range,
        count,
        (count::float / SUM(count) OVER () * 100) AS percentage
      FROM score_ranges
      ORDER BY 
        CASE range
          WHEN '80-100' THEN 1
          WHEN '60-79' THEN 2
          WHEN '40-59' THEN 3
          WHEN '20-39' THEN 4
          ELSE 5
        END
    `);

    const formattedData = distribution.map((row: any) => ({
      range: row.range,
      count: parseInt(row.count || '0'),
      percentage: parseFloat(row.percentage || '0'),
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      meta: {
        period: '30 days',
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Match Score Distribution API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
