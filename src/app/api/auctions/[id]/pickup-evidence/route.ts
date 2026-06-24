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
} from '@/features/pickups/services/pickup-confirmation.service';
import { comparePickupEvidence } from '@/features/pickups/services/pickup-evidence-comparison.service';
import {
  inspectImageSetIntegrityFromUrls,
  summarizeImageIntegrity,
} from '@/features/media/services/image-integrity.service';
import { recordImageUploadMetadataBatch } from '@/features/media/services/image-upload-metadata.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
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

function runInBackground(label: string, task: () => Promise<unknown>, timeoutMs = 5000) {
  void Promise.race([
    task(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).catch((error) => {
    console.warn(`[Pickup Evidence] ${label} failed after response`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
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

  const [caseRecord] = await db
    .select({
      photos: salvageCases.photos,
      aiAssessment: salvageCases.aiAssessment,
      assetType: salvageCases.assetType,
      assetDetails: salvageCases.assetDetails,
    })
    .from(salvageCases)
    .where(eq(salvageCases.id, context.caseId))
    .limit(1);

  const comparisonSummary = await comparePickupEvidence({
    originalPhotoUrls: caseRecord?.photos || [],
    pickupPhotoUrls: photoUrls,
    assetType: caseRecord?.assetType || 'unknown',
    assetDetails: caseRecord?.assetDetails || null,
    aiAssessment: (caseRecord?.aiAssessment as Record<string, unknown> | null) || null,
  });
  const imageIntegrityResults = await inspectImageSetIntegrityFromUrls(photoUrls);
  const imageIntegritySummary = summarizeImageIntegrity(imageIntegrityResults, photoMetadata || []);
  if (imageIntegritySummary.status === 'failed') {
    return NextResponse.json(
      {
        error: 'One or more pickup photos could not be verified as supported image evidence.',
        details: imageIntegritySummary.warnings,
      },
      { status: 400 }
    );
  }

  const finalComparisonSummary = imageIntegritySummary.warnings.length > 0
    ? {
        ...comparisonSummary,
        status: comparisonSummary.status === 'material_discrepancy' ? comparisonSummary.status : 'review_needed' as const,
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
          clientMetadata: photoMetadata,
        },
      }
    : comparisonSummary;

  if (!imageIntegritySummary.warnings.length && photoMetadata?.length) {
    finalComparisonSummary.imageIntegrity = {
      status: imageIntegritySummary.status,
      clientMetadata: photoMetadata,
    };
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
      comparisonStatus: finalComparisonSummary.status,
      comparisonSummary: finalComparisonSummary,
    })
    .returning();

  await recordImageUploadMetadataBatch(photoUrls.map((imageUrl, index) => ({
    entityType: 'pickup_evidence',
    entityId: record.id,
    imageUrl,
    imageIndex: index,
    purpose: 'pickup_handover',
    uploadedBy: session.user.id,
    clientMetadata: photoMetadata?.[index],
  })));

  const shouldReview = finalComparisonSummary.status !== 'matches_expected';

  runInBackground('staff pickup-evidence notifications', () =>
    createRoleNotifications(['salvage_manager', 'system_admin'], {
      type: 'system_alert',
      title: shouldReview ? 'Pickup evidence needs review' : 'Pickup evidence submitted',
      message: shouldReview
        ? `${context.vendorName} submitted pickup evidence for ${context.claimReference}; discrepancy checks require staff review.`
        : `${context.vendorName} submitted pickup evidence for ${context.claimReference}.`,
      data: {
        auctionId,
        caseId: context.caseId,
        vendorId,
        pickupEvidenceId: record.id,
        pickupEvidenceStatus: finalComparisonSummary.status,
        url: '/admin/pickups',
      },
    })
  );

  runInBackground('pickup-evidence audit log', () =>
    logAction({
      userId: session.user.id,
      actionType: AuditActionType.PICKUP_EVIDENCE_SUBMITTED,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: getIpAddress(request.headers),
      deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
      userAgent: request.headers.get('user-agent') || 'unknown',
      afterState: {
        vendorId,
        caseId: context.caseId,
        pickupEvidenceId: record.id,
        photoCount: photoUrls.length,
        comparisonStatus: finalComparisonSummary.status,
        findings: finalComparisonSummary.findings,
        observedDifferences: finalComparisonSummary.observedDifferences,
        comparisonMethod: finalComparisonSummary.method,
        clientPhotoMetadataCount: photoMetadata?.length || 0,
      },
    })
  );

  runInBackground('pickup-evidence fraud alert', async () => {
    if (finalComparisonSummary.status === 'matches_expected') {
      return;
    }

    const { FraudDetectionService } = await import('@/features/intelligence/services/fraud-detection.service');
    const fraudService = new FraudDetectionService();
    const flagReasons = [
      finalComparisonSummary.status === 'material_discrepancy'
        ? 'Pickup evidence materially differs from original inspection photos'
        : 'Pickup evidence requires staff review',
      ...finalComparisonSummary.findings.slice(0, 3),
    ];

    await fraudService.createFraudAlert(
      'auction',
      auctionId,
      finalComparisonSummary.status === 'material_discrepancy' ? 85 : 65,
      flagReasons,
      {
        source: 'pickup_evidence_comparison',
        pickupEvidenceId: record.id,
        vendorId,
        caseId: context.caseId,
        comparisonStatus: finalComparisonSummary.status,
        findings: finalComparisonSummary.findings,
        observedDifferences: finalComparisonSummary.observedDifferences,
      }
    );
  });

  return NextResponse.json({
    success: true,
    evidence: record,
    comparison: finalComparisonSummary,
    message: shouldReview
      ? 'Pickup evidence submitted. Staff will review it before final release.'
      : 'Pickup evidence submitted successfully.',
  });
}
