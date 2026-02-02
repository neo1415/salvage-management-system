import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { initiatePayment } from '@/features/payments/services/paystack.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: paymentId } = await params;

    // Fetch payment
    const [payment] = await db
      .select()
      .from(payments)
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

    if (!vendor || vendor.id !== payment.vendorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if payment is already verified
    if (payment.status === 'verified') {
      return NextResponse.json(
        { error: 'Payment already verified' },
        { status: 400 }
      );
    }

    // Check if payment is overdue
    if (payment.status === 'overdue') {
      return NextResponse.json(
        { error: 'Payment deadline has passed' },
        { status: 400 }
      );
    }

    // Initiate payment with Paystack
    const paymentInitiation = await initiatePayment(
      payment.auctionId,
      vendor.id,
      session.user.id
    );

    return NextResponse.json(paymentInitiation);
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
