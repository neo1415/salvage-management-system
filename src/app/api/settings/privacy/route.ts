import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { dataRightRequests, users } from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';

const dataRightTypes = [
  'access',
  'export',
  'correction',
  'deactivation',
  'deletion',
  'restriction',
  'objection',
] as const;

const createRequestSchema = z.object({
  type: z.enum(dataRightTypes),
  reason: z.string().trim().max(1500).optional(),
});

const OPEN_STATUSES = ['submitted', 'in_review'] as const;

function actionForType(type: (typeof dataRightTypes)[number]): AuditActionType {
  if (type === 'export' || type === 'access') return AuditActionType.PRIVACY_EXPORT_REQUESTED;
  if (type === 'deactivation') return AuditActionType.ACCOUNT_DEACTIVATION_REQUESTED;
  if (type === 'deletion') return AuditActionType.ACCOUNT_DELETION_REQUESTED;
  return AuditActionType.PRIVACY_REQUEST_CREATED;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await db
      .select({
        id: dataRightRequests.id,
        type: dataRightRequests.type,
        status: dataRightRequests.status,
        reason: dataRightRequests.reason,
        responseNotes: dataRightRequests.responseNotes,
        resolvedAt: dataRightRequests.resolvedAt,
        createdAt: dataRightRequests.createdAt,
        updatedAt: dataRightRequests.updatedAt,
      })
      .from(dataRightRequests)
      .where(eq(dataRightRequests.userId, session.user.id))
      .orderBy(desc(dataRightRequests.createdAt))
      .limit(25);

    return NextResponse.json({
      requests,
      capabilities: {
        mode: 'request_review',
        supportedTypes: dataRightTypes,
        notice:
          'Requests are reviewed against legal, payment, fraud, audit, and dispute-retention obligations before fulfilment.',
      },
    });
  } catch (error) {
    console.error('GET /api/settings/privacy:', error);
    return NextResponse.json({ error: 'Failed to load privacy requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = createRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid privacy request' },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ id: users.id, status: users.status, role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status === 'deleted') {
      return NextResponse.json(
        { error: 'This account is already marked as deleted.' },
        { status: 409 }
      );
    }

    const [existingOpenRequest] = await db
      .select({ id: dataRightRequests.id })
      .from(dataRightRequests)
      .where(
        and(
          eq(dataRightRequests.userId, session.user.id),
          eq(dataRightRequests.type, parsed.data.type),
          inArray(dataRightRequests.status, [...OPEN_STATUSES])
        )
      )
      .limit(1);

    if (existingOpenRequest) {
      return NextResponse.json(
        { error: 'You already have an open request of this type.' },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(dataRightRequests)
      .values({
        userId: session.user.id,
        type: parsed.data.type,
        reason: parsed.data.reason || null,
        requestedData: {
          requesterRole: user.role,
          accountStatusAtRequest: user.status,
          source: 'settings_privacy_page',
        },
      })
      .returning({
        id: dataRightRequests.id,
        type: dataRightRequests.type,
        status: dataRightRequests.status,
        createdAt: dataRightRequests.createdAt,
      });

    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        actionForType(parsed.data.type),
        AuditEntityType.PRIVACY_REQUEST,
        created.id,
        undefined,
        {
          requestType: created.type,
          status: created.status,
          mode: 'request_review',
        }
      )
    );

    return NextResponse.json(
      {
        success: true,
        request: created,
        message:
          parsed.data.type === 'deactivation'
            ? 'Account deactivation request received for review.'
            : 'Privacy request received for review.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/settings/privacy:', error);
    return NextResponse.json({ error: 'Failed to create privacy request' }, { status: 500 });
  }
}
