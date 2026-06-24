import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { phoneSchema } from '@/lib/utils/validation';
import { otpService } from '@/features/auth/services/otp.service';
import { cache } from '@/lib/redis/client';
import { isProvisionalVendorPhone } from '@/lib/auth/vendor-phone';

const bodySchema = z.object({ phone: phoneSchema });

const PENDING_KEY = (userId: string) => `settings:phone-change:${userId}`;

/**
 * POST /api/settings/profile/phone/request
 * Send OTP to the new phone before updating profile phone.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid phone number' },
        { status: 400 }
      );
    }

    const phone = parsed.data.phone;
    const userId = session.user.id;

    const [current] = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (current.status === 'deleted' || current.status === 'suspended') {
      return NextResponse.json({ error: 'Account cannot be updated' }, { status: 403 });
    }

    if (current.phone === phone && !isProvisionalVendorPhone(current.phone)) {
      return NextResponse.json({ error: 'This is already your phone number' }, { status: 400 });
    }

    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, phone), ne(users.id, userId), ne(users.status, 'deleted')))
      .limit(1);

    if (conflict) {
      return NextResponse.json(
        { error: 'This phone number is already registered to another account' },
        { status: 409 }
      );
    }

    const ipAddress =
      request.headers.get('x-user-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType =
      /mobile/i.test(userAgent) ? 'mobile' : /tablet/i.test(userAgent) ? 'tablet' : 'desktop';

    const result = await otpService.sendOTP(
      phone,
      ipAddress,
      deviceType,
      current.email,
      current.fullName,
      'phone_change'
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 429 });
    }

    await cache.set(PENDING_KEY(userId), { phone }, 10 * 60);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your new phone number. Email backup sent if configured.',
    });
  } catch (error) {
    console.error('POST /api/settings/profile/phone/request:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
