/**
 * Intelligence Logs Export API Endpoint
 * 
 * GET /api/intelligence/logs/export
 * 
 * Export intelligence logs (admin only).
 * Task 7.7.4: Create GET /api/intelligence/logs/export route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/logs/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { predictionLogs, recommendationLogs, fraudDetectionLogs } from '@/lib/db/schema/ml-training';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { sql, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Query parameters validation schema
 */
const logsExportQuerySchema = z.object({
  logType: z.enum(['prediction', 'recommendation', 'fraud']).optional(),
  format: z.enum(['csv', 'json']).optional().default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
});

/**
 * GET /api/intelligence/logs/export
 * 
 * Export intelligence logs
 */
export async function GET(request: NextRequest) {
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = logsExportQuerySchema.safeParse({
      logType: searchParams.get('logType'),
      format: searchParams.get('format'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { logType, format, startDate, endDate, limit } = queryParams.data;

    // Parse dates
    const dateRangeStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateRangeEnd = endDate ? new Date(endDate) : new Date();

    let logs: any[] = [];

    // Query logs based on type
    if (!logType || logType === 'prediction') {
      const predLogs = await db
        .select()
        .from(predictionLogs)
        .where(
          sql`${predictionLogs.createdAt} >= ${dateRangeStart} AND ${predictionLogs.createdAt} <= ${dateRangeEnd}`
        )
        .orderBy(desc(predictionLogs.createdAt))
        .limit(limit);

      logs.push(...predLogs.map(log => ({
        type: 'prediction',
        ...log,
      })));
    }

    if (!logType || logType === 'recommendation') {
      const recLogs = await db
        .select()
        .from(recommendationLogs)
        .where(
          sql`${recommendationLogs.createdAt} >= ${dateRangeStart} AND ${recommendationLogs.createdAt} <= ${dateRangeEnd}`
        )
        .orderBy(desc(recommendationLogs.createdAt))
        .limit(limit);

      logs.push(...recLogs.map(log => ({
        type: 'recommendation',
        ...log,
      })));
    }

    if (!logType || logType === 'fraud') {
      const fraudLogs = await db
        .select()
        .from(fraudDetectionLogs)
        .where(
          sql`${fraudDetectionLogs.createdAt} >= ${dateRangeStart} AND ${fraudDetectionLogs.createdAt} <= ${dateRangeEnd}`
        )
        .orderBy(desc(fraudDetectionLogs.createdAt))
        .limit(limit);

      logs.push(...fraudLogs.map(log => ({
        type: 'fraud',
        ...log,
      })));
    }

    // Sort by created_at descending
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Limit total results
    logs = logs.slice(0, limit);

    // Format data
    let exportedData: string;

    if (format === 'json') {
      exportedData = JSON.stringify(logs, null, 2);
    } else {
      // CSV format
      if (logs.length === 0) {
        exportedData = 'No logs found';
      } else {
        const headers = Object.keys(logs[0]).join(',');
        const rows = logs.map(log => 
          Object.values(log).map(v => 
            typeof v === 'object' ? JSON.stringify(v) : String(v)
          ).join(',')
        );
        exportedData = [headers, ...rows].join('\n');
      }
    }

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'intelligence_logs_exported',
      entityType: 'logs',
      entityId: logType || 'all',
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        logType,
        format,
        dateRange: { start: dateRangeStart, end: dateRangeEnd },
        recordCount: logs.length,
      },
    });

    // Return data with appropriate content type
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `intelligence_logs_${logType || 'all'}_${Date.now()}.${format}`;

    return new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[Intelligence Logs Export API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
