import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { escrowService } from '@/features/payments/services/escrow.service';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/payments/[id]/release-funds
 * Manually trigger fund release (Finance Officer only)
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 4
 * 
 * Acceptance Criteria:
 * - Only Finance Officers can access this endpoint
 * - Verify payment exists and is escrow_wallet type
 * - Verify escrow status is 'frozen'
 * - Call escrowService.releaseFunds() to transfer funds
 * - Update payment status to 'verified'
 * - Update case status to 'sold'
 * - Create audit log entry with Finance Officer ID and reason
 * - Return transfer reference and updated payment status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is Finance Officer
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden: Only Finance Officers can manually release funds' },
        { status: 403 }
      );
    }

    const { id: paymentId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paymentId)) {
      return NextResponse.json(
        { error: 'Invalid payment ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    // Validate required fields
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required for manual fund release' },
        { status: 400 }
      );
    }

    // Get payment details
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

    // Verify payment method is escrow_wallet
    if (payment.paymentMethod !== 'escrow_wallet') {
      return NextResponse.json(
        { error: `Cannot release funds for payment method: ${payment.paymentMethod}. Only escrow_wallet payments can be released.` },
        { status: 400 }
      );
    }

    // Verify escrow status is frozen
    if (payment.escrowStatus !== 'frozen') {
      return NextResponse.json(
        { error: `Cannot release funds with escrow status: ${payment.escrowStatus}. Expected frozen.` },
        { status: 400 }
      );
    }

    // Verify payment status is pending or wallet_confirmed
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot release funds for payment with status: ${payment.status}. Payment must be pending.` },
        { status: 400 }
      );
    }

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Release funds via escrow service
    const amount = parseFloat(payment.amount);
    let transferReference: string;

    try {
      await escrowService.releaseFunds(
        payment.vendorId,
        amount,
        payment.auctionId,
        session.user.id
      );

      // Generate transfer reference for response
      transferReference = `TRANSFER_${payment.auctionId.substring(0, 8)}_${Date.now()}`;
    } catch (error) {
      console.error('Error releasing funds:', error);
      
      // Log failed release attempt
      await logAction({
        userId: session.user.id,
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: getIpAddress(request.headers),
        deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
        userAgent: request.headers.get('user-agent') || 'unknown',
        beforeState: {
          status: payment.status,
          escrowStatus: payment.escrowStatus,
        },
        afterState: {
          error: error instanceof Error ? error.message : 'Unknown error',
          manualRelease: true,
          financeOfficerId: session.user.id,
          financeOfficerName: user.fullName,
          reason: reason.trim(),
        },
      });

      return NextResponse.json(
        {
          error: 'Failed to release funds',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Update payment status to verified
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'verified',
        escrowStatus: 'released',
        verifiedAt: new Date(),
        autoVerified: false, // Manual release
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    // Update case status to sold
    if (auction.caseId) {
      await db
        .update(salvageCases)
        .set({
          status: 'sold',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, auction.caseId));
    }

    // Log successful manual release
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.FUNDS_RELEASED,
      entityType: AuditEntityType.PAYMENT,
      entityId: paymentId,
      ipAddress: getIpAddress(request.headers),
      deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: {
        status: payment.status,
        escrowStatus: payment.escrowStatus,
      },
      afterState: {
        status: updatedPayment.status,
        escrowStatus: updatedPayment.escrowStatus,
        manualRelease: true,
        financeOfficerId: session.user.id,
        financeOfficerName: user.fullName,
        reason: reason.trim(),
        amount,
        transferReference,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Funds released manually by Finance Officer ${user.fullName}`,
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        escrowStatus: updatedPayment.escrowStatus,
        amount: parseFloat(updatedPayment.amount),
        verifiedAt: updatedPayment.verifiedAt,
      },
      transferReference,
      financeOfficer: {
        id: user.id,
        name: user.fullName,
      },
      reason: reason.trim(),
    });
  } catch (error) {
    console.error('Error in manual fund release endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to process manual fund release',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
