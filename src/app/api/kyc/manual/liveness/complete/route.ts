import { after, NextRequest, NextResponse } from 'next/server';
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
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';

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
      email: users.email,
      phone: users.phone,
      businessName: vendors.businessName,
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

  await markLivenessAttemptPending({
    manualEvidence,
    livenessReference,
    actorId: session.user.id,
    request,
  });

  let evidence:
    | Awaited<ReturnType<typeof fetchLivenessEvidenceWithRetry>>
    | null = null;

  try {
    evidence = await fetchLivenessEvidenceWithRetry(livenessReference);
  } catch (error) {
    console.warn('[Manual KYC Liveness] Dojah result not ready after widget callback', {
      reference: livenessReference,
      message: error instanceof Error ? error.message : 'Unknown liveness lookup error',
    });
    return NextResponse.json(
      {
        success: true,
        status: 'liveness_submitted',
        message: 'Face check submitted. We are waiting for the verification result.',
      },
      { status: 202 }
    );
  }

  const { verificationResult, normalizedLiveness, liveness } = evidence;

  if (!liveness.hasEvidence) {
    return NextResponse.json(
      {
        success: true,
        status: 'liveness_submitted',
        message: 'Face check submitted. We are waiting for the verification result.',
      },
      { status: 202 }
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
  const livenessIpDevice = extractIpDeviceEvidence(verificationResult);
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
        ipDevice: livenessIpDevice
          ? {
              ...(asRecord(previousSummary.ipDevice) ?? {}),
              ...livenessIpDevice,
            }
          : previousSummary.ipDevice,
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
      tier2SubmittedAt: new Date(),
      tier2DojahReferenceId: manualEvidence.providerReference,
      tier2RejectionReason: null,
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

  after(async () => {
    const notify = getKYCNotificationService();
    await Promise.allSettled([
      notify.sendKYCUnderReviewNotification({
        vendorId: vendor.id,
        userId: vendor.userId,
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        fullName: vendor.fullName ?? vendor.businessName ?? 'Vendor',
      }),
      createRoleNotifications(['salvage_manager', 'system_admin'], {
        type: 'tier2_pending_review',
        title: 'Vendor verification ready for review',
        message: `${vendor.businessName || vendor.fullName || 'A vendor'} completed verification evidence for manager review.`,
        data: {
          vendorId: vendor.id,
          url: '/manager/kyc-approvals',
        },
      }),
    ]).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error('[Manual KYC Liveness] Deferred notification failed', {
            index,
            error: result.reason,
          });
        }
      });
    });
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

async function fetchLivenessEvidenceWithRetry(referenceId: string): Promise<{
  verificationResult: Awaited<ReturnType<ReturnType<typeof getDojahService>['getVerificationResult']>>;
  normalizedLiveness: ReturnType<typeof normalizeDojahWorkflowResult>;
  liveness: ReturnType<typeof extractLivenessScores>;
}> {
  const dojah = getDojahService();
  let lastVerificationResult: Awaited<ReturnType<typeof dojah.getVerificationResult>> | null = null;
  let lastNormalized: ReturnType<typeof normalizeDojahWorkflowResult> | null = null;
  let lastLiveness: ReturnType<typeof extractLivenessScores> | null = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const verificationResult = await dojah.getVerificationResult(referenceId);
    const normalizedLiveness = normalizeDojahWorkflowResult(verificationResult);
    const liveness = extractLivenessScores(normalizedLiveness.normalizedResult, verificationResult);

    lastVerificationResult = verificationResult;
    lastNormalized = normalizedLiveness;
    lastLiveness = liveness;

    if (liveness.hasEvidence) {
      return { verificationResult, normalizedLiveness, liveness };
    }

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  return {
    verificationResult: lastVerificationResult ?? {},
    normalizedLiveness: lastNormalized ?? normalizeDojahWorkflowResult({}),
    liveness: lastLiveness ?? {
      hasEvidence: false,
      livenessScore: null,
      biometricMatchScore: null,
      selfieUrl: null,
    },
  };
}

