import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { ExportService } from '@/features/export/services/export.service';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
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

function safeJoin(values: unknown): string {
  return Array.isArray(values) ? values.map(String).join('; ') : '';
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function section(title: string, rows: Array<Record<string, unknown>>): string {
  return [
    '',
    title,
    ExportService.generateCSV({
      filename: 'section.csv',
      columns: [
        { key: 'field', header: 'Field' },
        { key: 'value', header: 'Value' },
      ],
      data: rows,
    }),
  ].join('\n');
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

  const providerRows = providerRecords.map((record) => {
    const reviewer = reviewers.find((item) => item.id === record.reviewedBy);
    return {
      provider: record.provider,
      verificationType: record.verificationType,
      providerReference: record.providerReference || '',
      workflowReference: record.workflowReference || '',
      status: record.status,
      riskLevel: record.riskLevel,
      checksCompleted: safeJoin(record.checksCompleted),
      pendingChecks: safeJoin(record.pendingChecks),
      failedChecks: safeJoin(record.failedChecks),
      reviewRequiredChecks: safeJoin(record.reasonCodes),
      reviewer: reviewer ? `${reviewer.fullName} <${reviewer.email}>` : '',
      decision: record.finalDecision || '',
      decisionReason: record.decisionReason || '',
      reviewedAt: formatDate(record.reviewedAt),
      updatedAt: formatDate(record.updatedAt),
    };
  });

  const fraudRows = alerts.map((alert) => {
    const metadata = alert.metadata as {
      source?: string;
      providerReference?: string;
      workflowReference?: string;
      riskLevel?: string;
      reasonCodes?: string[];
    } | null;

    return {
      source: metadata?.source || 'system',
      status: alert.status,
      riskScore: alert.riskScore,
      severity: alert.riskScore >= 90 ? 'critical' : alert.riskScore >= 75 ? 'high' : alert.riskScore >= 50 ? 'medium' : 'low',
      providerReference: metadata?.providerReference || '',
      workflowReference: metadata?.workflowReference || '',
      reasonCodes: safeJoin(metadata?.reasonCodes || alert.flagReasons),
      createdAt: formatDate(alert.createdAt),
    };
  });

  const auditRows = auditTrail.map((log) => ({
    timestamp: formatDate(log.createdAt),
    action: log.actionType,
    entityType: log.entityType,
    entityId: log.entityId,
  }));

  const csvParts = [
    `${branding.brandName} Vendor Verification Evidence Packet`,
    section('Vendor Identity Summary', [
      { field: 'Vendor ID', value: vendor.id },
      { field: 'User ID', value: vendor.userId },
      { field: 'Full Name', value: vendorUser?.fullName || '' },
      { field: 'Email', value: vendorUser?.email || '' },
      { field: 'Phone', value: vendorUser?.phone || '' },
      { field: 'User Status', value: vendorUser?.status || '' },
      { field: 'Vendor Status', value: vendor.status },
      { field: 'Vendor Tier', value: vendor.tier },
      { field: 'Created At', value: formatDate(vendor.createdAt) },
    ]),
    section('Business Identity Summary', [
      { field: 'Business Name', value: vendor.businessName || 'Individual' },
      { field: 'Business Type', value: vendor.businessType || '' },
      { field: 'CAC Number', value: maskIdentifier(vendor.cacNumber) },
      { field: 'TIN', value: maskIdentifier(vendor.tin) },
      { field: 'Bank Name', value: vendor.bankName || '' },
      { field: 'Bank Account Number', value: maskIdentifier(vendor.bankAccountNumber) },
      { field: 'Bank Account Name', value: vendor.bankAccountName || '' },
    ]),
    '',
    'Verification Records',
    ExportService.generateCSV({
      filename: 'verification-records.csv',
      columns: [
        { key: 'provider', header: 'Provider' },
        { key: 'verificationType', header: 'Verification Type' },
        { key: 'providerReference', header: 'Provider Reference' },
        { key: 'workflowReference', header: 'Workflow Reference' },
        { key: 'status', header: 'Status' },
        { key: 'riskLevel', header: 'Risk Level' },
        { key: 'checksCompleted', header: 'Completed Checks' },
        { key: 'pendingChecks', header: 'Pending Checks' },
        { key: 'failedChecks', header: 'Failed Checks' },
        { key: 'reviewRequiredChecks', header: 'Review Required / Reason Codes' },
        { key: 'reviewer', header: 'Reviewer' },
        { key: 'decision', header: 'Decision' },
        { key: 'decisionReason', header: 'Decision Reason' },
        { key: 'reviewedAt', header: 'Reviewed At' },
        { key: 'updatedAt', header: 'Updated At' },
      ],
      data: providerRows,
    }),
    '',
    'Linked Fraud Alerts',
    ExportService.generateCSV({
      filename: 'linked-fraud-alerts.csv',
      columns: [
        { key: 'source', header: 'Source' },
        { key: 'status', header: 'Status' },
        { key: 'riskScore', header: 'Risk Score' },
        { key: 'severity', header: 'Severity' },
        { key: 'providerReference', header: 'Provider Reference' },
        { key: 'workflowReference', header: 'Workflow Reference' },
        { key: 'reasonCodes', header: 'Reason Codes' },
        { key: 'createdAt', header: 'Created At' },
      ],
      data: fraudRows,
    }),
    '',
    'Audit Trail Summary',
    ExportService.generateCSV({
      filename: 'audit-trail.csv',
      columns: [
        { key: 'timestamp', header: 'Timestamp' },
        { key: 'action', header: 'Action' },
        { key: 'entityType', header: 'Entity Type' },
        { key: 'entityId', header: 'Entity ID' },
      ],
      data: auditRows,
    }),
  ];

  await logAction(createAuditLogData(
    request,
    session.user.id,
    AuditActionType.REPORT_GENERATED,
    AuditEntityType.KYC,
    vendorId,
    undefined,
    {
      reportType: 'vendor_verification_evidence_packet',
      format: 'csv',
      providerRecordCount: providerRecords.length,
      fraudAlertCount: alerts.length,
      auditLogCount: auditTrail.length,
    }
  ));

  const csv = csvParts.join('\n');
  const filename = `vendor-verification-evidence-${vendorId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
