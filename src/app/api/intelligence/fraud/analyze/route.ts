/**
 * Fraud Analysis API Endpoint
 * 
 * POST /api/intelligence/fraud/analyze
 * 
 * Analyze entity for fraud (vendor, case, auction, user).
 * Task 7.6.6: Create POST /api/intelligence/fraud/analyze route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/fraud/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FraudDetectionService } from '@/features/intelligence/services/fraud-detection.service';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { db } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Request validation schema
 */
const fraudAnalysisSchema = z.object({
  entityType: z.enum(['vendor', 'case', 'auction', 'user']),
  entityId: z.string().uuid(),
});

/**
 * POST /api/intelligence/fraud/analyze
 * 
 * Analyze entity for fraud
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Authorization: Admin only
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = fraudAnalysisSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { entityType, entityId } = validation.data;

    // Use FraudDetectionService based on entity type
    const fraudService = new FraudDetectionService();
    let analysisResult: Record<string, unknown>;
    let riskScore = 0;
    let flagReasons: string[] = [];

    switch (entityType) {
      case 'case':
        // Analyze claim patterns
        const claimResult = await fraudService.analyzeClaimPatterns(entityId);
        analysisResult = { ...claimResult };
        riskScore = claimResult.riskScore;
        flagReasons = claimResult.flagReasons;
        break;

      case 'auction':
        // Detect shill bidding
        const shillResult = await fraudService.detectShillBidding(entityId);
        analysisResult = { ...shillResult };
        riskScore = shillResult.riskScore;
        flagReasons = shillResult.flagReasons;
        break;

      case 'vendor':
        // Detect collusion
        const collusionResult = await fraudService.detectCollusion(entityId);
        analysisResult = { ...collusionResult };
        riskScore = collusionResult.riskScore;
        flagReasons = collusionResult.flagReasons;
        break;

      case 'user':
        const [linkedVendor] = await db
          .select({ id: vendors.id })
          .from(vendors)
          .where(eq(vendors.userId, entityId))
          .limit(1);

        const userCases = await db
          .select({ id: salvageCases.id })
          .from(salvageCases)
          .where(eq(salvageCases.createdBy, entityId))
          .orderBy(desc(salvageCases.createdAt))
          .limit(20);

        const userSignals: Array<{
          scope: 'vendor' | 'case';
          entityId: string;
          riskScore: number;
          flagReasons: string[];
          result: unknown;
        }> = [];

        if (linkedVendor) {
          const vendorResult = await fraudService.detectCollusion(linkedVendor.id);
          userSignals.push({
            scope: 'vendor',
            entityId: linkedVendor.id,
            riskScore: vendorResult.riskScore,
            flagReasons: vendorResult.flagReasons,
            result: vendorResult,
          });
        }

        for (const userCase of userCases) {
          const caseResult = await fraudService.analyzeClaimPatterns(userCase.id);
          userSignals.push({
            scope: 'case',
            entityId: userCase.id,
            riskScore: caseResult.riskScore,
            flagReasons: caseResult.flagReasons,
            result: caseResult,
          });
        }

        riskScore = userSignals.length > 0
          ? Math.max(...userSignals.map((signal) => signal.riskScore))
          : 0;
        flagReasons = Array.from(
          new Set(userSignals.flatMap((signal) => signal.flagReasons))
        );
        analysisResult = {
          isFraudulent: riskScore >= 50,
          riskScore,
          flagReasons,
          linkedVendorId: linkedVendor?.id ?? null,
          casesAnalyzed: userCases.length,
          signals: userSignals,
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid entity type' },
          { status: 400 }
        );
    }

    // Create fraud alert if risk score is high
    if (riskScore >= 50) {
      await fraudService.createFraudAlert(
        entityType,
        entityId,
        riskScore,
        flagReasons,
        analysisResult
      );
    }

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'fraud_analysis_performed',
      entityType,
      entityId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        riskScore,
        flagReasons,
        alertCreated: riskScore >= 50,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        entityType,
        entityId,
        riskScore,
        flagReasons,
        analysisResult,
        alertCreated: riskScore >= 50,
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Fraud Analysis API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
