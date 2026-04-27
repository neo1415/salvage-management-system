/**
 * Bidding OTP Send API Route
 * Sends OTP for bid placement with bidding-specific rate limits
 * 
 * Rate Limits (Bidding Context):
 * - 15 OTP requests per 30 minutes (global)
 * - 5 OTP requests per auction per 5 minutes
 * 
 * vs Authentication Context:
 * - 3 OTP requests per 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { otpService } from '@/features/auth/services/otp.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auctions/[id]/otp/send
 * Send OTP for bid placement
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

    // Get user details for phone and email
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

    // Send OTP with BIDDING context and auction ID
    const result = await otpService.sendOTP(
      user.phone,
      ipAddress,
      deviceType,
      user.email,
      user.fullName,
      'bidding',  // ✅ CRITICAL: Use bidding context for higher rate limits
      auctionId   // ✅ CRITICAL: Pass auction ID for per-auction rate limiting
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Bidding OTP send error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send OTP. Please try again.'
      },
      { status: 500 }
    );
  }
}
