import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { phoneSchema } from '@/lib/utils/validation';
import { otpService } from '@/features/auth/services/otp.service';
import { cache } from '@/lib/redis/client';

const bodySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'Enter the 6-digit code'),
});

const PENDING_KEY = (userId: string) => `settings:phone-change:${userId}`;

/**
 * POST /api/settings/profile/phone/verify
 * Confirm OTP and save new phone number.
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
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { phone, otp } = parsed.data;
    const userId = session.user.id;

    const pending = await cache.get<{ phone: string }>(PENDING_KEY(userId));
    if (!pending || pending.phone !== phone) {
      return NextResponse.json(
        { error: 'No pending phone change. Request a new verification code.' },
        { status: 400 }
      );
    }

    const verified = await otpService.verifyOTPCode(phone, otp);
    if (!verified.success) {
      return NextResponse.json({ error: verified.message }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ phone: users.phone });

    await cache.del(PENDING_KEY(userId));

    return NextResponse.json({ success: true, phone: updated.phone });
  } catch (error) {
    console.error('POST /api/settings/profile/phone/verify:', error);
    return NextResponse.json({ error: 'Failed to update phone number' }, { status: 500 });
  }
}
