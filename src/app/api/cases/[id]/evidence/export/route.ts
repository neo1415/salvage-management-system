import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { pickupEvidence } from '@/lib/db/schema/pickup-evidence';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { desc, eq, inArray } from 'drizzle-orm';
import { listImageUploadMetadataForEntities } from '@/features/media/services/image-upload-metadata.service';

const ALLOWED_ROLES = new Set([
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

function sanitizeDocumentData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const documentData = { ...(value as Record<string, unknown>) };
  if (documentData.pickupAuthCode) {
    documentData.pickupAuthCode = '[redacted]';
  }
  return documentData;
}

function chooseOfficialAuction<T extends {
  id: string;
  pickupConfirmedAdmin?: boolean | null;
  pickupConfirmedAdminAt?: Date | null;
  createdAt: Date;
}>(auctionRows: T[]): T | null {
  const staffConfirmed = auctionRows
    .filter((auction) => auction.pickupConfirmedAdmin)
    .sort((a, b) => {
      const aTime = a.pickupConfirmedAdminAt?.getTime() ?? 0;
      const bTime = b.pickupConfirmedAdminAt?.getTime() ?? 0;
      return bTime - aTime;
    });

  return staffConfirmed[0] ?? auctionRows[0] ?? null;
}

export async function GET(
  _request: NextRequest,
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
            id: bids.id,
            auctionId: bids.auctionId,
            vendorId: bids.vendorId,
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
            id: payments.id,
            auctionId: payments.auctionId,
            vendorId: payments.vendorId,
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
            updatedAt: payments.updatedAt,
          })
          .from(payments)
          .leftJoin(vendors, eq(payments.vendorId, vendors.id))
          .where(inArray(payments.auctionId, auctionIds))
          .orderBy(desc(payments.createdAt)),
        db
          .select({
            id: releaseForms.id,
            auctionId: releaseForms.auctionId,
            vendorId: releaseForms.vendorId,
            vendorBusinessName: vendors.businessName,
            documentType: releaseForms.documentType,
            title: releaseForms.title,
            status: releaseForms.status,
            disabled: releaseForms.disabled,
            validityDeadline: releaseForms.validityDeadline,
            paymentDeadline: releaseForms.paymentDeadline,
            signedAt: releaseForms.signedAt,
            pdfUrl: releaseForms.pdfUrl,
            documentData: releaseForms.documentData,
            generatedAt: releaseForms.generatedAt,
            createdAt: releaseForms.createdAt,
            updatedAt: releaseForms.updatedAt,
          })
          .from(releaseForms)
          .leftJoin(vendors, eq(releaseForms.vendorId, vendors.id))
          .where(inArray(releaseForms.auctionId, auctionIds))
          .orderBy(desc(releaseForms.createdAt)),
      ])
    : [[], [], []];

  const pickupEvidenceRows = auctionIds.length
    ? await db
        .select({
          id: pickupEvidence.id,
          auctionId: pickupEvidence.auctionId,
          caseId: pickupEvidence.caseId,
          vendorId: pickupEvidence.vendorId,
          vendorBusinessName: vendors.businessName,
          submittedBy: pickupEvidence.submittedBy,
          photoUrls: pickupEvidence.photoUrls,
          notes: pickupEvidence.notes,
          comparisonStatus: pickupEvidence.comparisonStatus,
          comparisonSummary: pickupEvidence.comparisonSummary,
          reviewedBy: pickupEvidence.reviewedBy,
          reviewedAt: pickupEvidence.reviewedAt,
          reviewNotes: pickupEvidence.reviewNotes,
          resolutionStatus: pickupEvidence.resolutionStatus,
          adjustmentAmount: pickupEvidence.adjustmentAmount,
          reimbursementMethod: pickupEvidence.reimbursementMethod,
          createdAt: pickupEvidence.createdAt,
          updatedAt: pickupEvidence.updatedAt,
        })
        .from(pickupEvidence)
        .leftJoin(vendors, eq(pickupEvidence.vendorId, vendors.id))
        .where(inArray(pickupEvidence.auctionId, auctionIds))
        .orderBy(desc(pickupEvidence.createdAt))
    : [];

  const auditEntityIds = [caseId, ...auctionIds];
  const auditRows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      actionType: auditLogs.actionType,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      deviceType: auditLogs.deviceType,
      createdAt: auditLogs.createdAt,
      recordHash: auditLogs.recordHash,
    })
    .from(auditLogs)
    .where(inArray(auditLogs.entityId, auditEntityIds))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  const sanitizedDocumentRows = documentRows.map((document) => ({
    ...document,
    documentData: sanitizeDocumentData(document.documentData),
  }));
  const officialPickupEvidence = officialAuction
    ? pickupEvidenceRows
        .filter((evidence) => evidence.auctionId === officialAuction.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    : null;
  const imageMetadataEntityIds = [
    caseId,
    ...pickupEvidenceRows.map((evidence) => evidence.id),
    ...paymentRows.map((payment) => payment.id),
  ];
  const imageMetadataRows = await listImageUploadMetadataForEntities(imageMetadataEntityIds);

  const packet = {
    generatedAt: new Date().toISOString(),
    generatedBy: {
      userId: session.user.id,
      role: session.user.role,
      email: session.user.email,
    },
    case: caseRecord,
    auctions: auctionRows,
    bids: bidRows,
    payments: paymentRows,
    documents: sanitizedDocumentRows,
    pickupEvidence: pickupEvidenceRows,
    imageMetadata: imageMetadataRows,
    officialHandover: officialAuction
      ? {
          auctionId: officialAuction.id,
          pickupConfirmedVendor: officialAuction.pickupConfirmedVendor,
          pickupConfirmedVendorAt: officialAuction.pickupConfirmedVendorAt,
          pickupConfirmedAdmin: officialAuction.pickupConfirmedAdmin,
          pickupConfirmedAdminAt: officialAuction.pickupConfirmedAdminAt,
          pickupEvidenceId: officialPickupEvidence?.id ?? null,
          pickupEvidenceResolutionStatus: officialPickupEvidence?.resolutionStatus ?? null,
          pickupEvidenceReviewedAt: officialPickupEvidence?.reviewedAt ?? null,
        }
      : null,
    auditTrail: auditRows,
    notes: [
      'This evidence packet includes release form metadata, pickup evidence metadata, and audit references.',
      'It intentionally excludes raw payment proof URLs and private document body content.',
      'Use protected document download routes for underlying files.',
    ],
  };

  return NextResponse.json(packet, {
    headers: {
      'Content-Disposition': `attachment; filename="case-evidence-${caseRecord.claimReference}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
