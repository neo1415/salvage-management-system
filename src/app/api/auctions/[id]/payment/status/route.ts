/**
 * Payment Status API
 * GET /api/auctions/[id]/payment/status
 * 
 * Checks if a verified payment exists for an auction
 * Used to determine UI state (show "Pay Now" vs "Payment Complete")
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { hasVerifiedPayment: false },
        { status: 401 }
      );
    }

    // Check if a verified payment exists for this auction
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.status, 'verified')
        )
      )
      .limit(1);

    return NextResponse.json({
      hasVerifiedPayment: !!payment,
      paymentId: payment?.id,
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { hasVerifiedPayment: false },
      { status: 500 }
    );
  }
}
