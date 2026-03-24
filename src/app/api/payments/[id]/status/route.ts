/**
 * Payment Job Status API
 * 
 * GET /api/payments/[id]/status
 * 
 * Check the status of a queued payment job
 * 
 * SCALABILITY: Allows clients to poll for payment completion
 * without blocking the initial request
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { paymentQueue } from '@/lib/queue/payment-queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.vendorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: auctionId } = await params;

    // Get payment status
    const status = await paymentQueue.getPaymentStatus(auctionId, session.user.vendorId);

    if (!status) {
      return NextResponse.json(
        { error: 'Payment job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: status,
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get payment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
