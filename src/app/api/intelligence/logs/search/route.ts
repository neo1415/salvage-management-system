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
import { sql, desc, gte, lte, eq } from 'drizzle-orm';
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
    if (session.user.role !== 'admin') {
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

    let logs: any[] = [];

    // Query logs based on type
    switch (logType) {
      case 'prediction':
        const predQuery = db
          .select()
          .from(predictionLogs)
          .where(
            sql`${predictionLogs.createdAt} >= ${startDate} AND ${predictionLogs.createdAt} <= ${endDate}`
          )
          .orderBy(desc(predictionLogs.createdAt))
          .limit(limit);

        if (filters?.entityId) {
          predQuery.where(eq(predictionLogs.auctionId, filters.entityId));
        }

        logs = await predQuery;
        break;

      case 'recommendation':
        const recQuery = db
          .select()
          .from(recommendationLogs)
          .where(
            sql`${recommendationLogs.createdAt} >= ${startDate} AND ${recommendationLogs.createdAt} <= ${endDate}`
          )
          .orderBy(desc(recommendationLogs.createdAt))
          .limit(limit);

        if (filters?.entityId) {
          recQuery.where(
            sql`${recommendationLogs.vendorId} = ${filters.entityId} OR ${recommendationLogs.auctionId} = ${filters.entityId}`
          );
        }

        logs = await recQuery;
        break;

      case 'fraud':
        let fraudQuery = db
          .select()
          .from(fraudDetectionLogs)
          .where(
            sql`${fraudDetectionLogs.createdAt} >= ${startDate} AND ${fraudDetectionLogs.createdAt} <= ${endDate}`
          )
          .orderBy(desc(fraudDetectionLogs.createdAt))
          .limit(limit);

        if (filters?.entityId) {
          fraudQuery = fraudQuery.where(eq(fraudDetectionLogs.entityId, filters.entityId));
        }

        if (filters?.minRiskScore !== undefined) {
          fraudQuery = fraudQuery.where(
            sql`${fraudDetectionLogs.riskScore} >= ${filters.minRiskScore}`
          );
        }

        logs = await fraudQuery;
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
