import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/features/auth/services/otp.service';
import { z } from 'zod';

/**
 * POST /api/auth/resend-otp
 * Resend OTP to user's phone
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const schema = z.object({
      phone: z.string().min(10, 'Phone number is required'),
    });

    const { phone } = schema.parse(body);

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Send OTP
    const result = await otpService.sendOTP(phone, ipAddress, deviceType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend OTP API error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to detect device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}
