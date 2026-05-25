import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { escrowService } from '@/features/payments/services/escrow.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';

/**
 * POST /api/payments/wallet/fund
 * Initiate wallet funding via Paystack
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor ID from user
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `wallet-fund:${vendor.id}`,
      limit: 8,
      window: 60,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many wallet funding attempts. Please wait and try again.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    if (amount < 50000 || amount > 5000000) {
      return NextResponse.json(
        { error: 'Amount must be between ₦50,000 and ₦5,000,000' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Initiate wallet funding
    const result = await escrowService.fundWallet(vendor.id, amount, session.user.id);

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error funding wallet:', error);
    
    // Return specific error message if available
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initiate wallet funding' },
      { status: 500 }
    );
  }
}
