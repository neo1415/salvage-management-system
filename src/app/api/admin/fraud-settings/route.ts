import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { algorithmConfig } from '@/lib/db/schema/intelligence';
import { eq } from 'drizzle-orm';

const IP_FRAUD_CONFIG_KEY = 'fraud.ip_detection_enabled';

async function requireFraudSettingsAccess() {
  const session = await auth();

  if (!session?.user || !['system_admin', 'salvage_manager'].includes(session.user.role)) {
    return null;
  }

  return session;
}

export async function GET() {
  try {
    const session = await requireFraudSettingsAccess();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [setting] = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, IP_FRAUD_CONFIG_KEY))
      .limit(1);

    return NextResponse.json({
      ipFraudDetectionEnabled: setting ? setting.isActive && setting.configValue !== false : true,
    });
  } catch (error) {
    console.error('Failed to fetch fraud settings:', error);
    return NextResponse.json({ error: 'Failed to fetch fraud settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireFraudSettingsAccess();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const enabled = Boolean(body.ipFraudDetectionEnabled);

    await db
      .insert(algorithmConfig)
      .values({
        configKey: IP_FRAUD_CONFIG_KEY,
        configValue: enabled,
        description: 'Enable or disable IP-based fraud detection for auction bids. Useful for one-device demos.',
        version: 'v1.0',
        isActive: true,
        createdBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: algorithmConfig.configKey,
        set: {
          configValue: enabled,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ipFraudDetectionEnabled: enabled });
  } catch (error) {
    console.error('Failed to update fraud settings:', error);
    return NextResponse.json({ error: 'Failed to update fraud settings' }, { status: 500 });
  }
}
