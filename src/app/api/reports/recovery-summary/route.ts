import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';

interface RecoverySummaryRow {
  case_id: string;
  claim_reference: string;
  asset_type: string;
  market_value: string | null;
  created_at: Date;
  payment_amount: string | null;
}

/**
 * GET /api/reports/recovery-summary
 * Generate recovery summary report with date range filtering
 * 
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * 
 * Returns:
 * - totalCases: number of cases in date range
 * - totalMarketValue: sum of market values
 * - totalRecoveryValue: sum of winning bids
 * - averageRecoveryRate: percentage
 * - casesByAssetType: breakdown by vehicle/property/electronics
 * - recoveryTrend: daily recovery rates
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !['salvage_manager', 'system_admin'].includes(session.user.role)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only Salvage Managers and Admins can access reports',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format. Use ISO date strings',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const recoveryResult = await db.execute(sql`
      WITH latest_case_recovery AS (
        SELECT DISTINCT ON (sc.id)
          sc.id AS case_id,
          sc.claim_reference,
          sc.asset_type,
          sc.market_value,
          sc.created_at,
          COALESCE(a.final_settled_amount, p.amount) AS payment_amount
        FROM salvage_cases sc
        INNER JOIN auctions a ON a.case_id = sc.id
        INNER JOIN payments p ON p.auction_id = a.id
        WHERE sc.created_at >= ${startISO}::timestamptz
          AND sc.created_at <= ${endISO}::timestamptz
          AND p.status = 'verified'
          AND p.auction_id IS NOT NULL
          AND p.vendor_id = a.current_bidder
        ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
      )
      SELECT *
      FROM latest_case_recovery
      ORDER BY created_at DESC
    `);
    const casesWithAuctions = Array.from(
      recoveryResult as unknown as Iterable<RecoverySummaryRow>
    );

    // Calculate summary statistics
    let totalMarketValue = 0;
    let totalRecoveryValue = 0;
    const casesByAssetType: Record<string, { count: number; marketValue: number; recoveryValue: number }> = {
      vehicle: { count: 0, marketValue: 0, recoveryValue: 0 },
      property: { count: 0, marketValue: 0, recoveryValue: 0 },
      electronics: { count: 0, marketValue: 0, recoveryValue: 0 },
    };

    const dailyRecovery: Record<string, { marketValue: number; recoveryValue: number; count: number }> = {};

    for (const row of casesWithAuctions) {
      const marketValue = parseFloat(row.market_value || '0');
      const recoveryValue = parseFloat(row.payment_amount || '0');

      totalMarketValue += marketValue;
      totalRecoveryValue += recoveryValue;

      // By asset type
      const assetType = row.asset_type as string;
      if (casesByAssetType[assetType]) {
        casesByAssetType[assetType].count++;
        casesByAssetType[assetType].marketValue += marketValue;
        casesByAssetType[assetType].recoveryValue += recoveryValue;
      }

      // Daily trend
      const dateKey = new Date(row.created_at).toISOString().split('T')[0];
      if (!dailyRecovery[dateKey]) {
        dailyRecovery[dateKey] = { marketValue: 0, recoveryValue: 0, count: 0 };
      }
      dailyRecovery[dateKey].marketValue += marketValue;
      dailyRecovery[dateKey].recoveryValue += recoveryValue;
      dailyRecovery[dateKey].count++;
    }

    // Calculate recovery rates
    const averageRecoveryRate = totalMarketValue > 0 ? (totalRecoveryValue / totalMarketValue) * 100 : 0;

    const assetTypeBreakdown = Object.entries(casesByAssetType).map(([type, data]) => ({
      assetType: type,
      count: data.count,
      marketValue: data.marketValue,
      recoveryValue: data.recoveryValue,
      recoveryRate: data.marketValue > 0 ? (data.recoveryValue / data.marketValue) * 100 : 0,
    }));

    const recoveryTrend = Object.entries(dailyRecovery)
      .map(([date, data]) => ({
        date,
        marketValue: data.marketValue,
        recoveryValue: data.recoveryValue,
        recoveryRate: data.marketValue > 0 ? (data.recoveryValue / data.marketValue) * 100 : 0,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      status: 'success',
      data: {
        summary: {
          totalCases: casesWithAuctions.length,
          totalMarketValue: Math.round(totalMarketValue * 100) / 100,
          totalRecoveryValue: Math.round(totalRecoveryValue * 100) / 100,
          averageRecoveryRate: Math.round(averageRecoveryRate * 100) / 100,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        byAssetType: assetTypeBreakdown,
        trend: recoveryTrend,
      },
    });
  } catch (error) {
    console.error('Recovery summary report error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate recovery summary report',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
