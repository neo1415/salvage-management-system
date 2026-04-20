import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { registrationFeeService } from '@/features/vendors/services/registration-fee.service';

/**
 * POST /api/vendors/registration-fee/initialize
 * 
 * Initialize registration fee payment with Paystack
 * Called after Tier 1 KYC (BVN verification) is complete
 */
export async function POST(request: NextRequest) {
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
    const userEmail = session.user.email;
    const userName = session.user.name || 'Vendor';

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

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

    // 3. Check if BVN is verified (Tier 1 KYC complete)
    if (!vendor.bvnVerifiedAt) {
      return NextResponse.json(
        { 
          error: 'BVN verification required',
          message: 'Please complete Tier 1 KYC (BVN verification) before paying registration fee.',
        },
        { status: 400 }
      );
    }

    // 4. Check if already paid
    if (vendor.registrationFeePaid) {
      return NextResponse.json(
        { 
          error: 'Registration fee already paid',
          message: 'You have already paid the registration fee.',
          data: {
            paid: true,
            amount: vendor.registrationFeeAmount ? parseFloat(vendor.registrationFeeAmount) : null,
            paidAt: vendor.registrationFeePaidAt,
            reference: vendor.registrationFeeReference,
          },
        },
        { status: 400 }
      );
    }

    // 5. Initialize payment
    const result = await registrationFeeService.initializeRegistrationFeePayment({
      vendorId: vendor.id,
      userEmail,
      userName,
    });

    // 6. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          paymentId: result.paymentId,
          authorizationUrl: result.authorizationUrl,
          accessCode: result.accessCode,
          amount: result.amount,
          reference: result.reference,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Registration fee initialization error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to initialize payment',
      },
      { status: 500 }
    );
  }
}
