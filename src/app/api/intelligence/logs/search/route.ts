/**
 * Intelligence Logs Search API Endpoint
 * 
 * POST /api/intelligence/logs/search
 * 
 * Search intelligence logs (admin only).
 * Task 7.7.5: Create POST /api/intelligence/logs/search route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/logs/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { predictionLogs, recommendationLogs, fraudDetectionLogs } from '@/lib/db/schema/ml-training';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { sql, desc, eq, and } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Request validation schema
 */
const logsSearchSchema = z.object({
  logType: z.enum(['prediction', 'recommendation', 'fraud']),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    entityId: z.string().uuid().optional(),
    minRiskScore: z.number().min(0).max(100).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
});

type IntelligenceLog =
  | typeof predictionLogs.$inferSelect
  | typeof recommendationLogs.$inferSelect
  | typeof fraudDetectionLogs.$inferSelect;

/**
 * POST /api/intelligence/logs/search
 * 
 * Search intelligence logs
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
    const validation = logsSearchSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { logType, filters, limit } = validation.data;

    // Parse dates
    const startDate = filters?.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters?.endDate ? new Date(filters.endDate) : new Date();

    let logs: IntelligenceLog[] = [];

    // Query logs based on type
    switch (logType) {
      case 'prediction':
        logs = await db
          .select()
          .from(predictionLogs)
          .where(and(
            sql`${predictionLogs.createdAt} >= ${startDate}`,
            sql`${predictionLogs.createdAt} <= ${endDate}`,
            filters?.entityId ? eq(predictionLogs.auctionId, filters.entityId) : undefined
          ))
          .orderBy(desc(predictionLogs.createdAt))
          .limit(limit);
        break;

      case 'recommendation':
        logs = await db
          .select()
          .from(recommendationLogs)
          .where(and(
            sql`${recommendationLogs.createdAt} >= ${startDate}`,
            sql`${recommendationLogs.createdAt} <= ${endDate}`,
            filters?.entityId
              ? sql`${recommendationLogs.vendorId} = ${filters.entityId} OR ${recommendationLogs.auctionId} = ${filters.entityId}`
              : undefined
          ))
          .orderBy(desc(recommendationLogs.createdAt))
          .limit(limit);
        break;

      case 'fraud':
        logs = await db
          .select()
          .from(fraudDetectionLogs)
          .where(and(
            sql`${fraudDetectionLogs.createdAt} >= ${startDate}`,
            sql`${fraudDetectionLogs.createdAt} <= ${endDate}`,
            filters?.entityId ? eq(fraudDetectionLogs.entityId, filters.entityId) : undefined,
            filters?.minRiskScore !== undefined ? sql`${fraudDetectionLogs.riskScore} >= ${filters.minRiskScore}` : undefined
          ))
          .orderBy(desc(fraudDetectionLogs.createdAt))
          .limit(limit);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid log type' },
          { status: 400 }
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
      actionType: 'intelligence_logs_searched',
      entityType: 'logs',
      entityId: logType,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        logType,
        filters,
        resultCount: logs.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        logType,
        logs,
        count: logs.length,
        filters: {
          startDate,
          endDate,
          entityId: filters?.entityId,
          minRiskScore: filters?.minRiskScore,
        },
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Intelligence Logs Search API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
