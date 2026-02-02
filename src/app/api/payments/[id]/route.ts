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

    // Fetch payment with related data
    const [payment] = await db
      .select({
        payment: payments,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Verify the payment belongs to the current user's vendor account
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor || vendor.id !== payment.payment.vendorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
