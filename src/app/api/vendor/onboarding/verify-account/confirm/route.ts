import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { otpService } from '@/features/auth/services/otp.service';
import { hasRealVendorPhone } from '@/lib/auth/vendor-phone';

const bodySchema = z.object({
  phoneOtp: z.string().length(6, 'Enter the 6-digit phone code'),
  emailOtp: z.string().length(6, 'Enter the 6-digit email code'),
});

/**
 * POST /api/vendor/onboarding/verify-account/confirm
 * Confirm phone and email OTP codes and mark account as phone-verified.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'unverified_tier_0') {
      return NextResponse.json({ error: 'Account verification is not required.' }, { status: 400 });
    }

    if (!hasRealVendorPhone(user.phone)) {
      return NextResponse.json({ error: 'Add a phone number before verifying your account.' }, { status: 400 });
    }

    const phoneCheck = await otpService.verifyOTPCode(user.phone, parsed.data.phoneOtp);
    if (!phoneCheck.success) {
      return NextResponse.json(
        { error: phoneCheck.message, field: 'phoneOtp', attemptsRemaining: phoneCheck.attemptsRemaining },
        { status: 400 }
      );
    }

    const emailCheck = await otpService.verifyEmailOTPCode(user.email, parsed.data.emailOtp);
    if (!emailCheck.success) {
      return NextResponse.json(
        { error: emailCheck.message, field: 'emailOtp', attemptsRemaining: emailCheck.attemptsRemaining },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get('x-user-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = /mobile/i.test(userAgent) ? 'mobile' : 'desktop';

    await db
      .update(users)
      .set({
        status: 'phone_verified_tier_0',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    try {
      await db.insert(auditLogs).values({
        userId: user.id,
        actionType: 'account_verification_completed',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
        deviceType,
        userAgent,
        afterState: {
          phone: user.phone,
          email: user.email,
          status: 'phone_verified_tier_0',
        },
      });
    } catch (auditError) {
      console.error('Account verification audit log failed:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Account verified successfully.',
      status: 'phone_verified_tier_0',
    });
  } catch (error) {
    console.error('POST /api/vendor/onboarding/verify-account/confirm:', error);
    return NextResponse.json({ error: 'Failed to verify account.' }, { status: 500 });
  }
}
