import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, and } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/payments/[id]/confirm-wallet
 * Confirm vendor wants to pay from frozen wallet funds
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 1
 * 
 * Acceptance Criteria:
 * - Verify payment exists and belongs to vendor
 * - Verify payment method is 'escrow_wallet'
 * - Verify escrow status is 'frozen'
 * - Verify sufficient frozen funds in wallet
 * - Update payment status to 'pending' (wallet confirmed)
 * - Return payment details and documents URL
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
    const { vendorId } = body;

    // Validate required fields
    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    // Verify vendor exists and belongs to current user
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    if (vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Vendor does not belong to current user' },
        { status: 403 }
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

    // Verify payment belongs to vendor
    if (payment.vendorId !== vendorId) {
      return NextResponse.json(
        { error: 'Unauthorized: Payment does not belong to vendor' },
        { status: 403 }
      );
    }

    // Verify payment method is escrow_wallet
    if (payment.paymentMethod !== 'escrow_wallet') {
      return NextResponse.json(
        { error: `Invalid payment method: ${payment.paymentMethod}. Expected escrow_wallet` },
        { status: 400 }
      );
    }

    // Verify escrow status is frozen
    if (payment.escrowStatus !== 'frozen') {
      return NextResponse.json(
        { error: `Invalid escrow status: ${payment.escrowStatus}. Expected frozen` },
        { status: 400 }
      );
    }

    // Verify payment status is pending
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment status is ${payment.status}. Cannot confirm wallet payment` },
        { status: 400 }
      );
    }

    // Get vendor wallet
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Verify sufficient frozen funds
    const paymentAmount = parseFloat(payment.amount);
    const frozenAmount = parseFloat(wallet.frozenAmount);

    if (frozenAmount < paymentAmount) {
      return NextResponse.json(
        { 
          error: 'Insufficient frozen funds',
          details: {
            required: paymentAmount,
            available: frozenAmount,
            shortfall: paymentAmount - frozenAmount,
          }
        },
        { status: 400 }
      );
    }

    // Update payment status to pending (wallet confirmed)
    // Note: We keep status as 'pending' but the fact that payment method is escrow_wallet
    // and escrow status is frozen indicates wallet payment is confirmed
    const [updatedPayment] = await db
      .update(payments)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    // Log activity
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.PAYMENT_INITIATED,
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
        walletConfirmed: true,
        frozenAmount,
      },
    });

    // Generate documents URL
    const documentsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/vendor/documents?auctionId=${payment.auctionId}`;

    return NextResponse.json({
      success: true,
      message: 'Wallet payment confirmed. Please sign all documents to complete payment.',
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        escrowStatus: updatedPayment.escrowStatus,
        amount: parseFloat(updatedPayment.amount),
        paymentMethod: updatedPayment.paymentMethod,
      },
      wallet: {
        frozenAmount,
        confirmedAmount: paymentAmount,
      },
      documentsUrl,
    });
  } catch (error) {
    console.error('Error confirming wallet payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to confirm wallet payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
