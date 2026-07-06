import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import {
  pickupEvidence,
  releaseForms,
  salvageCases,
  vendors,
} from '@/lib/db/schema';
import {
  getPickupContextByAuction,
  verifyPickupAuthorizationCode,
  type PickupContext,
} from '@/features/pickups/services/pickup-confirmation.service';
import {
  notifyStaffPickupComparisonResult,
  notifyStaffPickupEvidenceSubmitted,
} from '@/features/pickups/services/pickup-lifecycle-notifications.service';
import { comparePickupEvidence } from '@/features/pickups/services/pickup-evidence-comparison.service';
import {
  inspectImageSetIntegrityFromUrls,
  summarizeImageIntegrity,
} from '@/features/media/services/image-integrity.service';
import { recordImageUploadMetadataBatch } from '@/features/media/services/image-upload-metadata.service';
import {
  AuditActionType,
  AuditEntityType,
  getDeviceTypeFromUserAgent,
  getIpAddress,
  logAction,
} from '@/lib/utils/audit-logger';

const STAFF_ROLES = new Set(['salvage_manager', 'system_admin']);

const pickupPhotoMetadataSchema = z.object({
  index: z.number().int().min(0).max(50),
  name: z.string().max(255).optional(),
  size: z.number().int().positive().max(30 * 1024 * 1024).optional(),
  type: z.string().max(80).optional(),
  lastModified: z.number().int().positive().optional(),
  captureSource: z.string().max(80).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hasClientExif: z.boolean().optional(),
  exifCapturedAt: z.string().datetime().optional(),
  gpsLatitude: z.number().min(-90).max(90).optional(),
  gpsLongitude: z.number().min(-180).max(180).optional(),
  gpsAltitude: z.number().finite().optional(),
  gpsAccuracy: z.number().nonnegative().finite().optional(),
  locationSource: z.enum(['exif', 'browser_geolocation']).optional(),
  browserRecordedAt: z.string().datetime().optional(),
  clientSha256Hash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  deviceMake: z.string().max(120).optional(),
  deviceModel: z.string().max(120).optional(),
  deviceSoftware: z.string().max(255).optional(),
  orientation: z.number().int().min(1).max(8).optional(),
  metadataStatus: z.enum(['captured', 'partial', 'unavailable', 'failed']).optional(),
  metadataWarnings: z.array(z.string().max(500)).max(20).optional(),
  rawExif: z.record(z.string(), z.unknown()).optional(),
});

