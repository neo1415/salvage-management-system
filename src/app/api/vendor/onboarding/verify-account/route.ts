import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { isProvisionalVendorPhone } from '@/lib/auth/vendor-phone';

const ADMIN_PLACEHOLDER_DOB = '1990-01-01';

/**
 * GET /api/vendor/onboarding/verify-account
 * Load onboarding verification state for the unified account verification step.
 */
export async function GET() {
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
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        dateOfBirth: users.dateOfBirth,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dobIso = user.dateOfBirth?.toISOString?.().slice(0, 10) ?? '';
    const needsPhone = isProvisionalVendorPhone(user.phone);
    const needsDob = !dobIso || dobIso === ADMIN_PLACEHOLDER_DOB;

    return NextResponse.json({
      success: true,
      fullName: user.fullName,
      email: user.email,
      phone: needsPhone ? '' : user.phone,
      dateOfBirth: needsDob ? '' : dobIso,
      status: user.status,
      needsPhone,
      needsDob,
      needsVerification: user.status === 'unverified_tier_0',
    });
  } catch (error) {
    console.error('GET /api/vendor/onboarding/verify-account:', error);
    return NextResponse.json({ error: 'Failed to load verification state.' }, { status: 500 });
  }
}
