/**
 * Resend OTP API Route
 * Handles OTP resend requests for various use cases (registration, bid verification, etc.)
 * 
 * Requirements:
 * - Requirement 3: Multi-Factor Authentication via SMS OTP
 * - Requirement 18: Bid Placement with OTP
 * - Enterprise Standards Section 6.1: Authentication & Authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { otpService } from '@/features/auth/services/otp.service';

/**
 * POST /api/auth/resend-otp
 * Resend OTP to user's phone
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { phone } = body;

    // If phone is not provided, try to get it from session
    let phoneNumber = phone;
    let userEmail: string | undefined;
    let userFullName: string | undefined;

    if (!phoneNumber) {
      const session = await auth();
      
      if (!session?.user?.phone) {
        return NextResponse.json(
          { success: false, message: 'Phone number is required' },
          { status: 400 }
        );
      }

      phoneNumber = session.user.phone;
      userEmail = session.user.email || undefined;
      userFullName = session.user.name || undefined;
    } else {
      // If phone is provided, try to get user details from database
      try {
        const { db } = await import('@/lib/db/drizzle');
        const { users } = await import('@/lib/db/schema/users');
        const { eq } = await import('drizzle-orm');
        
        const user = await db
          .select()
          .from(users)
          .where(eq(users.phone, phoneNumber))
          .limit(1);
        
        if (user.length > 0) {
          userEmail = user[0].email;
          userFullName = user[0].fullName;
        }
      } catch (dbError) {
        console.error('Failed to fetch user details:', dbError);
        // Continue without email/fullName - SMS will still work
      }
    }

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceType(userAgent);

    // Send OTP with email backup if available
    const result = await otpService.sendOTP(
      phoneNumber, 
      ipAddress, 
      deviceType,
      userEmail,
      userFullName
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send OTP' 
      },
      { status: 500 }
    );
  }
}

/**
 * Get device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();

  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }

  return 'desktop';
}
