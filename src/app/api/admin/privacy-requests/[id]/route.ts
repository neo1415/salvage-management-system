import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { dataRightRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';

const ALLOWED_ROLES = ['system_admin', 'salvage_manager'] as const;

const updateSchema = z.object({
  status: z.enum(['submitted', 'in_review', 'completed', 'rejected', 'cancelled']),
  responseNotes: z.string().trim().max(3000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid privacy request update' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(dataRightRequests)
      .where(eq(dataRightRequests.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Privacy request not found' }, { status: 404 });
    }

    const resolved = ['completed', 'rejected', 'cancelled'].includes(parsed.data.status);

    const [updated] = await db
      .update(dataRightRequests)
      .set({
        status: parsed.data.status,
        responseNotes: parsed.data.responseNotes ?? null,
        resolvedBy: resolved ? session.user.id : null,
        resolvedAt: resolved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(dataRightRequests.id, id))
      .returning();

    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.PRIVACY_REQUEST_REVIEWED,
        AuditEntityType.PRIVACY_REQUEST,
        id,
        {
          status: existing.status,
          responseNotes: existing.responseNotes,
        },
        {
          requestType: updated.type,
          status: updated.status,
          responseNotes: updated.responseNotes,
          resolved: Boolean(updated.resolvedAt),
        }
      )
    );

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('PATCH /api/admin/privacy-requests/[id]:', error);
    return NextResponse.json({ error: 'Failed to update privacy request' }, { status: 500 });
  }
}
