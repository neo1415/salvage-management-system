import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import fs from 'node:fs/promises';
import path from 'node:path';
import { desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { pickupEvidence } from '@/lib/db/schema/pickup-evidence';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
import { buildCaseEvidenceAuditNarrative } from '@/lib/cases/evidence-audit-narrative';
import { formatVendorDisplayName } from '@/lib/utils/vendor-display-name';

const vendorUsers = alias(users, 'vendor_users');

const ALLOWED_ROLES = new Set([
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

type Row = Array<string | number | null | undefined | Date | boolean>;
type Rgb = [number, number, number];
type AuctionRow = typeof auctions.$inferSelect;
type PaymentRow = {
  id: string;
  auctionId: string | null;
  vendorBusinessName: string | null;
  vendorFullName: string | null;
  amount: string;
  paymentMethod: string;
  paymentReference: string | null;
  escrowStatus: string;
  status: string;
  verifiedAt: Date | null;
  autoVerified: boolean;
  paymentDeadline: Date;
  createdAt: Date;
};
type DocumentRow = {
  auctionId: string;
  vendorBusinessName: string | null;
  vendorFullName: string | null;
  title: string;
  documentType: string;
  status: string;
  signedAt: Date | null;
  validityDeadline: Date | null;
  paymentDeadline: Date | null;
  pdfUrl: string | null;
  documentData: {
    pickupDeadline?: string;
    pickupAuthCode?: string;
  };
  createdAt: Date;
};
type PickupEvidenceRow = {
  id: string;
  auctionId: string;
  vendorBusinessName: string | null;
  vendorFullName: string | null;
  photoUrls: string[];
  comparisonStatus: string;
  comparisonSummary: {
    status?: string;
    confidenceScore?: number;
    overallMatchScore?: number;
    assetIdentityScore?: number;
    quantityMatchScore?: number;
    conditionMatchScore?: number;
    reviewBand?: string;
    findings?: string[];
    observedDifferences?: string[];
    recommendedStaffAction?: string;
    method?: string;
  };
  resolutionStatus: string;
  adjustmentAmount: string | null;
  reimbursementMethod: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
};

function resolveVendorName(
  businessName: string | null | undefined,
  fullName: string | null | undefined
): string {
  return formatVendorDisplayName({ businessName, fullName });
}

function hexToRgb(hex: string | null | undefined, fallback: Rgb = [4, 0, 122]): Rgb {
  const normalized = typeof hex === 'string' ? hex.trim().replace(/^#/, '') : '';
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

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

function formatLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value)}%`;
}

function chooseOfficialAuction(auctionRows: AuctionRow[]): AuctionRow | null {
  const staffConfirmed = auctionRows
    .filter((auction) => auction.pickupConfirmedAdmin)
    .sort((a, b) => {
      const aTime = a.pickupConfirmedAdminAt?.getTime() ?? 0;
      const bTime = b.pickupConfirmedAdminAt?.getTime() ?? 0;
      return bTime - aTime;
    });

  return staffConfirmed[0] ?? auctionRows[0] ?? null;
}

function latestForAuction<T extends { auctionId: string | null; createdAt: Date }>(
  rows: T[],
  auctionId: string | null | undefined
): T[] {
  if (!auctionId) return rows;
  return rows
    .filter((row) => row.auctionId === auctionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function deriveAuctionLifecycleLabel(auction: AuctionRow, paymentsForAuction: PaymentRow[]): string {
  if (auction.pickupConfirmedAdmin) return 'Pickup confirmed';
  if (auction.pickupConfirmedVendor) return 'Vendor pickup evidence submitted';
  if (paymentsForAuction.some((payment) => payment.status === 'verified')) return 'Payment verified';
  return formatLabel(auction.status);
}

function displayDocumentStatus(document: DocumentRow, officialAuction?: AuctionRow | null): string {
  if (document.documentType === 'pickup_authorization') {
    return officialAuction?.pickupConfirmedAdmin ? 'Used for confirmed pickup' : 'Issued';
  }
  return formatLabel(document.status);
}

function documentCompletedAt(document: DocumentRow, officialAuction?: AuctionRow | null): string {
  if (document.documentType === 'pickup_authorization') {
    return officialAuction?.pickupConfirmedAdminAt
      ? formatDate(officialAuction.pickupConfirmedAdminAt)
      : formatDate(document.createdAt);
  }
  return document.signedAt ? formatDate(document.signedAt) : '-';
}

function documentDeadline(document: DocumentRow): string {
  if (document.documentType === 'pickup_authorization') {
    return document.documentData?.pickupDeadline
      ? formatDate(document.documentData.pickupDeadline)
      : document.validityDeadline
        ? formatDate(document.validityDeadline)
        : '-';
  }

  if (document.paymentDeadline) return `Payment ${formatDate(document.paymentDeadline)}`;
  if (document.validityDeadline) return formatDate(document.validityDeadline);
  return '-';
}

function pickupEvidenceDisplayStatus(evidence: PickupEvidenceRow, officialAuction?: AuctionRow | null): string {
  if (officialAuction?.pickupConfirmedAdmin) return 'Reviewed and release confirmed';
  if (evidence.reviewedAt) return 'Reviewed';
  return formatLabel(evidence.comparisonStatus);
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

function addSectionTitle(doc: jsPDF, title: string, y: number, brandRgb: Rgb): number {
  y = addPageIfNeeded(doc, y, 16);
  doc.setFillColor(...brandRgb);
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
  const officialAuction = chooseOfficialAuction(auctionRows);

  if (caseRecord.status !== 'sold' || !officialAuction?.pickupConfirmedAdmin) {
    return NextResponse.json(
      { error: 'Evidence packet is only available after staff-confirmed pickup.' },
      { status: 409 }
    );
  }

  const auctionIds = auctionRows.map((auction) => auction.id);

  const [bidRows, paymentRows, documentRows] = auctionIds.length
    ? await Promise.all([
        db
          .select({
            auctionId: bids.auctionId,
            vendorBusinessName: vendors.businessName,
            vendorFullName: vendorUsers.fullName,
            amount: bids.amount,
            status: bids.status,
            otpVerified: bids.otpVerified,
            deviceType: bids.deviceType,
            createdAt: bids.createdAt,
          })
          .from(bids)
          .leftJoin(vendors, eq(bids.vendorId, vendors.id))
          .leftJoin(vendorUsers, eq(vendors.userId, vendorUsers.id))
          .where(inArray(bids.auctionId, auctionIds))
          .orderBy(desc(bids.createdAt)),
        db
          .select({
            id: payments.id,
            auctionId: payments.auctionId,
            vendorBusinessName: vendors.businessName,
            vendorFullName: vendorUsers.fullName,
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
          .leftJoin(vendorUsers, eq(vendors.userId, vendorUsers.id))
          .where(inArray(payments.auctionId, auctionIds))
          .orderBy(desc(payments.createdAt)),
        db
          .select({
            auctionId: releaseForms.auctionId,
            vendorBusinessName: vendors.businessName,
            vendorFullName: vendorUsers.fullName,
            title: releaseForms.title,
            documentType: releaseForms.documentType,
            status: releaseForms.status,
            signedAt: releaseForms.signedAt,
            validityDeadline: releaseForms.validityDeadline,
            paymentDeadline: releaseForms.paymentDeadline,
            pdfUrl: releaseForms.pdfUrl,
            documentData: releaseForms.documentData,
            createdAt: releaseForms.createdAt,
          })
          .from(releaseForms)
          .leftJoin(vendors, eq(releaseForms.vendorId, vendors.id))
          .leftJoin(vendorUsers, eq(vendors.userId, vendorUsers.id))
          .where(inArray(releaseForms.auctionId, auctionIds))
          .orderBy(desc(releaseForms.createdAt)),
      ])
    : [[], [], []];

  const pickupEvidenceRows = auctionIds.length
    ? await db
        .select({
          id: pickupEvidence.id,
          auctionId: pickupEvidence.auctionId,
          vendorBusinessName: vendors.businessName,
          vendorFullName: vendorUsers.fullName,
          photoUrls: pickupEvidence.photoUrls,
          comparisonStatus: pickupEvidence.comparisonStatus,
          comparisonSummary: pickupEvidence.comparisonSummary,
          resolutionStatus: pickupEvidence.resolutionStatus,
          adjustmentAmount: pickupEvidence.adjustmentAmount,
          reimbursementMethod: pickupEvidence.reimbursementMethod,
          reviewedAt: pickupEvidence.reviewedAt,
          reviewNotes: pickupEvidence.reviewNotes,
          createdAt: pickupEvidence.createdAt,
        })
        .from(pickupEvidence)
        .leftJoin(vendors, eq(pickupEvidence.vendorId, vendors.id))
        .leftJoin(vendorUsers, eq(vendors.userId, vendorUsers.id))
        .where(inArray(pickupEvidence.auctionId, auctionIds))
        .orderBy(desc(pickupEvidence.createdAt))
    : [];

  let winnerName: string | null = null;
  if (officialAuction?.currentBidder) {
    const [winner] = await db
      .select({
        businessName: vendors.businessName,
        fullName: users.fullName,
      })
      .from(vendors)
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.id, officialAuction.currentBidder))
      .limit(1);
    winnerName = formatVendorDisplayName(winner);
  }

  const officialAuctionIds = officialAuction ? [officialAuction.id] : auctionIds;
  const displayAuctionRows = officialAuction ? [officialAuction] : auctionRows;
  const displayBidRows = bidRows.filter((bid) => officialAuctionIds.includes(bid.auctionId));
  const displayPaymentRows = latestForAuction(paymentRows, officialAuction?.id);
  const displayDocumentRows = documentRows.filter((document) => officialAuctionIds.includes(document.auctionId));
  const displayPickupEvidenceRows = latestForAuction(pickupEvidenceRows, officialAuction?.id).slice(0, 1);

  const narrativeEvents = buildCaseEvidenceAuditNarrative({
    claimReference: caseRecord.claimReference,
    adjusterName: caseRecord.adjusterName,
    createdAt: caseRecord.createdAt,
    approvedAt: caseRecord.approvedAt,
    winnerName,
    auction: officialAuction,
    bids: displayBidRows.map((bid) => ({
      vendorName: resolveVendorName(bid.vendorBusinessName, bid.vendorFullName),
      amount: bid.amount,
      status: bid.status,
      createdAt: bid.createdAt,
    })),
    payments: displayPaymentRows.map((payment) => ({
      vendorName: resolveVendorName(payment.vendorBusinessName, payment.vendorFullName),
      amount: payment.amount,
      status: payment.status,
      verifiedAt: payment.verifiedAt,
      createdAt: payment.createdAt,
    })),
    documents: displayDocumentRows.map((document) => ({
      vendorName: resolveVendorName(document.vendorBusinessName, document.vendorFullName),
      title: document.title,
      documentType: document.documentType,
      status: document.status,
      signedAt: document.signedAt,
      createdAt: document.createdAt,
    })),
    pickupEvidence: displayPickupEvidenceRows.map((evidence) => ({
      vendorName: resolveVendorName(evidence.vendorBusinessName, evidence.vendorFullName),
      createdAt: evidence.createdAt,
      reviewedAt: evidence.reviewedAt,
    })),
  });

  const branding = await getEmailBranding();
  const brandRgb = hexToRgb(branding.primaryColor);
  const generatedAt = new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(...brandRgb);
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
  y = addSectionTitle(doc, 'Packet Summary', y, brandRgb);
  y = addKeyValues(doc, [
    ['Claim reference', caseRecord.claimReference],
    ['Case status', caseRecord.status],
    ['Handover status', officialAuction?.pickupConfirmedAdmin ? `Pickup confirmed ${formatDate(officialAuction.pickupConfirmedAdminAt)}` : 'Pickup not staff-confirmed'],
    ['Asset type', caseRecord.assetType],
    ['Asset details', formatAssetDetails(caseRecord.assetDetails)],
    ['Generated by', `${session.user.email || session.user.id} (${session.user.role})`],
    ['Evidence scope', 'Case metadata, assessment, location, auction, bid, payment, pickup, document, and audit records. Protected files remain accessible only through secure download routes.'],
  ], y);

  y = addSectionTitle(doc, 'Claim And Valuation', y, brandRgb);
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

  y = addSectionTitle(doc, 'Location Evidence', y, brandRgb);
  y = addKeyValues(doc, [
    ['Location name', caseRecord.locationName],
    ['GPS location', text(caseRecord.gpsLocation)],
    ['Accuracy', caseRecord.locationAccuracyMeters ? `${caseRecord.locationAccuracyMeters}m` : '-'],
    ['Source', caseRecord.locationSource],
    ['Captured', caseRecord.locationCapturedAt],
    ['Manual override', caseRecord.locationManualOverride],
  ], y);

  y = addSectionTitle(doc, 'Auction Timeline', y, brandRgb);
  y = addTable(doc, ['Lifecycle', 'Start', 'End', 'Winning Bid', 'Pickup'], displayAuctionRows.map((auction) => [
    deriveAuctionLifecycleLabel(auction, displayPaymentRows),
    formatDate(auction.startTime),
    formatDate(auction.endTime),
    formatMoney(auction.currentBid),
    auction.pickupConfirmedAdmin ? `Confirmed ${formatDate(auction.pickupConfirmedAdminAt)}` : 'Not confirmed',
  ]), y);

  y = addSectionTitle(doc, 'Bid Evidence', y, brandRgb);
  y = addTable(doc, ['Vendor', 'Amount', 'Status', 'OTP', 'Created'], displayBidRows.slice(0, 30).map((bid) => [
    resolveVendorName(bid.vendorBusinessName, bid.vendorFullName),
    formatMoney(bid.amount),
    bid.status,
    bid.otpVerified,
    formatDate(bid.createdAt),
  ]), y);

  y = addSectionTitle(doc, 'Payment And Settlement Evidence', y, brandRgb);
  y = addTable(doc, ['Vendor', 'Amount', 'Method', 'Reference', 'Verified'], displayPaymentRows.map((payment) => [
    resolveVendorName(payment.vendorBusinessName, payment.vendorFullName),
    formatMoney(payment.amount),
    formatLabel(payment.paymentMethod),
    payment.paymentReference,
    payment.verifiedAt ? formatDate(payment.verifiedAt) : '-',
  ]), y);

  y = addSectionTitle(doc, 'Document Evidence', y, brandRgb);
  y = addTable(doc, ['Vendor', 'Document', 'Status', 'Completed', 'Deadline'], displayDocumentRows.map((document) => [
    resolveVendorName(document.vendorBusinessName, document.vendorFullName),
    document.title || document.documentType,
    displayDocumentStatus(document, officialAuction),
    documentCompletedAt(document, officialAuction),
    documentDeadline(document),
  ]), y);

  y = addSectionTitle(doc, 'Pickup Evidence', y, brandRgb);
  y = addTable(doc, ['Vendor', 'Photos', 'Review Outcome', 'Match', 'Resolution'], displayPickupEvidenceRows.map((evidence) => [
    resolveVendorName(evidence.vendorBusinessName, evidence.vendorFullName),
    evidence.photoUrls?.length ?? 0,
    pickupEvidenceDisplayStatus(evidence, officialAuction),
    formatScore(evidence.comparisonSummary?.overallMatchScore ?? evidence.comparisonSummary?.confidenceScore),
    formatLabel(evidence.resolutionStatus),
  ]), y);

  for (const evidence of displayPickupEvidenceRows) {
    const findings = evidence.comparisonSummary?.findings ?? [];
    const differences = evidence.comparisonSummary?.observedDifferences ?? [];
    y = addKeyValues(doc, [
      ['Identity score', formatScore(evidence.comparisonSummary?.assetIdentityScore)],
      ['Quantity score', formatScore(evidence.comparisonSummary?.quantityMatchScore)],
      ['Condition score', formatScore(evidence.comparisonSummary?.conditionMatchScore)],
      ['Review method', formatLabel(evidence.comparisonSummary?.method)],
      ['Review notes', evidence.reviewNotes || evidence.comparisonSummary?.recommendedStaffAction || '-'],
      ['Findings', findings.length ? findings.join(' ') : '-'],
      ['Observed differences', differences.length ? differences.join(' ') : 'None recorded'],
    ], y);
  }

  y = addSectionTitle(doc, 'Operational Timeline', y, brandRgb);
  y = addTable(
    doc,
    ['Time', 'Event'],
    narrativeEvents.map((event) => [formatDate(event.at), event.description]),
    y
  );

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
