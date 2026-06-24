import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { phoneSchema } from '@/lib/utils/validation';
import {
  MFA_CHANNELS,
  MFA_LOGIN_ENFORCED,
  normalizeMfaChannel,
} from '@/lib/settings/mfa';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';

const patchSchema = z.object({
  mfaEnabled: z.boolean().optional(),
  mfaChannel: z.enum(['sms', 'email', 'both']).optional(),
  mfaPhone: phoneSchema.optional().nullable(),
});

/**
 * GET /api/settings/security — MFA preferences (Phase 2: login enforcement)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user] = await db
      .select({
        mfaEnabled: users.mfaEnabled,
        mfaChannel: users.mfaChannel,
        mfaPhone: users.mfaPhone,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const effectivePolicy = await businessPolicyService.getEffectivePolicy();

    return NextResponse.json({
      mfaEnabled: user.mfaEnabled,
      mfaChannel: normalizeMfaChannel(user.mfaChannel),
      mfaPhone: user.mfaPhone,
      email: user.email,
      phone: user.phone,
      loginMfaEnforced: MFA_LOGIN_ENFORCED,
      staffMfaRequired: effectivePolicy.auth.staffMfaRequired,
      vendorMfaEnforced: effectivePolicy.auth.vendorMfaRequired,
      availableChannels: MFA_CHANNELS,
      phase2Note:
        'Staff and vendor MFA requirements are configured in Enterprise Setup (Access policy).',
    });
  } catch (error) {
    console.error('GET /api/settings/security:', error);
    return NextResponse.json({ error: 'Failed to load security settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/security — persist MFA channel preference (enable flag in Phase 2)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const updates: Partial<{
      mfaEnabled: boolean;
      mfaChannel: string;
      mfaPhone: string | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (parsed.data.mfaEnabled !== undefined) {
      updates.mfaEnabled = parsed.data.mfaEnabled;
    }
    if (parsed.data.mfaChannel !== undefined) {
      updates.mfaChannel = parsed.data.mfaChannel;
    }
    if (parsed.data.mfaPhone !== undefined) {
      updates.mfaPhone = parsed.data.mfaPhone;
    }

    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))
      .returning({
        mfaEnabled: users.mfaEnabled,
        mfaChannel: users.mfaChannel,
        mfaPhone: users.mfaPhone,
      });

    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.MFA_SETTINGS_UPDATED,
        AuditEntityType.USER,
        session.user.id,
        undefined,
        {
          mfaEnabled: user.mfaEnabled,
          mfaChannel: normalizeMfaChannel(user.mfaChannel),
          hasMfaPhoneOverride: Boolean(user.mfaPhone),
        }
      )
    );

    return NextResponse.json({
      success: true,
      mfaEnabled: user.mfaEnabled,
      mfaChannel: normalizeMfaChannel(user.mfaChannel),
      mfaPhone: user.mfaPhone,
      loginMfaEnforced: MFA_LOGIN_ENFORCED,
    });
  } catch (error) {
    console.error('PATCH /api/settings/security:', error);
    return NextResponse.json({ error: 'Failed to update security settings' }, { status: 500 });
  }
}
