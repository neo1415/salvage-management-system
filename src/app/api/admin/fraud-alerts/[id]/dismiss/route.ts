/**
 * Fraud Alert Dismiss API - POST Handler
 * Allows admin to dismiss a fraud flag (false positive)
 * 
 * Requirements:
 * - Requirement 35: Fraud Alert Review
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';

/**
 * POST /api/admin/fraud-alerts/[id]/dismiss
 * Dismiss a fraud flag (false positive)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id: auctionId } = await params;
    
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== 'string' || comment.trim().length < 10) {
      return NextResponse.json(
        { error: 'Comment is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // Get the fraud flag audit log
    const fraudLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.entityId, auctionId),
    });

    if (!fraudLog) {
      return NextResponse.json(
        { error: 'Fraud alert not found' },
        { status: 404 }
      );
    }

    // Create audit log for dismissal
    const auditData = createAuditLogData(
      request,
      session.user.id,
      AuditActionType.FRAUD_FLAG_DISMISSED,
      AuditEntityType.FRAUD_FLAG,
      auctionId,
      {
        fraudLogId: fraudLog.id,
        originalPatterns: (fraudLog.afterState as { patterns?: string[] })?.patterns || [],
      },
      {
        dismissedBy: session.user.id,
        dismissedByName: user.fullName,
        comment: comment.trim(),
        dismissedAt: new Date().toISOString(),
      }
    );

    await logAction(auditData);

    return NextResponse.json({
      success: true,
      message: 'Fraud flag dismissed successfully',
      auctionId,
      dismissedBy: user.fullName,
      dismissedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to dismiss fraud flag:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss fraud flag' },
      { status: 500 }
    );
  }
}
