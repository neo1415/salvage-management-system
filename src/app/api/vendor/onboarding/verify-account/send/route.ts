import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { otpService } from '@/features/auth/services/otp.service';
import { hasRealVendorPhone } from '@/lib/auth/vendor-phone';

function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

/**
 * POST /api/vendor/onboarding/verify-account/send
 * Send phone and email OTP codes for vendor account verification.
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

    const [user] = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        fullName: users.fullName,
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

    const ipAddress =
      request.headers.get('x-user-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    const phoneResult = await otpService.sendOTP(
      user.phone,
      ipAddress,
      deviceType,
      undefined,
      user.fullName,
      'authentication'
    );

    if (!phoneResult.success) {
      return NextResponse.json({ error: phoneResult.message }, { status: 429 });
    }

    const emailResult = await otpService.sendEmailOTP(
      user.email,
      user.fullName,
      ipAddress,
      deviceType,
      'authentication'
    );

    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.message }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification codes sent to your phone and email.',
      maskedPhone: maskPhone(user.phone),
      maskedEmail: maskEmail(user.email),
    });
  } catch (error) {
    console.error('POST /api/vendor/onboarding/verify-account/send:', error);
    return NextResponse.json({ error: 'Failed to send verification codes.' }, { status: 500 });
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
