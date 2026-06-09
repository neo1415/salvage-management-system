import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { dataRightRequests, users } from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { businessPolicyService } from '@/features/business-policy';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { emailService } from '@/features/notifications/services/email.service';
import { brandLegalName } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
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
const PLATFORM_PRIVACY_EMAIL =
  process.env.SALVAGE_BRIDGE_PRIVACY_EMAIL ||
  process.env.PRIVACY_REQUESTS_TO_EMAIL ||
  'ademoladaniel@salvagebridge.com';

function actionForType(type: (typeof dataRightTypes)[number]): AuditActionType {
  if (type === 'export' || type === 'access') return AuditActionType.PRIVACY_EXPORT_REQUESTED;
  if (type === 'deactivation') return AuditActionType.ACCOUNT_DEACTIVATION_REQUESTED;
  if (type === 'deletion') return AuditActionType.ACCOUNT_DELETION_REQUESTED;
  return AuditActionType.PRIVACY_REQUEST_CREATED;
}

function isMissingPrivacyTableError(error: unknown) {
  const maybe = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } };
  const code = String(maybe?.code || maybe?.cause?.code || '').toLowerCase();
  const message = String(maybe?.message || maybe?.cause?.message || '').toLowerCase();
  return code === '42p01' || message.includes('data_right_requests') || message.includes('data right requests');
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char] ?? char;
  });
}

function formatRequestType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function notifyPrivacyReviewTeam(input: {
  requestId: string;
  type: (typeof dataRightTypes)[number];
  reason?: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    status: string;
  };
}) {
  let branding = DEFAULT_BUSINESS_POLICY.branding;

  try {
    const policy = await businessPolicyService.getEffectivePolicy();
    branding = policy.branding;
  } catch (error) {
    console.warn('[Privacy] Business policy unavailable while preparing privacy request email', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const recipients = Array.from(
    new Set(
      [branding.supportEmail, PLATFORM_PRIVACY_EMAIL]
        .map((email) => email?.trim())
        .filter((email): email is string => Boolean(email))
    )
  );

  if (recipients.length === 0) return;

  const safeType = escapeHtml(formatRequestType(input.type));
  const safeName = escapeHtml(input.user.fullName);
  const safeEmail = escapeHtml(input.user.email);
  const safePhone = escapeHtml(input.user.phone);
  const safeRole = escapeHtml(input.user.role);
  const safeStatus = escapeHtml(input.user.status);
  const safeReason = escapeHtml(input.reason || 'No notes supplied.');
  const safeRequestId = escapeHtml(input.requestId);
  const subject = `[Privacy request] ${safeType} from ${input.user.fullName}`;
  const html = await wrapProfessionalEmail(
    'Privacy Request Submitted',
    `
      <p>A new privacy/data-rights request was submitted from the settings page.</p>
      <div style="background:#f8fafc;border-left:4px solid ${branding.primaryColor};padding:14px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;"><strong>Request type</strong></p>
        <p style="margin:0;font-size:16px;"><strong>${safeType}</strong></p>
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#64748b;">Requester</td><td style="padding:8px 0;"><strong>${safeName}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:${branding.primaryColor};">${safeEmail}</a></td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;">${safePhone}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Role</td><td style="padding:8px 0;">${safeRole}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Account status</td><td style="padding:8px 0;">${safeStatus}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Request ID</td><td style="padding:8px 0;">${safeRequestId}</td></tr>
      </table>
      <div style="background:#fff7ed;border-radius:10px;padding:14px;margin:16px 0;">
        <p style="margin:0 0 8px;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:.08em;"><strong>Requester notes</strong></p>
        <p style="margin:0;white-space:pre-wrap;">${safeReason}</p>
      </div>
      <p style="margin-top:18px;">Review this request in the admin privacy request console before fulfilment. Do not delete or anonymize records until legal, audit, payment, fraud, document, and dispute-retention checks are complete.</p>
      <p style="font-size:12px;color:#64748b;">${brandLegalName(branding)}</p>
    `,
    `New ${safeType} privacy request from ${input.user.fullName}.`
  );

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      emailService.sendEmail({
        to: recipient,
        replyTo: input.user.email,
        subject,
        html,
        category: 'system',
        critical: true,
      })
    )
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('[Privacy] Failed to send privacy request email', {
        recipient: recipients[index],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    } else if (!result.value.success) {
      console.error('[Privacy] Failed to send privacy request email', {
        recipient: recipients[index],
        error: result.value.error,
      });
    }
  });
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
    if (isMissingPrivacyTableError(error)) {
      return NextResponse.json(
        {
          requests: [],
          setupRequired: true,
          warning:
            'Privacy request storage is not ready yet. Ask an administrator to run the latest database migrations.',
          capabilities: {
            mode: 'request_review',
            supportedTypes: dataRightTypes,
            notice:
              'Requests are reviewed against legal, payment, fraud, audit, and dispute-retention obligations before fulfilment.',
          },
        },
        { status: 200 }
      );
    }
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
      .select({
        id: users.id,
        status: users.status,
        role: users.role,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
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

    await notifyPrivacyReviewTeam({
      requestId: created.id,
      type: created.type,
      reason: parsed.data.reason || null,
      user,
    });

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
    if (isMissingPrivacyTableError(error)) {
      return NextResponse.json(
        {
          error:
            'Privacy request storage is not ready yet. Ask an administrator to run the latest database migrations.',
          setupRequired: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to create privacy request' }, { status: 500 });
  }
}
