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
    // 1. Authenticate user
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login to continue.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Get vendor record
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

    // 3. Check registration fee status
    const status = await registrationFeeService.checkRegistrationFeePaid(vendor.id);

    // 4. Get current registration fee amount from config
    const { configService } = await import('@/features/auction-deposit/services/config.service');
    const config = await configService.getConfig();
    const feeAmount = config.registrationFee;

    // 5. Return status
    return NextResponse.json(
      {
        success: true,
        data: {
          paid: status.paid,
          amount: status.amount,
          paidAt: status.paidAt,
          reference: status.reference,
          feeAmount: feeAmount,
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
