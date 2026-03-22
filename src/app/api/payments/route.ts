/**
 * Payments API
 * GET /api/payments?auctionId={auctionId}
 * 
 * Query payment by auctionId (for old notifications without paymentId)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get auctionId from query params
    const { searchParams } = new URL(request.url);
    const auctionId = searchParams.get('auctionId');

    if (!auctionId) {
      return NextResponse.json(
        { status: 'error', message: 'auctionId is required' },
        { status: 400 }
      );
    }

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Query payment by auctionId and vendorId
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId)
        )
      )
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { status: 'error', message: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: { payment },
    });
  } catch (error) {
    console.error('Get payment error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get payment',
      },
      { status: 500 }
    );
  }
}
