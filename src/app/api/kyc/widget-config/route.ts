import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * GET /api/kyc/widget-config
 * Returns Dojah widget configuration for the authenticated vendor.
 * Returns only safe browser-side widget configuration and non-secret profile prefill data.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.DOJAH_APP_ID;
  const publicKey = process.env.DOJAH_PUBLIC_KEY;
  const widgetId = process.env.DOJAH_WIDGET_ID || process.env.DOJAH_EASYONBOARD_FLOW_ID;
  const workflowSlug = process.env.DOJAH_WORKFLOW_SLUG || 'salvage';

  if (!appId || !publicKey) {
    console.error('[KYC] Dojah credentials not configured');
    return NextResponse.json(
      { error: 'KYC service is not configured. Please contact support.' },
      { status: 503 }
    );
  }

  // Fetch vendor/user data needed for non-sensitive widget metadata and prefill.
  const [result] = await db
    .select({ 
      vendorId: vendors.id,
      dateOfBirth: users.dateOfBirth,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  // Format DOB as YYYY-MM-DD for Dojah
  let dob: string | undefined;
  if (result?.dateOfBirth) {
    const date = new Date(result.dateOfBirth);
    dob = date.toISOString().slice(0, 10);
  }

  console.info('[KYC] Dojah widget config loaded', {
    hasAppId: Boolean(appId),
    publicKeyMode: publicKey.startsWith('prod_') ? 'production' : publicKey.startsWith('test_') ? 'test' : 'unknown',
    hasWidgetId: Boolean(widgetId),
    hasVendorId: Boolean(result?.vendorId),
    hasPhone: Boolean(session.user.phone),
    hasDob: Boolean(dob),
    workflowSlug,
  });

  return NextResponse.json({
    appId, 
    publicKey, 
    widgetId: widgetId ?? null,
    // Pre-fill data from Tier 1 verification and registration
    phone: session.user.phone ?? undefined,
    dob: dob ?? undefined,
    vendorId: result?.vendorId,
    workflowSlug,
  });
}