async function markLivenessAttemptPending(input: {
  manualEvidence: typeof providerVerificationRecords.$inferSelect;
  livenessReference: string;
  actorId: string;
  request: NextRequest;
}) {
  const previous = (input.manualEvidence.normalizedResult as Record<string, unknown> | null) ?? {};
  const previousSummary = (previous.dojahEvidenceSummary as Record<string, unknown> | null) ?? {};

  const pendingResult: NormalizedVerificationResult = {
    provider: 'dojah',
    providerReference: input.manualEvidence.providerReference ?? undefined,
    workflowReference: 'nem-hybrid-tier2',
    verificationType: 'tier2',
    status: 'review_required',
    riskLevel: input.manualEvidence.riskLevel as NormalizedVerificationResult['riskLevel'],
    checksCompleted: input.manualEvidence.checksCompleted ?? [],
    pendingChecks: [...new Set([...(input.manualEvidence.pendingChecks ?? []), 'dojah_liveness'])],
    failedChecks: input.manualEvidence.failedChecks ?? [],
    reasonCodes: input.manualEvidence.reasonCodes ?? [],
    displayMessage: input.manualEvidence.displayMessage ?? 'Tier 2 evidence is ready for internal review.',
    normalizedResult: {
      ...previous,
      livenessStatus: 'submitted',
      livenessReferenceId: input.livenessReference,
      dojahEvidenceSummary: {
        ...previousSummary,
        liveness: {
          ...(asRecord(previousSummary.liveness) ?? {}),
          status: 'submitted',
          providerReference: input.livenessReference,
          submittedAt: new Date().toISOString(),
          hasSelfie: false,
        },
      },
    },
  };

  await getProviderVerificationService().persistVerification({
    userId: input.manualEvidence.userId ?? undefined,
    vendorId: input.manualEvidence.vendorId ?? undefined,
    actorId: input.actorId,
    result: pendingResult,
    rawPayload: {
      source: 'nem_hybrid_liveness_pending',
      livenessReference: input.livenessReference,
    },
    ipAddress: input.request.headers.get('x-forwarded-for') ?? undefined,
    userAgent: input.request.headers.get('user-agent') ?? undefined,
  });
}

function walkRecords(value: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const record = node as Record<string, unknown>;
    records.push(record);
    Object.values(record).forEach(walk);
  }

  walk(value);
  return records;
}

function firstScoreFrom(records: Record<string, unknown>[], keys: string[]): number | null {
  for (const record of records) {
    for (const key of keys) {
      const score = numericScore(record[key]);
      if (score !== null) return score;
    }
  }
  return null;
}

function firstStringFrom(records: Record<string, unknown>[], keys: string[]): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

function firstSignalFrom(records: Record<string, unknown>[], keys: string[]): string | number | boolean | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'boolean') return value;
    }
  }
  return null;
}

function extractIpDeviceEvidence(raw: unknown): Record<string, unknown> | null {
  const records = walkRecords(raw);
  const evidence: Record<string, unknown> = {};
  const map: Array<[string, string[]]> = [
    ['screenedIpAddress', ['ip', 'ip_address', 'ipAddress']],
    ['country', ['country', 'country_name', 'countryName']],
    ['region', ['region', 'region_name', 'regionName']],
    ['city', ['city', 'city_name', 'cityName']],
    ['latitude', ['latitude', 'lat']],
    ['longitude', ['longitude', 'lon', 'lng']],
    ['isp', ['isp']],
    ['browser', ['browser']],
    ['browserVersion', ['browser_version', 'browserVersion']],
    ['os', ['os', 'operating_system', 'operatingSystem']],
    ['model', ['model', 'device_model', 'deviceModel']],
    ['platform', ['platform']],
    ['vpn', ['vpn', 'is_vpn', 'isVpn']],
    ['proxy', ['proxy', 'is_proxy', 'isProxy']],
    ['hosting', ['hosting', 'is_hosting', 'isHosting']],
    ['tor', ['tor', 'is_tor', 'isTor']],
  ];

  for (const [target, keys] of map) {
    const value = firstSignalFrom(records, keys);
    if (value !== null) evidence[target] = value;
  }

  return Object.keys(evidence).length ? evidence : null;
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
  const records = [
    ...walkRecords(normalized),
    ...walkRecords(raw),
  ];

  const livenessScore = numericScore(
    normalized?.livenessScore ??
      normalizedSelfie.liveness_score ??
      normalizedSelfie.livenessScore ??
      selfieData.liveness_score ??
      selfieData.livenessScore
  ) ?? firstScoreFrom(records, [
    'liveness_score',
    'livenessScore',
    'liveness_confidence',
    'livenessConfidence',
    'live_score',
    'liveScore',
    'selfie_liveness_score',
    'selfieLivenessScore',
  ]);
  const biometricMatchScore = numericScore(
    normalized?.biometricMatchScore ??
      normalizedSelfie.match_score ??
      normalizedSelfie.matchScore ??
      selfieData.match_score ??
      selfieData.matchScore
  ) ?? firstScoreFrom(records, [
    'match_score',
    'matchScore',
    'face_match_score',
    'faceMatchScore',
    'biometric_match_score',
    'biometricMatchScore',
    'similarity',
  ]);
  const selfieUrl = typeof selfieData.selfie_url === 'string'
    ? selfieData.selfie_url
    : typeof selfieData.selfieUrl === 'string'
      ? selfieData.selfieUrl
      : typeof rawRecord.selfie_url === 'string'
        ? rawRecord.selfie_url
        : firstStringFrom(records, [
            'selfie_url',
            'selfieUrl',
            'image_url',
            'imageUrl',
            'photo_url',
            'photoUrl',
            'face_image_url',
            'faceImageUrl',
          ]);

  return {
    hasEvidence: livenessScore !== null || biometricMatchScore !== null || Boolean(selfieUrl),
    livenessScore,
    biometricMatchScore,
    selfieUrl,
  };
}
