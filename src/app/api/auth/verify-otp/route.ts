import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/features/auth/services/otp.service';
import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';

/**
 * POST /api/auth/verify-otp
 * Verify OTP for phone number verification
 * Supports both regular registration and OAuth completion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp, email, type } = body;

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

    // If this is OAuth completion, create the user account now
    if (type === 'oauth' && email) {
      const tempKey = `oauth_temp:${email}`;
      const tempDataStr = await redis.get(tempKey);

      if (!tempDataStr) {
        return NextResponse.json(
          { error: 'OAuth session expired. Please try again.' },
          { status: 400 }
        );
      }

      const tempData = JSON.parse(tempDataStr as string);

      // Create user account
      try {
        const [newUser] = await db
          .insert(users)
          .values({
            email: tempData.email,
            phone: tempData.phone,
            passwordHash: '', // No password for OAuth users
            fullName: tempData.name,
            dateOfBirth: new Date('1990-01-01'), // Placeholder, will be updated during KYC
            role: 'vendor',
            status: 'unverified_tier_0',
            lastLoginAt: new Date(),
          })
          .returning();

        // Create audit log
        await db.insert(auditLogs).values({
          userId: newUser.id,
          actionType: 'oauth_registration_completed',
          entityType: 'user',
          entityId: newUser.id,
          ipAddress,
          deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
          userAgent,
          afterState: {
            email: tempData.email,
            phone: tempData.phone,
            provider: tempData.provider,
            registrationMethod: 'oauth',
          },
        });

        // Clean up temporary data
        await redis.del(tempKey);

        return NextResponse.json({
          success: true,
          message: 'Registration completed successfully',
          userId: newUser.id,
          isOAuthComplete: true,
        });
      } catch (error) {
        console.error('OAuth user creation error:', error);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
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
