import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { registrationFeeService } from '@/features/vendors/services/registration-fee.service';

/**
 * GET /api/vendors/registration-fee/status
 *
 * Check registration fee payment status for current vendor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login to continue.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    const status = await registrationFeeService.checkRegistrationFeePaid(vendor.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          paid: status.paid,
          required: status.required,
          amount: status.amount,
          paidAt: status.paidAt,
          reference: status.reference,
          feeAmount: status.feeAmount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Registration fee status check error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to check payment status',
      },
      { status: 500 }
    );
  }
}
