import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { grantGracePeriod } from '@/lib/cron/payment-overdue-checker';

/**
 * POST /api/payments/[id]/grant-grace-period
 * Grant 3-day grace period to overdue payment
 * 
 * Finance Officer only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Finance Officer
    if (session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden: Finance Officer access required' },
        { status: 403 }
      );
    }

    // Await params in Next.js 15+
    const { id: paymentId } = await params;

    // Grant grace period
    await grantGracePeriod(paymentId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Grace period granted successfully',
    });
  } catch (error) {
    console.error('Error granting grace period:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to grant grace period' },
      { status: 500 }
    );
  }
}
