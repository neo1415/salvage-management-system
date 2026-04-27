import { NextRequest, NextResponse } from 'next/server';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getKYCAuditService } from '@/features/kyc/services/audit.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

const SYSTEM_ACTOR_ID = 'system-cron';

/**
 * GET /api/cron/kyc-expiry
 * Daily cron job — downgrades expired Tier 2 vendors and sends reminders.
 * Secured with CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Verify cron secret (REQUIRED)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable!');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Security] Unauthorized cron attempt', {
      hasAuthHeader: !!authHeader,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const repo = getKYCRepository();
  const audit = getKYCAuditService();
  const notify = getKYCNotificationService();

  let downgraded = 0;
  let reminded = 0;

  // 1. Downgrade expired vendors
  const expired = await repo.getExpiredTier2Vendors();
  for (const v of expired) {
    try {
      await repo.downgradeTier(v.id);
      await audit.logTierChange(v.id, SYSTEM_ACTOR_ID, 'tier2_full', 'tier1_bvn', 'tier2_expired');

      const vendorUser = await getVendorUser(v.id);
      if (vendorUser) {
        await notify.sendExpiryNotification({
          vendorId: v.id,
          userId: vendorUser.id,
          phone: vendorUser.phone,
          email: vendorUser.email,
          fullName: vendorUser.fullName,
        });
      }
      downgraded++;
    } catch (e) {
      console.error(`[KYC Cron] Failed to downgrade vendor ${v.id}`, e);
    }
  }

  // 2. Send 30-day reminders
  const expiring30 = await repo.getVendorsExpiringInDays(30);
  for (const v of expiring30) {
    try {
      const vendorUser = await getVendorUser(v.id);
      if (vendorUser) {
        await notify.sendExpiryReminder(
          { vendorId: v.id, userId: vendorUser.id, phone: vendorUser.phone, email: vendorUser.email, fullName: vendorUser.fullName },
          30
        );
        reminded++;
      }
    } catch (e) {
      console.error(`[KYC Cron] Failed to send 30-day reminder for vendor ${v.id}`, e);
    }
  }

  // 3. Send 7-day reminders
  const expiring7 = await repo.getVendorsExpiringInDays(7);
  for (const v of expiring7) {
    try {
      const vendorUser = await getVendorUser(v.id);
      if (vendorUser) {
        await notify.sendExpiryReminder(
          { vendorId: v.id, userId: vendorUser.id, phone: vendorUser.phone, email: vendorUser.email, fullName: vendorUser.fullName },
          7
        );
        reminded++;
      }
    } catch (e) {
      console.error(`[KYC Cron] Failed to send 7-day reminder for vendor ${v.id}`, e);
    }
  }

  console.log(`[KYC Cron] Completed: ${downgraded} downgraded, ${reminded} reminders sent`);

  return NextResponse.json({ success: true, downgraded, reminded });
}

async function getVendorUser(vendorId: string) {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.id, vendorId))
    .limit(1);
  return rows[0] ?? null;
}
