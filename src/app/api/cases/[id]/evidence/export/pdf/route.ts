import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import fs from 'node:fs/promises';
import path from 'node:path';
import { desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { auctionDocuments } from '@/lib/db/schema/auction-deposit';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';

const ALLOWED_ROLES = new Set([
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

type Row = Array<string | number | null | undefined | Date | boolean>;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `NGN ${new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAssetDetails(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return text(value);
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
    .map(([key, entryValue]) => `${key}: ${entryValue}`)
    .join(', ') || '-';
}

function countJsonItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function addPageIfNeeded(doc: jsPDF, y: number, required = 18): number {
  if (y + required <= 282) return y;
  doc.addPage();
  return 18;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = addPageIfNeeded(doc, y, 16);
  doc.setFillColor(4, 0, 122);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 17, y + 5.5);
  doc.setTextColor(17, 24, 39);
  return y + 14;
}

function addKeyValues(doc: jsPDF, rows: Row[], y: number): number {
  doc.setFontSize(9);
  for (const row of rows) {
    y = addPageIfNeeded(doc, y, 8);
    const [label, value] = row;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(text(label), 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(text(value), 118);
    doc.text(lines, 70, y);
    y += Math.max(6, lines.length * 4.5);
  }
  return y + 2;
}

function addTable(doc: jsPDF, headers: string[], rows: Row[], y: number): number {
  y = addPageIfNeeded(doc, y, 12);
  const x = 14;
  const width = 182;
  const colWidth = width / headers.length;

  doc.setFillColor(243, 244, 246);
  doc.rect(x, y - 5, width, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  headers.forEach((header, index) => {
    doc.text(header, x + index * colWidth + 2, y);
  });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  rows.forEach((row) => {
    y = addPageIfNeeded(doc, y, 10);
    row.forEach((cell, index) => {
      const lines = doc.splitTextToSize(text(cell), colWidth - 4);
      doc.text(lines.slice(0, 2), x + index * colWidth + 2, y);
    });
    doc.setDrawColor(229, 231, 235);
    doc.line(x, y + 3, x + width, y + 3);
    y += 8;
  });

  if (rows.length === 0) {
    doc.text('No records found.', x + 2, y);
    y += 8;
  }

  return y + 4;
}

async function addBrandLogo(doc: jsPDF, logoPath: string | undefined, x: number, y: number): Promise<boolean> {
  if (!logoPath || !logoPath.startsWith('/')) return false;

  try {
    const localPath = path.join(process.cwd(), 'public', logoPath.replace(/^\/+/, ''));
    const bytes = await fs.readFile(localPath);
    const extension = path.extname(localPath).toLowerCase();
    const imageType = extension === '.jpg' || extension === '.jpeg' ? 'JPEG' : 'PNG';
    doc.addImage(bytes.toString('base64'), imageType, x, y, 20, 20);
    return true;
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || !ALLOWED_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: caseId } = await params;

  const [caseRecord] = await db
    .select({
      id: salvageCases.id,
      claimReference: salvageCases.claimReference,
      assetType: salvageCases.assetType,
      assetDetails: salvageCases.assetDetails,
      marketValue: salvageCases.marketValue,
      estimatedSalvageValue: salvageCases.estimatedSalvageValue,
      reservePrice: salvageCases.reservePrice,
      damageSeverity: salvageCases.damageSeverity,
      aiAssessment: salvageCases.aiAssessment,
      gpsLocation: salvageCases.gpsLocation,
      locationName: salvageCases.locationName,
      locationAccuracyMeters: salvageCases.locationAccuracyMeters,
      locationSource: salvageCases.locationSource,
      locationCapturedAt: salvageCases.locationCapturedAt,
      locationManualOverride: salvageCases.locationManualOverride,
      photos: salvageCases.photos,
      voiceNotes: salvageCases.voiceNotes,
      status: salvageCases.status,
      createdBy: salvageCases.createdBy,
      approvedBy: salvageCases.approvedBy,
      createdAt: salvageCases.createdAt,
      updatedAt: salvageCases.updatedAt,
      approvedAt: salvageCases.approvedAt,
      adjusterName: users.fullName,
      adjusterEmail: users.email,
    })
    .from(salvageCases)
    .leftJoin(users, eq(salvageCases.createdBy, users.id))
    .where(eq(salvageCases.id, caseId))
    .limit(1);

  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  if (session.user.role === 'claims_adjuster' && caseRecord.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const auctionRows = await db
    .select()
    .from(auctions)
    .where(eq(auctions.caseId, caseId))
    .orderBy(desc(auctions.createdAt));

  const auctionIds = auctionRows.map((auction) => auction.id);

  const [bidRows, paymentRows, documentRows] = auctionIds.length
    ? await Promise.all([
        db
          .select({
            auctionId: bids.auctionId,
            vendorBusinessName: vendors.businessName,
            amount: bids.amount,
            status: bids.status,
            otpVerified: bids.otpVerified,
            deviceType: bids.deviceType,
            createdAt: bids.createdAt,
          })
          .from(bids)
          .leftJoin(vendors, eq(bids.vendorId, vendors.id))
          .where(inArray(bids.auctionId, auctionIds))
          .orderBy(desc(bids.createdAt)),
        db
          .select({
            auctionId: payments.auctionId,
            vendorBusinessName: vendors.businessName,
            amount: payments.amount,
            paymentMethod: payments.paymentMethod,
            paymentReference: payments.paymentReference,
            escrowStatus: payments.escrowStatus,
            status: payments.status,
            verifiedAt: payments.verifiedAt,
            autoVerified: payments.autoVerified,
            paymentDeadline: payments.paymentDeadline,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .leftJoin(vendors, eq(payments.vendorId, vendors.id))
          .where(inArray(payments.auctionId, auctionIds))
          .orderBy(desc(payments.createdAt)),
        db
          .select({
            auctionId: auctionDocuments.auctionId,
            vendorBusinessName: vendors.businessName,
            type: auctionDocuments.type,
            status: auctionDocuments.status,
            signedAt: auctionDocuments.signedAt,
            validityDeadline: auctionDocuments.validityDeadline,
            createdAt: auctionDocuments.createdAt,
          })
          .from(auctionDocuments)
          .leftJoin(vendors, eq(auctionDocuments.vendorId, vendors.id))
          .where(inArray(auctionDocuments.auctionId, auctionIds))
          .orderBy(desc(auctionDocuments.createdAt)),
      ])
    : [[], [], []];

  const auditRows = await db
    .select({
      actionType: auditLogs.actionType,
      entityType: auditLogs.entityType,
      deviceType: auditLogs.deviceType,
      createdAt: auditLogs.createdAt,
      recordHash: auditLogs.recordHash,
    })
    .from(auditLogs)
    .where(eq(auditLogs.entityId, caseId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(60);

  const branding = await getEmailBranding();
  const generatedAt = new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(4, 0, 122);
  doc.rect(0, 0, 210, 32, 'F');
  const hasLogo = await addBrandLogo(doc, branding.logoPath, 14, 6);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${branding.brandName} Evidence Packet`, hasLogo ? 39 : 14, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Claim ${caseRecord.claimReference} | Generated ${formatDate(generatedAt)}`, hasLogo ? 39 : 14, 24);

  let y = 42;
  y = addSectionTitle(doc, 'Packet Summary', y);
  y = addKeyValues(doc, [
    ['Claim reference', caseRecord.claimReference],
    ['Case status', caseRecord.status],
    ['Asset type', caseRecord.assetType],
    ['Asset details', formatAssetDetails(caseRecord.assetDetails)],
    ['Generated by', `${session.user.email || session.user.id} (${session.user.role})`],
    ['Evidence scope', 'Case metadata, assessment, location, auction, bid, payment, pickup, document, and audit records. Protected files remain accessible only through secure download routes.'],
  ], y);

  y = addSectionTitle(doc, 'Claim And Valuation', y);
  y = addKeyValues(doc, [
    ['Market value / claim value', formatMoney(caseRecord.marketValue)],
    ['Estimated salvage value', formatMoney(caseRecord.estimatedSalvageValue)],
    ['Reserve price', formatMoney(caseRecord.reservePrice)],
    ['Damage severity', caseRecord.damageSeverity],
    ['AI assessment captured', caseRecord.aiAssessment ? 'Yes' : 'No'],
    ['Photo evidence count', countJsonItems(caseRecord.photos)],
    ['Voice note count', countJsonItems(caseRecord.voiceNotes)],
    ['Created by adjuster', `${caseRecord.adjusterName || '-'} (${caseRecord.adjusterEmail || '-'})`],
    ['Created', caseRecord.createdAt],
    ['Approved', caseRecord.approvedAt],
  ], y);

  y = addSectionTitle(doc, 'Location Evidence', y);
  y = addKeyValues(doc, [
    ['Location name', caseRecord.locationName],
    ['GPS location', text(caseRecord.gpsLocation)],
    ['Accuracy', caseRecord.locationAccuracyMeters ? `${caseRecord.locationAccuracyMeters}m` : '-'],
    ['Source', caseRecord.locationSource],
    ['Captured', caseRecord.locationCapturedAt],
    ['Manual override', caseRecord.locationManualOverride],
  ], y);

  y = addSectionTitle(doc, 'Auction Timeline', y);
  y = addTable(doc, ['Status', 'Start', 'End', 'Current Bid', 'Pickup'], auctionRows.map((auction) => [
    auction.status,
    formatDate(auction.startTime),
    formatDate(auction.endTime),
    formatMoney(auction.currentBid),
    auction.pickupConfirmedAdmin ? `Confirmed ${formatDate(auction.pickupConfirmedAdminAt)}` : 'Not confirmed',
  ]), y);

  y = addSectionTitle(doc, 'Bid Evidence', y);
  y = addTable(doc, ['Vendor', 'Amount', 'Status', 'OTP', 'Created'], bidRows.slice(0, 30).map((bid) => [
    bid.vendorBusinessName,
    formatMoney(bid.amount),
    bid.status,
    bid.otpVerified,
    formatDate(bid.createdAt),
  ]), y);

  y = addSectionTitle(doc, 'Payment And Settlement Evidence', y);
  y = addTable(doc, ['Vendor', 'Amount', 'Method', 'Status', 'Verified'], paymentRows.map((payment) => [
    payment.vendorBusinessName,
    formatMoney(payment.amount),
    payment.paymentMethod,
    `${payment.status}${payment.escrowStatus ? ` / ${payment.escrowStatus}` : ''}`,
    payment.verifiedAt ? formatDate(payment.verifiedAt) : '-',
  ]), y);

  y = addSectionTitle(doc, 'Document Evidence', y);
  y = addTable(doc, ['Vendor', 'Document', 'Status', 'Signed', 'Deadline'], documentRows.map((document) => [
    document.vendorBusinessName,
    document.type,
    document.status,
    document.signedAt ? formatDate(document.signedAt) : '-',
    document.validityDeadline ? formatDate(document.validityDeadline) : '-',
  ]), y);

  y = addSectionTitle(doc, 'Audit Trail Extract', y);
  y = addTable(doc, ['Action', 'Entity', 'Device', 'Time', 'Hash'], auditRows.map((audit) => [
    audit.actionType,
    audit.entityType,
    audit.deviceType,
    formatDate(audit.createdAt),
    audit.recordHash ? `${audit.recordHash.slice(0, 12)}...` : '-',
  ]), y);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated by ${branding.brandName} | Confidential`, 14, 290);
    doc.text(`Page ${page} of ${pageCount}`, 178, 290);
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const safeReference = caseRecord.claimReference.replace(/[^a-zA-Z0-9_-]/g, '-');

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="case-evidence-${safeReference}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
