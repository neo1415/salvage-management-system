/**
 * GET /api/payments/[id]/audit-logs
 * 
 * Fetch audit trail for a specific payment
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 6
 * Task 7.3.1: Integrate EscrowPaymentAuditTrail into payment details modal
 * 
 * Features:
 * - Fetch all audit logs related to a payment
 * - Include user information (name) for each log entry
 * - Filter by payment-related action types
 * - Sort by createdAt descending (most recent first)
 * - Finance Officer authorization required
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, or, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if user is Finance Officer
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden: Finance Officer access required' },
        { status: 403 }
      );
    }

    // Await params in Next.js 15+
    const { id: paymentId } = await params;

    // 3. Verify payment exists
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // 4. Fetch audit logs for this payment
    // Include payment-related action types
    const paymentActionTypes = [
      'payment_initiated',
      'payment_verified',
      'payment_auto_verified',
      'payment_rejected',
      'wallet_funded',
      'funds_frozen',
      'funds_released',
      'funds_unfrozen',
      'document_signing_progress',
      'document_signed',
      'pickup_confirmed_vendor',
      'pickup_confirmed_admin',
    ];

    const logs = await db
      .select({
        id: auditLogs.id,
        actionType: auditLogs.actionType,
        userId: auditLogs.userId,
        userName: users.fullName,
        ipAddress: auditLogs.ipAddress,
        deviceType: auditLogs.deviceType,
        userAgent: auditLogs.userAgent,
        beforeState: auditLogs.beforeState,
        afterState: auditLogs.afterState,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.entityId, paymentId),
          or(
            eq(auditLogs.entityType, 'payment'),
            eq(auditLogs.entityType, 'wallet'),
            eq(auditLogs.entityType, 'document')
          )
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    // 5. Format response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      actionType: log.actionType,
      userId: log.userId,
      userName: log.userName || 'Unknown User',
      ipAddress: log.ipAddress,
      deviceType: log.deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent: log.userAgent,
      beforeState: log.beforeState || undefined,
      afterState: log.afterState || undefined,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      auditLogs: formattedLogs,
      count: formattedLogs.length,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
