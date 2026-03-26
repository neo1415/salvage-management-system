import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: paymentId } = await params;

    // Fetch payment with related data including vendor details
    const [payment] = await db
      .select({
        payment: payments,
        auction: auctions,
        case: salvageCases,
        vendor: vendors,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // SECURITY FIX: IDOR Protection - Verify ownership
    // Only allow access if:
    // 1. User is the vendor who owns this payment
    // 2. User is admin/manager/finance (authorized roles)
    const isOwner = payment.vendor.userId === session.user.id;
    const isAuthorizedRole = ['admin', 'salvage_manager', 'system_admin', 'finance_officer'].includes(session.user.role);

    if (!isOwner && !isAuthorizedRole) {
      console.warn(`⚠️  IDOR attempt: User ${session.user.id} tried to access payment ${paymentId} owned by ${payment.vendor.userId}`);
      return NextResponse.json({ error: 'Forbidden - You do not have permission to access this payment' }, { status: 403 });
    }

    // Format response
    const response = {
      id: payment.payment.id,
      auctionId: payment.payment.auctionId,
      amount: payment.payment.amount,
      status: payment.payment.status,
      paymentDeadline: payment.payment.paymentDeadline.toISOString(),
      paymentMethod: payment.payment.paymentMethod,
      paymentReference: payment.payment.paymentReference,
      paymentProofUrl: payment.payment.paymentProofUrl,
      createdAt: payment.payment.createdAt.toISOString(),
      vendor: {
        id: payment.vendor.id,
        businessName: payment.vendor.businessName,
        tier: payment.vendor.tier,
        status: payment.vendor.status,
        bankAccountNumber: payment.vendor.bankAccountNumber,
        bankName: payment.vendor.bankName,
        bankAccountName: payment.vendor.bankAccountName,
      },
      auction: {
        id: payment.auction.id,
        caseId: payment.auction.caseId,
        currentBid: payment.auction.currentBid,
        case: {
          claimReference: payment.case.claimReference,
          assetType: payment.case.assetType,
          assetDetails: payment.case.assetDetails,
          marketValue: payment.case.marketValue,
          estimatedSalvageValue: payment.case.estimatedSalvageValue,
          locationName: payment.case.locationName,
          photos: payment.case.photos,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching payment:', error);
    
    // SECURITY FIX: Sanitize error messages - don't expose database/internal details
    return NextResponse.json(
      { error: 'Failed to retrieve payment details. Please try again.' },
      { status: 500 }
    );
  }
}
