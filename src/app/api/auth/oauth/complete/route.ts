import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { otpService } from '@/features/auth/services/otp.service';

export async function POST(request: NextRequest) {
  try {
    const { email, phone } = await request.json();

    if (!email || !phone) {
      return NextResponse.json(
        { error: 'Email and phone are required' },
        { status: 400 }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Get temporary OAuth data from Redis
    const tempKey = `oauth_temp:${email}`;
    const tempDataStr = await redis.get(tempKey);

    if (!tempDataStr) {
      return NextResponse.json(
        { error: 'OAuth session expired. Please try again.' },
        { status: 400 }
      );
    }

    const tempData = JSON.parse(tempDataStr as string);

    // Check if phone is already registered
    const [existingUserByPhone] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'Phone number already registered' },
        { status: 400 }
      );
    }

    // Check if email is already registered (shouldn't happen, but double-check)
    const [existingUserByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Store phone number with OAuth data for later user creation
    const updatedTempData = {
      ...tempData,
      phone,
    };
    await redis.set(tempKey, JSON.stringify(updatedTempData), { ex: 15 * 60 });

    // Generate and send OTP
    const otpResult = await otpService.generateOTP(phone);

    if (!otpResult.success) {
      return NextResponse.json(
        { error: otpResult.error || 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('OAuth completion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
