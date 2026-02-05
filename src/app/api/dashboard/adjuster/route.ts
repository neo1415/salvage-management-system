/**
 * Adjuster Dashboard API Route
 * 
 * GET /api/dashboard/adjuster - Get dashboard statistics for claims adjusters
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, sql } from 'drizzle-orm';

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

    // Get approved cases
    const approvedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'approved')
        )
      );

    const approved = approvedResult[0]?.count || 0;

    // Get cancelled cases (treating as "rejected")
    const rejectedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, userId),
          eq(salvageCases.status, 'cancelled')
        )
      );

    const rejected = rejectedResult[0]?.count || 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          totalCases,
          pendingApproval,
          approved,
          rejected,
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
