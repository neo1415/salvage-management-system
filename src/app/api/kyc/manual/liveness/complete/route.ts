import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { normalizeDojahWorkflowResult } from '@/features/kyc/services/dojah-normalizer.service';
import { ingestDojahMediaForVendor } from '@/features/kyc/services/dojah-media-ingest.service';
import type { NormalizedVerificationResult } from '@/features/kyc/types/provider-verification.types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const livenessReference = String(body?.reference_id ?? '').trim();
  const manualReference = String(body?.manual_reference ?? '').trim();

  if (!livenessReference) {
    return NextResponse.json({ error: 'Missing liveness reference.' }, { status: 400 });
  }

  const [vendor] = await db
    .select({
      id: vendors.id,
      userId: vendors.userId,
      fullName: users.fullName,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 });
  }

  const whereManualReference = manualReference
    ? and(
        eq(providerVerificationRecords.vendorId, vendor.id),
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.verificationType, 'tier2'),
        eq(providerVerificationRecords.providerReference, manualReference)
      )
    : and(
        eq(providerVerificationRecords.vendorId, vendor.id),
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.verificationType, 'tier2'),
        eq(providerVerificationRecords.workflowReference, 'nem-hybrid-tier2')
      );

  const [manualEvidence] = await db
    .select()
    .from(providerVerificationRecords)
    .where(whereManualReference)
    .orderBy(desc(providerVerificationRecords.updatedAt))
    .limit(1);

  if (!manualEvidence?.providerReference) {
    return NextResponse.json(
      { error: 'Submit the Tier 2 evidence before completing liveness.' },
      { status: 409 }
    );
  }

  const dojah = getDojahService();
  const verificationResult = await dojah.getVerificationResult(livenessReference);
  const normalizedLiveness = normalizeDojahWorkflowResult(verificationResult);
  const liveness = extractLivenessScores(normalizedLiveness.normalizedResult, verificationResult);

  if (!liveness.hasEvidence) {
    return NextResponse.json(
      { error: 'Dojah did not return liveness evidence for this reference yet. Please wait a moment and retry.' },
      { status: 409 }
    );
  }

  const media = await ingestDojahMediaForVendor({
    vendorId: vendor.id,
    userId: vendor.userId,
    providerReference: livenessReference,
    verificationResult,
  }).catch((error) => {
    console.warn('[Manual KYC Liveness] media ingest failed', {
      reference: livenessReference,
      message: error instanceof Error ? error.message : 'Unknown media ingest error',
    });
    return null;
  });

  const previous = (manualEvidence.normalizedResult as Record<string, unknown> | null) ?? {};
  const previousSummary = (previous.dojahEvidenceSummary as Record<string, unknown> | null) ?? {};
  const previousCompleted = new Set(manualEvidence.checksCompleted ?? []);
  const previousPending = new Set(manualEvidence.pendingChecks ?? []);
  previousCompleted.add('dojah_liveness');
  previousPending.delete('dojah_liveness');
  previousPending.delete('manager_selfie_review');

  const mergedResult: NormalizedVerificationResult = {
    provider: 'dojah',
    providerReference: manualEvidence.providerReference,
    workflowReference: 'nem-hybrid-tier2',
    verificationType: 'tier2',
    status: 'review_required',
    riskLevel: manualEvidence.riskLevel as NormalizedVerificationResult['riskLevel'],
    checksCompleted: [...previousCompleted],
    pendingChecks: [...previousPending],
    failedChecks: manualEvidence.failedChecks ?? [],
    reasonCodes: manualEvidence.reasonCodes ?? [],
    displayMessage: manualEvidence.displayMessage ?? 'Tier 2 evidence is ready for internal review.',
    normalizedResult: {
      ...previous,
      livenessStatus: 'completed',
      livenessReferenceId: livenessReference,
      livenessScore: liveness.livenessScore,
      biometricMatchScore: liveness.biometricMatchScore,
      selfieUrl: media?.profilePictureUrl ?? liveness.selfieUrl ?? null,
      dojahLivenessEvidence: {
        providerReference: livenessReference,
        status: normalizedLiveness.status,
        completedAt: new Date().toISOString(),
      },
      dojahEvidenceSummary: {
        ...previousSummary,
        liveness: {
          status: normalizedLiveness.status,
          livenessScore: liveness.livenessScore,
          biometricMatchScore: liveness.biometricMatchScore,
          hasSelfie: Boolean(media?.profilePictureUrl ?? liveness.selfieUrl),
        },
      },
      dojahMedia: media
        ? {
            assets: media.assets.map((asset) => ({
              type: asset.type,
              sourceKey: asset.sourceKey,
              storedUrl: asset.storedUrl,
            })),
            diagnostics: media.diagnostics,
            profilePictureImported: Boolean(media.profilePictureUrl),
          }
        : previous.dojahMedia ?? null,
    },
  };

  await db
    .update(vendors)
    .set({
      livenessScore: liveness.livenessScore !== null ? String(liveness.livenessScore) : null,
      biometricMatchScore: liveness.biometricMatchScore !== null ? String(liveness.biometricMatchScore) : null,
      selfieUrl: media?.profilePictureUrl ?? liveness.selfieUrl ?? null,
      biometricVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendor.id));

  await getProviderVerificationService().persistVerification({
    userId: vendor.userId,
    vendorId: vendor.id,
    actorId: session.user.id,
    result: mergedResult,
    rawPayload: {
      source: 'nem_hybrid_liveness_complete',
      livenessReference,
      verificationResult,
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({
    success: true,
    status: 'pending_review',
    livenessScore: liveness.livenessScore,
    biometricMatchScore: liveness.biometricMatchScore,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numericScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function extractLivenessScores(
  normalized: Record<string, unknown> | null | undefined,
  raw: unknown
): {
  hasEvidence: boolean;
  livenessScore: number | null;
  biometricMatchScore: number | null;
  selfieUrl: string | null;
} {
  const rawRecord = asRecord(raw) ?? {};
  const data = asRecord(rawRecord.data) ?? {};
  const selfie = asRecord(data.selfie) ?? asRecord(rawRecord.selfie) ?? {};
  const selfieData = asRecord(selfie.data) ?? selfie;
  const normalizedSelfie = asRecord(normalized?.selfie) ?? {};

  const livenessScore = numericScore(
    normalized?.livenessScore ??
      normalizedSelfie.liveness_score ??
      normalizedSelfie.livenessScore ??
      selfieData.liveness_score ??
      selfieData.livenessScore
  );
  const biometricMatchScore = numericScore(
    normalized?.biometricMatchScore ??
      normalizedSelfie.match_score ??
      normalizedSelfie.matchScore ??
      selfieData.match_score ??
      selfieData.matchScore
  );
  const selfieUrl = typeof selfieData.selfie_url === 'string'
    ? selfieData.selfie_url
    : typeof selfieData.selfieUrl === 'string'
      ? selfieData.selfieUrl
      : typeof rawRecord.selfie_url === 'string'
        ? rawRecord.selfie_url
        : null;

  return {
    hasEvidence: livenessScore !== null || biometricMatchScore !== null || Boolean(selfieUrl),
    livenessScore,
    biometricMatchScore,
    selfieUrl,
  };
}