const pickupEvidenceSchema = z.object({
  vendorId: z.string().uuid(),
  pickupAuthCode: z.string().min(6).max(80),
  photoUrls: z
    .array(z.string().url())
    .min(3, 'At least 3 pickup evidence photos are required.')
    .max(12, 'Upload no more than 12 pickup evidence photos.'),
  photoMetadata: z.array(pickupPhotoMetadataSchema).max(12).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type PickupPhotoMetadata = z.infer<typeof pickupPhotoMetadataSchema>;

async function processPickupEvidenceComparison(input: {
  recordId: string;
  auctionId: string;
  context: PickupContext;
  photoUrls: string[];
  photoMetadata?: PickupPhotoMetadata[];
}) {
  try {
    const [caseRecord] = await db
      .select({
        photos: salvageCases.photos,
        aiAssessment: salvageCases.aiAssessment,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
      })
      .from(salvageCases)
      .where(eq(salvageCases.id, input.context.caseId))
      .limit(1);

    const [comparisonSummary, imageIntegrityResults] = await Promise.all([
      comparePickupEvidence({
        originalPhotoUrls: caseRecord?.photos || [],
        pickupPhotoUrls: input.photoUrls,
        assetType: caseRecord?.assetType || 'unknown',
        assetDetails: caseRecord?.assetDetails || null,
        aiAssessment: (caseRecord?.aiAssessment as Record<string, unknown> | null) || null,
      }),
      inspectImageSetIntegrityFromUrls(input.photoUrls),
    ]);
    const imageIntegritySummary = summarizeImageIntegrity(imageIntegrityResults, input.photoMetadata || []);
    const integrityRequiresReview = imageIntegritySummary.status !== 'passed';

    const finalComparisonSummary = integrityRequiresReview
      ? {
          ...comparisonSummary,
          status: comparisonSummary.status === 'material_discrepancy'
            ? comparisonSummary.status
            : 'review_needed' as const,
          confidenceScore: Math.min(comparisonSummary.confidenceScore, 80),
          findings: [
            ...comparisonSummary.findings,
            ...imageIntegritySummary.warnings.slice(0, 8),
          ],
          recommendedStaffAction:
            'Review pickup photos, original inspection evidence, and photo-integrity warnings before confirming release.',
          imageIntegrity: {
            status: imageIntegritySummary.status,
            results: imageIntegrityResults,
            clientMetadata: input.photoMetadata,
          },
        }
      : {
          ...comparisonSummary,
          imageIntegrity: input.photoMetadata?.length
            ? {
                status: imageIntegritySummary.status,
                clientMetadata: input.photoMetadata,
              }
            : comparisonSummary.imageIntegrity,
        };

    await db
      .update(pickupEvidence)
      .set({
        comparisonStatus: finalComparisonSummary.status,
        comparisonSummary: finalComparisonSummary,
        updatedAt: new Date(),
      })
      .where(eq(pickupEvidence.id, input.recordId));

    if (
      finalComparisonSummary.status === 'review_needed'
      || finalComparisonSummary.status === 'material_discrepancy'
    ) {
      await notifyStaffPickupComparisonResult({
        auctionId: input.auctionId,
        caseId: input.context.caseId,
        vendorId: input.context.vendorId,
        pickupEvidenceId: input.recordId,
        claimReference: input.context.claimReference,
        status: finalComparisonSummary.status,
      });
    }

    if (
      finalComparisonSummary.status === 'material_discrepancy'
      && (finalComparisonSummary.overallMatchScore ?? 100) < 70
      && !input.context.pickupConfirmedAdmin
    ) {
      const { FraudDetectionService } = await import('@/features/intelligence/services/fraud-detection.service');
      const fraudService = new FraudDetectionService();
      await fraudService.createFraudAlert(
        'auction',
        input.auctionId,
        85,
        [
          'Pickup evidence materially differs from original inspection photos',
          ...(finalComparisonSummary.observedDifferences ?? []).slice(0, 3),
          ...finalComparisonSummary.findings.slice(0, 2),
        ].filter(Boolean),
        {
          source: 'pickup_evidence_comparison',
          pickupEvidenceId: input.recordId,
          vendorId: input.context.vendorId,
          caseId: input.context.caseId,
          comparisonStatus: finalComparisonSummary.status,
          findings: finalComparisonSummary.findings,
          observedDifferences: finalComparisonSummary.observedDifferences,
        }
      );
    }
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : 'Unknown comparison error';
    console.error('[Pickup Evidence] Comparison failed', {
      auctionId: input.auctionId,
      pickupEvidenceId: input.recordId,
      error: failureMessage,
    });

    await db
      .update(pickupEvidence)
      .set({
        comparisonStatus: 'review_needed',
        comparisonSummary: {
          status: 'review_needed',
          confidenceScore: 0,
          findings: ['Automated comparison was unavailable. Manual evidence review is required.'],
          observedDifferences: [],
          recommendedStaffAction: 'Review the original and pickup photos manually before confirming release.',
          originalPhotoCount: 0,
          pickupPhotoCount: input.photoUrls.length,
          comparedAt: new Date().toISOString(),
          method: 'ai_failed_fallback',
        },
        updatedAt: new Date(),
      })
      .where(eq(pickupEvidence.id, input.recordId));

    await notifyStaffPickupComparisonResult({
      auctionId: input.auctionId,
      caseId: input.context.caseId,
      vendorId: input.context.vendorId,
      pickupEvidenceId: input.recordId,
      claimReference: input.context.claimReference,
      status: 'review_needed',
      comparisonUnavailable: true,
    });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: auctionId } = await params;
  const context = await getPickupContextByAuction(auctionId);
  if (!context) {
    return NextResponse.json({ error: 'Auction pickup context was not found.' }, { status: 404 });
  }

  const isStaff = STAFF_ROLES.has(session.user.role);
  const isWinningVendor = session.user.vendorId === context.vendorId;
  if (!isStaff && !isWinningVendor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const records = await db
    .select()
    .from(pickupEvidence)
    .where(eq(pickupEvidence.auctionId, auctionId))
    .orderBy(desc(pickupEvidence.createdAt))
    .limit(10);

  return NextResponse.json({
    success: true,
    evidence: records,
    latest: records[0] || null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: auctionId } = await params;
  const body = await request.json().catch(() => ({}));
  const validation = pickupEvidenceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid pickup evidence payload', details: validation.error.issues },
      { status: 400 }
    );
  }

  const { vendorId, pickupAuthCode, photoUrls, photoMetadata, notes } = validation.data;

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor || vendor.userId !== session.user.id) {
    return NextResponse.json({ error: 'Only the auction winner can submit pickup evidence.' }, { status: 403 });
  }

  const context = await getPickupContextByAuction(auctionId);
  if (!context || context.vendorId !== vendorId) {
    return NextResponse.json({ error: 'Only the auction winner can submit pickup evidence.' }, { status: 403 });
  }

  if (context.paymentStatus !== 'verified') {
    return NextResponse.json({ error: 'Pickup evidence can only be submitted after verified payment.' }, { status: 400 });
  }

  const [pickupAuthDoc] = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId),
        eq(releaseForms.documentType, 'pickup_authorization')
      )
    )
    .limit(1);

  if (!pickupAuthDoc?.documentData?.pickupAuthCode) {
    return NextResponse.json({ error: 'Pickup authorization code is not ready for this auction.' }, { status: 400 });
  }

  if (!verifyPickupAuthorizationCode(pickupAuthDoc.documentData.pickupAuthCode, pickupAuthCode)) {
    return NextResponse.json({ error: 'Invalid pickup authorization code.' }, { status: 400 });
  }

  const [existingEvidence] = await db
    .select({ id: pickupEvidence.id })
    .from(pickupEvidence)
    .where(
      and(
        eq(pickupEvidence.auctionId, auctionId),
        eq(pickupEvidence.vendorId, vendorId)
      )
    )
    .orderBy(desc(pickupEvidence.createdAt))
    .limit(1);

  if (existingEvidence) {
    return NextResponse.json(
      {
        error: 'Pickup evidence has already been submitted and is under staff review.',
        code: 'pickup_evidence_already_submitted',
      },
      { status: 409 }
    );
  }

  const [record] = await db
    .insert(pickupEvidence)
    .values({
      auctionId,
      caseId: context.caseId,
      vendorId,
      submittedBy: session.user.id,
      photoUrls,
      notes: notes?.trim() || null,
      comparisonStatus: 'not_reviewed',
      comparisonSummary: {
        status: 'not_reviewed',
        confidenceScore: 0,
        findings: ['Automated comparison is in progress.'],
        observedDifferences: [],
        recommendedStaffAction: 'Wait for automated comparison before confirming release.',
        originalPhotoCount: 0,
        pickupPhotoCount: photoUrls.length,
        comparedAt: new Date().toISOString(),
        method: 'rule_based',
      },
    })
    .returning();

  const ipAddress = getIpAddress(request.headers);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await Promise.all([
    Promise.allSettled([
      recordImageUploadMetadataBatch(photoUrls.map((imageUrl, index) => ({
        entityType: 'pickup_evidence',
        entityId: record.id,
        imageUrl,
        imageIndex: index,
        purpose: 'pickup_handover',
        uploadedBy: session.user.id,
        clientMetadata: photoMetadata?.[index],
      }))),
      notifyStaffPickupEvidenceSubmitted({
        auctionId,
        caseId: context.caseId,
        pickupEvidenceId: record.id,
        claimReference: context.claimReference,
        assetName: context.assetName,
        vendorName: context.vendorName,
      }),
      logAction({
        userId: session.user.id,
        actionType: AuditActionType.PICKUP_EVIDENCE_SUBMITTED,
        entityType: AuditEntityType.AUCTION,
        entityId: auctionId,
        ipAddress,
        deviceType: getDeviceTypeFromUserAgent(userAgent),
        userAgent,
        afterState: {
          vendorId,
          caseId: context.caseId,
          pickupEvidenceId: record.id,
          photoCount: photoUrls.length,
          comparisonStatus: 'not_reviewed',
          clientPhotoMetadataCount: photoMetadata?.length || 0,
        },
      }),
    ]),
    processPickupEvidenceComparison({
      recordId: record.id,
      auctionId,
      context,
      photoUrls,
      photoMetadata,
    }),
  ]);

  const [completedEvidence] = await db
    .select()
    .from(pickupEvidence)
    .where(eq(pickupEvidence.id, record.id))
    .limit(1);

  return NextResponse.json({
    success: true,
    evidence: completedEvidence || record,
    comparisonStatus: completedEvidence?.comparisonStatus || 'review_needed',
    message: 'Pickup evidence submitted for staff review.',
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: auctionId } = await params;
  const context = await getPickupContextByAuction(auctionId);
  if (!context) {
    return NextResponse.json({ error: 'Auction pickup context was not found.' }, { status: 404 });
  }

  const [record] = await db
    .select()
    .from(pickupEvidence)
    .where(eq(pickupEvidence.auctionId, auctionId))
    .orderBy(desc(pickupEvidence.createdAt))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: 'Pickup evidence was not found.' }, { status: 404 });
  }

  await processPickupEvidenceComparison({
    recordId: record.id,
    auctionId,
    context,
    photoUrls: record.photoUrls,
  });

  const [completedEvidence] = await db
    .select()
    .from(pickupEvidence)
    .where(eq(pickupEvidence.id, record.id))
    .limit(1);

  return NextResponse.json({ success: true, evidence: completedEvidence || record });
}
