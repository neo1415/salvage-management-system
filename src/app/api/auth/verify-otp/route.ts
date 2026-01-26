import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/features/auth/services/otp.service';

/**
 * POST /api/auth/verify-otp
 * Verify OTP for phone number verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    // Validate input
    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    // Verify OTP
    const result = await otpService.verifyOTP(
      phone,
      otp,
      ipAddress,
      deviceType as 'mobile' | 'desktop' | 'tablet'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      userId: result.userId,
    });
  } catch (error) {
    console.error('Verify OTP API error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify-otp/resend
 * Resend OTP to phone number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    // Send OTP
    const result = await otpService.sendOTP(
      phone,
      ipAddress,
      deviceType as 'mobile' | 'desktop' | 'tablet'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Resend OTP API error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP. Please try again.' },
      { status: 500 }
    );
  }
}
