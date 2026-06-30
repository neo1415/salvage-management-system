import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { Ratelimit } from '@upstash/ratelimit';
import { eq, inArray } from 'drizzle-orm';
import { db, withRetry } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { redis } from '@/lib/redis/client';
import {
  looksLikeEmail,
  nigerianPhoneLookupVariants,
} from '@/lib/utils/phone';
import {
  isMfaRequiredForUser,
  sendLoginMfaCode,
} from '@/lib/auth/mfa';
import {
  evaluateRiskBasedMfa,
  recordLoginRiskDecision,
} from '@/lib/auth/risk-based-mfa';
import {
  AuditActionType,
  AuditEntityType,
  DeviceType,
  getDeviceTypeFromUserAgent,
  getIpAddress,
  logAction,
} from '@/lib/utils/audit-logger';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';

const startMfaRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:mfa-start',
});

function mapDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const deviceType = getDeviceTypeFromUserAgent(userAgent);
  if (deviceType === DeviceType.MOBILE) return 'mobile';
  if (deviceType === DeviceType.TABLET) return 'tablet';
  return 'desktop';
}

async function findUser(emailOrPhone: string) {
  return withRetry(async () => {
    if (looksLikeEmail(emailOrPhone)) {
      return db
        .select()
        .from(users)
        .where(eq(users.email, emailOrPhone))
        .limit(1)
        .then((rows) => rows[0]);
    }

    return db
      .select()
      .from(users)
      .where(inArray(users.phone, nigerianPhoneLookupVariants(emailOrPhone)))
      .limit(1)
      .then((rows) => rows[0]);
  });
}

export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request.headers);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const deviceType = mapDeviceType(userAgent);

  const rateLimit = await startMfaRateLimit.limit(ipAddress);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const emailOrPhone = typeof body.emailOrPhone === 'string' ? body.emailOrPhone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!emailOrPhone || !password) {
      return NextResponse.json({ error: 'Email/phone and password are required' }, { status: 400 });
    }

    const user = await findUser(emailOrPhone);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ required: false });
    }

    const validPassword = await compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ required: false });
    }

    const effectivePolicy = await businessPolicyService.getEffectivePolicy();
    const mfaAuthPolicy = {
      staffMfaRequired: effectivePolicy.auth.staffMfaRequired,
      vendorMfaRequired: effectivePolicy.auth.vendorMfaRequired,
    };

    const policyRequiresMfa = isMfaRequiredForUser(user, mfaAuthPolicy);
    const riskDecision = await evaluateRiskBasedMfa({
      userId: user.id,
      ipAddress,
      userAgent,
    });
    await recordLoginRiskDecision(
      { userId: user.id, ipAddress, userAgent },
      riskDecision
    );

    if (!policyRequiresMfa && !riskDecision.required) {
      return NextResponse.json({ required: false });
    }

    const result = await sendLoginMfaCode(user, ipAddress, deviceType);

    await logAction({
      userId: user.id,
      actionType: AuditActionType.MFA_CHALLENGE_SENT,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      ipAddress,
      deviceType:
        deviceType === 'mobile'
          ? DeviceType.MOBILE
          : deviceType === 'tablet'
            ? DeviceType.TABLET
            : DeviceType.DESKTOP,
      userAgent,
      afterState: {
        channel: result.channel,
        success: result.success,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { required: true, error: 'Verification code could not be sent. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      required: true,
      channel: result.channel,
      destination: result.maskedDestination,
      message: 'Verification code sent.',
    });
  } catch (error) {
    console.error('[MFA] Failed to start login challenge:', error);
    return NextResponse.json({ error: 'Unable to start verification.' }, { status: 500 });
  }
}

