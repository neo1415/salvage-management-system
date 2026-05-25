import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';
import { cache } from '@/lib/redis/client';

const ActionSchema = z.object({
  action: z.enum(['mark_under_review', 'resolve', 'dismiss_false_positive', 'suspend_vendor', 'suspend_user']),
  reason: z.string().trim().optional(),
});

function appendReviewHistory(
  metadata: unknown,
  entry: { action: string; reason?: string; actorId: string; actorName: string }
) {
  const existing = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;
  const history = Array.isArray(existing.reviewHistory) ? existing.reviewHistory : [];

  return {
    ...existing,
    reviewHistory: [
      ...history,
      {
        ...entry,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

async function resolveVendorId(alert: typeof fraudAlerts.$inferSelect): Promise<string | null> {
  if (alert.entityType === 'vendor') return alert.entityId;

  const metadata = alert.metadata as { vendorIds?: string[]; vendorId?: string } | null;
  if (metadata?.vendorId) return metadata.vendorId;
  if (metadata?.vendorIds?.[0]) return metadata.vendorIds[0];

  if (alert.entityType === 'user') {
    const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, alert.entityId)).limit(1);
    return vendor?.id ?? null;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actor = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!actor || actor.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action, reason } = parsed.data;
  const needsReason = ['resolve', 'dismiss_false_positive', 'suspend_vendor', 'suspend_user'].includes(action);
  if (needsReason && (!reason || reason.length < 10)) {
    return NextResponse.json({ error: 'Reason is required (minimum 10 characters)' }, { status: 400 });
  }

  const [alert] = await db.select().from(fraudAlerts).where(eq(fraudAlerts.id, id)).limit(1);
  if (!alert) {
    return NextResponse.json({ error: 'Fraud alert not found' }, { status: 404 });
  }

  const nextStatus =
    action === 'dismiss_false_positive'
      ? 'dismissed'
      : action === 'resolve'
        ? 'confirmed'
        : 'reviewed';

  const metadata = appendReviewHistory(alert.metadata, {
    action,
    reason,
    actorId: actor.id,
    actorName: actor.fullName,
  });

  const [updatedAlert] = await db
    .update(fraudAlerts)
    .set({
      status: nextStatus,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      metadata: metadata as any,
    })
    .where(eq(fraudAlerts.id, id))
    .returning();

  await logAction(createAuditLogData(
    request,
    actor.id,
    action === 'dismiss_false_positive'
      ? AuditActionType.FRAUD_FLAG_DISMISSED
      : AuditActionType.FRAUD_ALERT_UPDATED_FROM_DOJAH,
    AuditEntityType.FRAUD_FLAG,
    id,
    {
      status: alert.status,
      metadata: alert.metadata ?? null,
    },
    {
      action,
      status: nextStatus,
      reason,
      source: (metadata as Record<string, unknown>).source ?? 'intelligence',
      entityType: alert.entityType,
      entityId: alert.entityId,
    }
  ));

  let affectedEntity: { type: 'vendor' | 'user'; id: string } | null = null;

  if (action === 'suspend_vendor') {
    const vendorId = await resolveVendorId(alert);
    if (!vendorId) {
      return NextResponse.json({ error: 'No linked vendor found for this alert' }, { status: 400 });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    await db.update(vendors).set({ status: 'suspended', updatedAt: new Date() }).where(eq(vendors.id, vendorId));
    await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, vendor.userId));

    await logAction(createAuditLogData(
      request,
      actor.id,
      AuditActionType.VENDOR_SUSPENDED,
      AuditEntityType.VENDOR,
      vendorId,
      { vendorStatus: vendor.status, userId: vendor.userId },
      { vendorStatus: 'suspended', userStatus: 'suspended', reason, fraudAlertId: id }
    ));

    affectedEntity = { type: 'vendor', id: vendorId };
  }

  if (action === 'suspend_user') {
    const userId = alert.entityType === 'user' ? alert.entityId : null;
    if (!userId) {
      return NextResponse.json({ error: 'This alert is not directly linked to a user' }, { status: 400 });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, userId));
    await logAction(createAuditLogData(
      request,
      actor.id,
      AuditActionType.USER_SUSPENDED,
      AuditEntityType.USER,
      userId,
      { userStatus: targetUser.status },
      { userStatus: 'suspended', reason, fraudAlertId: id }
    ));

    affectedEntity = { type: 'user', id: userId };
  }

  await cache.del('dashboard:admin');

  return NextResponse.json({
    success: true,
    alert: updatedAlert,
    affectedEntity,
  });
}
