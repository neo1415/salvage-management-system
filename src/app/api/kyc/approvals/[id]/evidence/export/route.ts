import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
import {
  sanitizeVerificationProviderLabel,
  sanitizeVerificationUserMessage,
  sanitizeWorkflowReference,
} from '@/lib/kyc/kyc-user-messages';
import { formatReasonCode } from '@/features/kyc/utils/provider-evidence-display';
import { generateVendorEvidencePdf } from '@/lib/kyc/vendor-evidence-pdf';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';

function maskIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const clean = value.trim();
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatReasonCodes(values: unknown): string {
  if (!Array.isArray(values)) return '';
  return values.map((value) => formatReasonCode(String(value))).join('; ');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['system_admin', 'salvage_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: vendorId } = await params;
  const branding = await getEmailBranding();

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  const [vendorUser] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, vendor.userId))
    .limit(1);

  const providerRecords = await db
    .select()
    .from(providerVerificationRecords)
    .where(eq(providerVerificationRecords.vendorId, vendorId))
    .orderBy(desc(providerVerificationRecords.updatedAt));

  const reviewerIds = [
    ...new Set(providerRecords.map((record) => record.reviewedBy).filter(Boolean) as string[]),
  ];
  const reviewers = reviewerIds.length
    ? await db
        .select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users)
        .where(inArray(users.id, reviewerIds))
    : [];

  const alerts = await db
    .select()
    .from(fraudAlerts)
    .where(or(
      eq(fraudAlerts.entityId, vendorId),
      and(eq(fraudAlerts.entityType, 'vendor'), eq(fraudAlerts.entityId, vendorId))
    ))
    .orderBy(desc(fraudAlerts.createdAt));

  const auditTrail = await db.query.auditLogs.findMany({
    where: or(
      eq(auditLogs.entityId, vendorId),
      eq(auditLogs.entityId, vendor.userId)
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit: 50,
  });

  const verificationTableRows = providerRecords.map((record) => {
    const reviewer = reviewers.find((item) => item.id === record.reviewedBy);
    return [
      sanitizeVerificationProviderLabel(record.provider),
      record.verificationType,
      record.providerReference || '',
      sanitizeWorkflowReference(record.workflowReference),
      record.status,
      record.riskLevel || '',
      formatCheckList(record.checksCompleted),
      formatCheckList(record.pendingChecks),
      formatCheckList(record.failedChecks),
      formatReasonCodes(record.reasonCodes),
      reviewer ? `${reviewer.fullName} <${reviewer.email}>` : '',
      record.finalDecision || '',
      sanitizeVerificationUserMessage(record.decisionReason) || record.decisionReason || '',
      formatDate(record.reviewedAt),
      formatDate(record.updatedAt),
    ];
  });

  const fraudTableRows = alerts.map((alert) => {
    const metadata = alert.metadata as {
      source?: string;
      providerReference?: string;
      workflowReference?: string;
      riskLevel?: string;
      reasonCodes?: string[];
    } | null;

    return [
      sanitizeVerificationProviderLabel(metadata?.source || 'system'),
      alert.status,
      String(alert.riskScore),
      alert.riskScore >= 90 ? 'critical' : alert.riskScore >= 75 ? 'high' : alert.riskScore >= 50 ? 'medium' : 'low',
      metadata?.providerReference || '',
      sanitizeWorkflowReference(metadata?.workflowReference),
      formatReasonCodes(metadata?.reasonCodes || alert.flagReasons),
      formatDate(alert.createdAt),
    ];
  });

  const auditTableRows = auditTrail.map((log) => [
    formatDate(log.createdAt),
    formatReasonCode(log.actionType),
    log.entityType,
    log.entityId,
  ]);

  const pdfBuffer = await generateVendorEvidencePdf({
    title: 'VENDOR VERIFICATION EVIDENCE',
    subtitle: `${branding.brandName} | Vendor ${vendorId.slice(0, 8)} | Generated ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`,
    keyValueSections: [
      {
        title: 'Vendor Identity Summary',
        rows: [
          { label: 'Vendor ID', value: vendor.id },
          { label: 'User ID', value: vendor.userId },
          { label: 'Full Name', value: vendorUser?.fullName || '' },
          { label: 'Email', value: vendorUser?.email || '' },
          { label: 'Phone', value: vendorUser?.phone || '' },
          { label: 'User Status', value: vendorUser?.status || '' },
          { label: 'Vendor Status', value: vendor.status },
          { label: 'Vendor Tier', value: vendor.tier },
          { label: 'Created At', value: formatDate(vendor.createdAt) },
        ],
      },
      {
        title: 'Business Identity Summary',
        rows: [
          { label: 'Business Name', value: vendor.businessName || 'Individual' },
          { label: 'Business Type', value: vendor.businessType || '' },
          { label: 'CAC Number', value: maskIdentifier(vendor.cacNumber) },
        ],
      },
    ],
    tables: [
      {
        title: 'Verification Records',
        headers: [
          'Provider',
          'Type',
          'Reference',
          'Workflow',
          'Status',
          'Risk',
          'Completed',
          'Pending',
          'Failed',
          'Reason codes',
          'Reviewer',
          'Decision',
          'Reason',
          'Reviewed',
          'Updated',
        ],
        rows: verificationTableRows,
      },
      {
        title: 'Linked Fraud Alerts',
        headers: [
          'Source',
          'Status',
          'Risk score',
          'Severity',
          'Reference',
          'Workflow',
          'Reason codes',
          'Created',
        ],
        rows: fraudTableRows,
      },
      {
        title: 'Audit Trail Summary',
        headers: ['Timestamp', 'Action', 'Entity type', 'Entity ID'],
        rows: auditTableRows,
      },
    ],
    footerNote: `${branding.brandName} | Confidential`,
  });

  await logAction(createAuditLogData(
    request,
    session.user.id,
    AuditActionType.REPORT_GENERATED,
    AuditEntityType.KYC,
    vendorId,
    undefined,
    {
      reportType: 'vendor_verification_evidence_packet',
      format: 'pdf',
      providerRecordCount: providerRecords.length,
      fraudAlertCount: alerts.length,
      auditLogCount: auditTrail.length,
    }
  ));

  const filename = `vendor-verification-evidence-${vendorId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function formatCheckList(checks: string[] | null | undefined): string {
  if (!checks?.length) return '';
  return checks.map((check) => check.replace(/_/g, ' ')).join('; ');
}
