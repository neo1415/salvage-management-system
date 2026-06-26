import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases, valuationEvidence } from '@/lib/db/schema';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import { buildUniversalItemInfoFromCase } from '@/features/cases/services/case-item-info';
import { formatStaffReviewNotes } from '@/features/cases/services/ai-warning-sanitization';

const MANAGER_ROLES = new Set(['salvage_manager', 'system_admin']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !MANAGER_ROLES.has(session.user.role || '')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const [caseRow] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    if (!caseRow) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    if (caseRow.status !== 'pending_approval') {
      return NextResponse.json(
        { success: false, error: 'AI assessment can only be run while the case is pending approval' },
        { status: 400 }
      );
    }

    const policy = await businessPolicyService.getEffectivePolicy();
    if (policy.cases.aiDamageAssessmentRunner !== 'salvage_manager') {
      return NextResponse.json(
        {
          success: false,
          error: 'Policy is configured for claims adjuster AI analysis. Enable manager-run analysis in Case Workflow policy.',
        },
        { status: 400 }
      );
    }

    const photos = Array.isArray(caseRow.photos) ? caseRow.photos.filter(Boolean) : [];
    if (photos.length < 3) {
      return NextResponse.json(
        { success: false, error: 'At least 3 case photos are required for AI assessment' },
        { status: 400 }
      );
    }

    const universalItemInfo = buildUniversalItemInfoFromCase({
      assetType: caseRow.assetType,
      assetDetails: caseRow.assetDetails,
      marketValue: caseRow.marketValue,
    });

    if (!universalItemInfo) {
      return NextResponse.json(
        { success: false, error: 'Unable to build item context for this asset type' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const forceRefresh = Boolean(body?.forceRefresh);

    const assessment = await assessDamageEnhanced({
      photos,
      universalItemInfo,
      forceRefresh,
    });

    const staffReviewReasons = formatStaffReviewNotes(
      assessment.reviewReasons,
      assessment.warnings,
      {
        confidenceScore: assessment.confidenceScore,
        manualReviewRequired: assessment.manualReviewRequired,
      }
    );

    const aiAssessmentPayload = {
      labels: assessment.labels,
      confidenceScore: assessment.confidenceScore,
      damagePercentage: assessment.damagePercentage,
      processedAt: new Date(),
      damageScore: assessment.damageScore,
      confidence: assessment.confidence,
      estimatedRepairCost: assessment.estimatedRepairCost,
      isRepairable: assessment.isRepairable,
      isTotalLoss: assessment.isTotalLoss,
      priceSource: assessment.priceSource,
      recommendation: assessment.summary || assessment.recommendation,
      summary: assessment.summary,
      warnings: [],
      manualReviewRequired: assessment.manualReviewRequired || staffReviewReasons.length > 0,
      reviewReasons: staffReviewReasons,
      valuationEvidence: assessment.valuationEvidence,
      analysisMethod: assessment.analysisMethod,
      photoCount: assessment.photoCount,
      itemDetails: assessment.itemDetails,
      damagedParts: assessment.damagedParts,
      damageBreakdown: assessment.damageBreakdown,
    };

    await db
      .update(salvageCases)
      .set({
        estimatedSalvageValue: String(assessment.estimatedSalvageValue),
        reservePrice: String(assessment.reservePrice),
        damageSeverity: assessment.damageSeverity,
        aiAssessment: aiAssessmentPayload,
        marketValue: String(assessment.marketValue || caseRow.marketValue),
      })
      .where(eq(salvageCases.id, caseId));

    if (assessment.valuationEvidence) {
      try {
        await db.insert(valuationEvidence).values({
          caseId,
          assetType: caseRow.assetType,
          itemIdentifier: (caseRow.assetDetails || {}) as Record<string, unknown>,
          marketEvidence: assessment.valuationEvidence.marketEvidence || {},
          partEvidence: assessment.valuationEvidence.partEvidence || {},
          decisionSummary: (assessment.valuationEvidence.decisionSummary || {
            marketConfidence: assessment.confidenceScore,
            damageConfidence: assessment.confidenceScore,
            overallConfidence: assessment.confidenceScore,
            uniqueSourceCount: 0,
            priceSpreadPercent: 0,
            manualReviewRequired: aiAssessmentPayload.manualReviewRequired,
            reviewReasons: staffReviewReasons,
          }) as typeof valuationEvidence.$inferInsert['decisionSummary'],
          createdBy: session.user.id,
        });
      } catch (evidenceError) {
        console.warn('Failed to store valuation evidence after manager AI run:', evidenceError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        damageSeverity: assessment.damageSeverity,
        confidenceScore: assessment.confidenceScore,
        estimatedSalvageValue: assessment.estimatedSalvageValue,
        reservePrice: assessment.reservePrice,
        marketValue: assessment.marketValue,
        aiAssessment: aiAssessmentPayload,
        estimatedRepairCost: assessment.estimatedRepairCost,
        damagePercentage: assessment.damagePercentage,
        itemDetails: assessment.itemDetails,
        damagedParts: assessment.damagedParts,
        damageBreakdown: assessment.damageBreakdown,
        recommendation: aiAssessmentPayload.recommendation,
        summary: assessment.summary,
        reviewReasons: staffReviewReasons,
        manualReviewRequired: aiAssessmentPayload.manualReviewRequired,
      },
    });
  } catch (error) {
    console.error('Manager case AI assessment failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI assessment failed',
      },
      { status: 500 }
    );
  }
}
