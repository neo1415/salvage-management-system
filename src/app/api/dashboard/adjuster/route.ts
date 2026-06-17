/**
 * Adjuster Dashboard API Route
 * 
 * GET /api/dashboard/adjuster - Get dashboard statistics for claims adjusters
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, sql, inArray, gt } from 'drizzle-orm';

/**
 * GET /api/dashboard/adjuster
 * Get dashboard statistics for the authenticated claims adjuster
 * 
 * Response:
 * {
 *   success: true;
 *   data: {
 *     totalCases: number;
 *     pendingApproval: number;
 *     approved: number;
 *     rejected: number;
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is a claims adjuster
    if (session.user.role !== 'claims_adjuster') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only claims adjusters can access this endpoint' },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Get total cases created by this adjuster
    const totalCasesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(eq(salvageCases.createdBy, userId));

    const totalCases = totalCasesResult[0]?.count || 0;

    // Get pending approval cases
    const pendingApprovalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'pending_approval')
        )
      );

    const pendingApproval = pendingApprovalResult[0]?.count || 0;

    // Get approved cases (cases that have been approved, regardless of current status)
    const { isNotNull } = await import('drizzle-orm');
    const approvedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          isNotNull(salvageCases.approvedBy)
        )
      );

    const approved = approvedResult[0]?.count || 0;

    console.log('Adjuster dashboard stats:', {
      userId,
      totalCases,
      pendingApproval,
      approved,
      approvedQuery: 'Cases with approvedBy IS NOT NULL',
    });

    // Manager returned cases (audit: case_rejected) — matches My Cases → Rejected tab
    const managerRejectedResult = await db
      .select({ count: sql<number>`count(distinct ${auditLogs.entityId})::int` })
      .from(auditLogs)
      .innerJoin(
        salvageCases,
        sql`${auditLogs.entityId} = ${salvageCases.id}::text`
      )
      .where(
        and(
          eq(auditLogs.actionType, 'case_rejected'),
          eq(auditLogs.entityType, 'case'),
          eq(salvageCases.createdBy, userId)
        )
      );

    const rejected = managerRejectedResult[0]?.count || 0;

    const cancelledResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'cancelled')
        )
      );

    const cancelled = cancelledResult[0]?.count || 0;

    // Get active auction cases
    // IMPORTANT: Do NOT use case status as a proxy for auction activity.
    // A case can remain `active_auction` even if the auction ended (or ended with no bids).
    // Active auctions must be counted from the auctions table using status + endTime.
    const now = new Date();
    const activeAuctionResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          inArray(auctions.status, ['active', 'extended']),
          gt(auctions.endTime, now)
        )
      );

    const activeAuction = activeAuctionResult[0]?.count || 0;

    // Get sold cases
    const soldResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'sold')
        )
      );

    const sold = soldResult[0]?.count || 0;

    const draftsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'draft')
        )
      );

    const drafts = draftsResult[0]?.count || 0;

    const [controlRow] = (await db.execute(sql`
      WITH case_scope AS (
        SELECT id, created_at, approved_at
        FROM salvage_cases
        WHERE created_by = ${userId}
      ),
      verified_winner_payments AS (
        SELECT DISTINCT ON (p.auction_id)
          p.auction_id,
          p.amount,
          p.verified_at,
          p.created_at
        FROM payments p
        INNER JOIN auctions a ON a.id = p.auction_id
        INNER JOIN case_scope cs ON cs.id = a.case_id
        WHERE p.status = 'verified'
          AND p.auction_id IS NOT NULL
          AND p.vendor_id = a.current_bidder
        ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
      )
      SELECT
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM verified_winner_payments) AS verified_recovery,
        AVG(EXTRACT(EPOCH FROM (cs.approved_at - cs.created_at)) / 86400.0) FILTER (
          WHERE cs.approved_at IS NOT NULL
          AND cs.approved_at >= cs.created_at
        )::numeric AS avg_days_to_approval
      FROM case_scope cs
    `)) as any[];

    const verifiedRecovery = numberFrom(controlRow?.verified_recovery);
    const averageDaysToApproval = nullableNumberFrom(controlRow?.avg_days_to_approval);

    return NextResponse.json(
      {
        success: true,
        data: {
          totalCases,
          pendingApproval,
          approved,
          rejected,
          cancelled,
          activeAuction,
          sold,
          assessmentControl: {
            drafts,
            pendingManagerReview: pendingApproval,
            returnedForRevision: rejected + cancelled,
            activeAuctions: activeAuction,
            soldCases: sold,
            verifiedRecovery,
            averageDaysToApproval,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/dashboard/adjuster:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard statistics',
      },
      { status: 500 }
    );
  }
}

function numberFrom(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}
