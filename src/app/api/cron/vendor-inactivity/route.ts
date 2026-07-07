import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { businessPolicyService } from '@/features/business-policy';
import { createNotification, createRoleNotifications } from '@/features/notifications/services/notification.service';
import { emailService } from '@/features/notifications/services/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InactiveVendorRow = {
  vendor_id: string;
  user_id: string;
  vendor_name: string;
  email: string;
  last_activity_at: Date | string;
  inactive_days: number | string;
};

function requireCronAuth(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Cron authentication is not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inactivityEmailHtml(row: InactiveVendorRow) {
  const inactiveDays = Math.max(0, Math.floor(Number(row.inactive_days) || 0));
  const vendorName = escapeHtml(row.vendor_name || row.email);
  const email = escapeHtml(row.email);
  const lastActivity = formatDate(row.last_activity_at);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px;color:#02006b">Inactive vendor review</h2>
      <p>The vendor account below has crossed the configured inactivity threshold.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700">Vendor</td><td style="padding:8px;border:1px solid #e5e7eb">${vendorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700">Email</td><td style="padding:8px;border:1px solid #e5e7eb">${email}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700">Inactive days</td><td style="padding:8px;border:1px solid #e5e7eb">${inactiveDays}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700">Last activity</td><td style="padding:8px;border:1px solid #e5e7eb">${lastActivity}</td></tr>
      </table>
      <p style="margin-top:16px">Review the account in Admin Setup before deciding whether to suspend or reactivate the vendor.</p>
    </div>
  `;
}

function inactivityWarningEmailHtml(row: InactiveVendorRow, daysRemaining: number) {
  const inactiveDays = Math.max(0, Math.floor(Number(row.inactive_days) || 0));
  const vendorName = escapeHtml(row.vendor_name || row.email);
  const lastActivity = formatDate(row.last_activity_at);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px;color:#02006b">Account activity reminder</h2>
      <p>Hello ${vendorName},</p>
      <p>Your vendor account has been inactive for ${inactiveDays} days.</p>
      <p>If there is still no activity in about ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}, your account may be sent to an administrator for review.</p>
      <p>To keep your account active, sign in and continue with any pending verification, auction, payment, document, or pickup action.</p>
      <p style="font-size:12px;color:#6b7280">Last recorded activity: ${lastActivity}</p>
    </div>
  `;
}

async function runVendorInactivityCheck() {
  const policy = await businessPolicyService.getEffectivePolicy();
  const inactivityPolicy = policy.fraud;

  if (!inactivityPolicy.vendorInactivityAlertsEnabled) {
    return {
      enabled: false,
      thresholdDays: inactivityPolicy.vendorInactivityDays,
      cooldownDays: inactivityPolicy.vendorInactivityCooldownDays,
      candidates: 0,
      notified: 0,
      notificationsSent: 0,
      emailsSent: 0,
    };
  }

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - inactivityPolicy.vendorInactivityDays);
  const thresholdIso = thresholdDate.toISOString();

  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - inactivityPolicy.vendorInactivityCooldownDays);
  const cooldownIso = cooldownDate.toISOString();
  const warningLeadDays = Math.min(7, Math.max(1, inactivityPolicy.vendorInactivityDays - 1));
  const warningStartDate = new Date();
  warningStartDate.setDate(warningStartDate.getDate() - (inactivityPolicy.vendorInactivityDays - warningLeadDays));
  const warningStartIso = warningStartDate.toISOString();

  const warningVendors = (await db.execute(sql`
    WITH vendor_activity AS (
      SELECT
        v.id AS vendor_id,
        v.user_id,
        COALESCE(NULLIF(v.business_name, ''), u.full_name, u.email) AS vendor_name,
        u.email,
        GREATEST(
          COALESCE(u.last_login_at, TIMESTAMP 'epoch'),
          COALESCE(u.created_at, TIMESTAMP 'epoch'),
          COALESCE(v.created_at, TIMESTAMP 'epoch'),
          COALESCE(v.updated_at, TIMESTAMP 'epoch'),
          COALESCE(v.bvn_verified_at, TIMESTAMP 'epoch'),
          COALESCE(v.registration_fee_paid_at, TIMESTAMP 'epoch'),
          COALESCE(v.tier2_submitted_at, TIMESTAMP 'epoch'),
          COALESCE(v.tier2_approved_at, TIMESTAMP 'epoch'),
          COALESCE((SELECT MAX(b.created_at) FROM bids b WHERE b.vendor_id = v.id), TIMESTAMP 'epoch'),
          COALESCE((SELECT MAX(p.created_at) FROM payments p WHERE p.vendor_id = v.id), TIMESTAMP 'epoch')
        ) AS last_activity_at
      FROM vendors v
      INNER JOIN users u ON u.id = v.user_id
      WHERE v.status = 'approved'
      AND u.status NOT IN ('suspended', 'deleted')
    )
    SELECT
      va.vendor_id,
      va.user_id,
      va.vendor_name,
      va.email,
      va.last_activity_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - va.last_activity_at)) / 86400)::int AS inactive_days
    FROM vendor_activity va
    WHERE va.last_activity_at < ${warningStartIso}::timestamp
    AND va.last_activity_at >= ${thresholdIso}::timestamp
    AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.type = 'system_alert'
      AND n.created_at >= ${cooldownIso}::timestamp
      AND n.data->>'vendorInactivityWarning' = 'true'
      AND n.data->>'vendorId' = va.vendor_id::text
    )
    ORDER BY va.last_activity_at ASC
    LIMIT 100
  `)) as InactiveVendorRow[];

  let warningNotificationsSent = 0;
  let warningEmailsSent = 0;

  for (const warningVendor of warningVendors) {
    const inactiveDays = Math.max(0, Math.floor(Number(warningVendor.inactive_days) || 0));
    const daysRemaining = Math.max(1, inactivityPolicy.vendorInactivityDays - inactiveDays);

    const notification = await createNotification({
      userId: warningVendor.user_id,
      type: 'system_alert',
      title: 'Account activity reminder',
      message: `Your vendor account has been inactive for ${inactiveDays} days. Sign in to avoid admin inactivity review.`,
      data: {
        vendorInactivityWarning: true,
        vendorId: warningVendor.vendor_id,
        inactiveDays,
        daysRemaining,
        url: '/vendor/dashboard',
      },
    }).catch((error) => {
      console.error('Vendor inactivity warning notification failed:', error);
      return null;
    });

    if (notification) warningNotificationsSent += 1;

    const emailResult = await emailService.sendEmail({
      to: warningVendor.email,
      subject: 'Action recommended: keep your vendor account active',
      html: inactivityWarningEmailHtml(warningVendor, daysRemaining),
      category: 'system',
    }).catch((error) => {
      console.error('Vendor inactivity warning email failed:', error);
      return { success: false };
    });

    if (emailResult.success) warningEmailsSent += 1;
  }

  const inactiveVendors = (await db.execute(sql`
    WITH vendor_activity AS (
      SELECT
        v.id AS vendor_id,
        v.user_id,
        COALESCE(NULLIF(v.business_name, ''), u.full_name, u.email) AS vendor_name,
        u.email,
        GREATEST(
          COALESCE(u.last_login_at, TIMESTAMP 'epoch'),
          COALESCE(u.created_at, TIMESTAMP 'epoch'),
          COALESCE(v.created_at, TIMESTAMP 'epoch'),
          COALESCE(v.updated_at, TIMESTAMP 'epoch'),
          COALESCE(v.bvn_verified_at, TIMESTAMP 'epoch'),
          COALESCE(v.registration_fee_paid_at, TIMESTAMP 'epoch'),
          COALESCE(v.tier2_submitted_at, TIMESTAMP 'epoch'),
          COALESCE(v.tier2_approved_at, TIMESTAMP 'epoch'),
          COALESCE((SELECT MAX(b.created_at) FROM bids b WHERE b.vendor_id = v.id), TIMESTAMP 'epoch'),
          COALESCE((SELECT MAX(p.created_at) FROM payments p WHERE p.vendor_id = v.id), TIMESTAMP 'epoch')
        ) AS last_activity_at
      FROM vendors v
      INNER JOIN users u ON u.id = v.user_id
      WHERE v.status = 'approved'
      AND u.status NOT IN ('suspended', 'deleted')
    )
    SELECT
      va.vendor_id,
      va.user_id,
      va.vendor_name,
      va.email,
      va.last_activity_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - va.last_activity_at)) / 86400)::int AS inactive_days
    FROM vendor_activity va
    WHERE va.last_activity_at < ${thresholdIso}::timestamp
    AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.type = 'system_alert'
      AND n.created_at >= ${cooldownIso}::timestamp
      AND n.data->>'vendorInactivityAlert' = 'true'
      AND n.data->>'vendorId' = va.vendor_id::text
    )
    ORDER BY va.last_activity_at ASC
    LIMIT 100
  `)) as InactiveVendorRow[];

  if (inactiveVendors.length === 0) {
    return {
      enabled: true,
      thresholdDays: inactivityPolicy.vendorInactivityDays,
      cooldownDays: inactivityPolicy.vendorInactivityCooldownDays,
      warningLeadDays,
      warningCandidates: warningVendors.length,
      warningNotificationsSent,
      warningEmailsSent,
      candidates: 0,
      notified: 0,
      notificationsSent: 0,
      emailsSent: 0,
    };
  }

  const adminUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.role, 'system_admin'), sql`${users.status} NOT IN ('suspended', 'deleted')`));

  let notificationsSent = 0;
  let emailsSent = 0;

  for (const inactiveVendor of inactiveVendors) {
    const inactiveDays = Math.max(0, Math.floor(Number(inactiveVendor.inactive_days) || 0));
    const notificationResult = await createRoleNotifications(['system_admin'], {
      type: 'system_alert',
      title: 'Inactive vendor review',
      message: `${inactiveVendor.vendor_name} has been inactive for ${inactiveDays} days. Review whether the account should remain active.`,
      data: {
        vendorInactivityAlert: true,
        vendorId: inactiveVendor.vendor_id,
        vendorUserId: inactiveVendor.user_id,
        vendorName: inactiveVendor.vendor_name,
        email: inactiveVendor.email,
        inactiveDays,
        lastActivityAt: formatDate(inactiveVendor.last_activity_at),
        url: '/admin/users',
      },
    });

    notificationsSent += notificationResult.sentCount;

    const emailResults = await Promise.allSettled(
      adminUsers.map((admin) =>
        emailService.sendEmail({
          to: admin.email,
          subject: `Inactive vendor review: ${inactiveVendor.vendor_name}`,
          html: inactivityEmailHtml(inactiveVendor),
          category: 'system',
        })
      )
    );

    emailsSent += emailResults.filter(
      (result) => result.status === 'fulfilled' && result.value.success
    ).length;
  }

  return {
    enabled: true,
    thresholdDays: inactivityPolicy.vendorInactivityDays,
    cooldownDays: inactivityPolicy.vendorInactivityCooldownDays,
    warningLeadDays,
    warningCandidates: warningVendors.length,
    warningNotificationsSent,
    warningEmailsSent,
    candidates: inactiveVendors.length,
    notified: inactiveVendors.length,
    notificationsSent,
    emailsSent,
  };
}

export async function POST(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const result = await runVendorInactivityCheck();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('Vendor inactivity cron failed:', error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Vendor Inactivity Review',
    description: 'Advisory job that alerts system admins about approved vendors with no recent activity.',
    schedule: 'Daily via /api/cron/daily-maintenance',
    usage: 'POST /api/cron/vendor-inactivity with Authorization: Bearer <CRON_SECRET>',
  });
}
