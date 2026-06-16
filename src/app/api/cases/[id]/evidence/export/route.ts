import { NextRequest, NextResponse } from 'next/server';
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
import { desc, eq, inArray } from 'drizzle-orm';

const ALLOWED_ROLES = new Set([
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

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
            id: auctionDocuments.id,
            auctionId: auctionDocuments.auctionId,
            vendorId: auctionDocuments.vendorId,
            vendorBusinessName: vendors.businessName,
            type: auctionDocuments.type,
            status: auctionDocuments.status,
            signedAt: auctionDocuments.signedAt,
            validityDeadline: auctionDocuments.validityDeadline,
            createdAt: auctionDocuments.createdAt,
            updatedAt: auctionDocuments.updatedAt,
          })
          .from(auctionDocuments)
          .leftJoin(vendors, eq(auctionDocuments.vendorId, vendors.id))
          .where(inArray(auctionDocuments.auctionId, auctionIds))
          .orderBy(desc(auctionDocuments.createdAt)),
      ])
    : [[], [], []];

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
    .where(eq(auditLogs.entityId, caseId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

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
    documents: documentRows,
    auditTrail: auditRows,
    notes: [
      'This evidence packet intentionally excludes document body content and raw payment proof URLs.',
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
