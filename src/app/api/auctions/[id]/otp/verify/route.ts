/**
 * Bidding OTP Verify API Route
 * Verifies OTP for bid placement
 * 
 * Note: This endpoint only verifies the OTP is valid.
 * The actual bid placement happens in /api/auctions/[id]/bids
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { otpService } from '@/features/auth/services/otp.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auctions/[id]/otp/verify
 * Verify OTP for bid placement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+)
    const { id: auctionId } = await params;

    // Get session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor profile
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Get user details for phone
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'OTP is required' },
        { status: 400 }
      );
    }

    // Get IP address and device info
    const { getRealIPAddress } = await import('@/lib/utils/device-fingerprint');
    const ipAddress = getRealIPAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Determine device type from user agent
    const ua = userAgent.toLowerCase();
    let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    } else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      deviceType = 'mobile';
    }

    // Verify OTP
    const result = await otpService.verifyOTP(
      user.phone,
      otp,
      ipAddress,
      deviceType
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error('Bidding OTP verify error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to verify OTP. Please try again.'
      },
      { status: 500 }
    );
  }
}
