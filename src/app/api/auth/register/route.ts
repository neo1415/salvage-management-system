import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@/lib/utils/validation';
import { authService } from '@/features/auth/services/auth.service';
import { emailService } from '@/features/notifications/services/email.service';
import { otpService } from '@/features/auth/services/otp.service';
import { ZodError } from 'zod';

/**
 * POST /api/auth/register
 * Register a new vendor user
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedInput = registrationSchema.parse(body);

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Register user
    const result = await authService.register(validatedInput, ipAddress, deviceType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Send welcome email (async, don't wait for it)
    // Only send if using a verified custom domain (not resend.dev)
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    if (!emailFrom.includes('resend.dev')) {
      emailService.sendWelcomeEmail(validatedInput.email, validatedInput.fullName).catch((error) => {
        console.error('Failed to send welcome email:', error);
      });
    } else {
      console.log('📧 Welcome email skipped (using Resend test domain - verify a custom domain to enable)');
    }

    // Send OTP for phone verification
    const otpResult = await otpService.sendOTP(validatedInput.phone, ipAddress, deviceType);
    
    if (!otpResult.success) {
      console.error('Failed to send OTP:', otpResult.message);
      // Don't fail registration if OTP fails, user can request resend
    }

    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        message: 'Registration successful. Please verify your phone number.',
        phone: validatedInput.phone, // Include phone for OTP verification page
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('Registration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
