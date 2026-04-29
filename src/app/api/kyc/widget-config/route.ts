import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';

/**
 * GET /api/kyc/widget-config
 * Returns Dojah widget configuration for the authenticated vendor.
 * Includes phone, BVN, and DOB for pre-filling (phone and BVN will be immutable in the widget).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.DOJAH_APP_ID;
  const publicKey = process.env.DOJAH_PUBLIC_KEY;
  const widgetId = process.env.DOJAH_WIDGET_ID;

  if (!appId || !publicKey) {
    console.error('[KYC] Dojah credentials not configured');
    return NextResponse.json(
      { error: 'KYC service is not configured. Please contact support.' },
      { status: 503 }
    );
  }

  // Fetch vendor data to get BVN and user data to get DOB
  const [result] = await db
    .select({ 
      bvnEncrypted: vendors.bvnEncrypted,
      dateOfBirth: users.dateOfBirth,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  let bvn: string | undefined;
  if (result?.bvnEncrypted) {
    try {
      const enc = getEncryptionService();
      bvn = enc.decrypt(result.bvnEncrypted);
    } catch (err) {
      console.error('[KYC] Failed to decrypt BVN', err);
    }
  }

  // Format DOB as YYYY-MM-DD for Dojah
  let dob: string | undefined;
  if (result?.dateOfBirth) {
    const date = new Date(result.dateOfBirth);
    dob = date.toISOString().slice(0, 10);
  }

  return NextResponse.json({ 
    appId, 
    publicKey, 
    widgetId: widgetId ?? null,
    // Pre-fill data from Tier 1 verification and registration
    phone: session.user.phone ?? undefined,
    bvn: bvn ?? undefined,
    dob: dob ?? undefined,
  });
}
