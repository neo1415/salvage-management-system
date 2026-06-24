import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { otpService } from '@/features/auth/services/otp.service';
import { hasRealVendorPhone, isProvisionalVendorPhone } from '@/lib/auth/vendor-phone';
import { phoneSchema } from '@/lib/utils/validation';
import { parseFullNameBvnOrder } from '@/lib/utils/person-name';

const ADMIN_PLACEHOLDER_DOB = '1990-01-01';

const bodySchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full legal name').max(120).optional(),
  phone: phoneSchema.optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date of birth')
    .optional(),
});

function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

/**
 * POST /api/vendor/onboarding/verify-account/send
 * Save profile details if needed, then send one OTP to phone and email.
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

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
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
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
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

    const updates: {
      fullName?: string;
      phone?: string;
      dateOfBirth?: Date;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (parsed.data.fullName) {
      const nameParts = parseFullNameBvnOrder(parsed.data.fullName);
      if (!nameParts.firstName || !nameParts.lastName) {
        return NextResponse.json(
          { error: 'Enter your full legal name (first and surname at minimum).' },
          { status: 400 }
        );
      }
      updates.fullName = parsed.data.fullName.trim();
    }

    let phoneToUse = user.phone;
    if (parsed.data.phone) {
      const phone = parsed.data.phone;
      if (phone !== user.phone || isProvisionalVendorPhone(user.phone)) {
        const [conflict] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.phone, phone), ne(users.id, user.id), ne(users.status, 'deleted')))
          .limit(1);

        if (conflict) {
          return NextResponse.json(
            { error: 'This phone number is already registered to another account' },
            { status: 409 }
          );
        }
        updates.phone = phone;
        phoneToUse = phone;
      }
    }

    const currentDob = user.dateOfBirth?.toISOString?.().slice(0, 10) ?? '';
    if (parsed.data.dateOfBirth) {
      updates.dateOfBirth = new Date(parsed.data.dateOfBirth);
    } else if (!currentDob || currentDob === ADMIN_PLACEHOLDER_DOB) {
      return NextResponse.json(
        { error: 'Enter your date of birth before requesting a verification code.' },
        { status: 400 }
      );
    }

    if (!hasRealVendorPhone(phoneToUse)) {
      return NextResponse.json({ error: 'Add a valid phone number before verifying.' }, { status: 400 });
    }

    if (Object.keys(updates).length > 1) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }

    const fullName = updates.fullName ?? user.fullName;

    const ipAddress =
      request.headers.get('x-user-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    const result = await otpService.sendOTP(
      phoneToUse,
      ipAddress,
      deviceType,
      user.email,
      fullName,
      'authentication'
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      maskedPhone: maskPhone(phoneToUse),
      maskedEmail: maskEmail(user.email),
      smsDelivered: result.smsDelivered ?? false,
      emailDelivered: result.emailDelivered ?? false,
    });
  } catch (error) {
    console.error('POST /api/vendor/onboarding/verify-account/send:', error);
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'your email';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return 'your phone';
  return `***${phone.slice(-4)}`;
}
