/**
 * Intelligence Data Export API Endpoint
 * 
 * GET /api/intelligence/export
 * 
 * Export intelligence data (admin only).
 * Task 7.7.3: Create GET /api/intelligence/export route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MLDatasetService } from '@/features/intelligence/services/ml-dataset.service';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { db } from '@/lib/db';
import { z } from 'zod';

/**
 * Query parameters validation schema
 */
const exportQuerySchema = z.object({
  dataType: z.enum(['predictions', 'recommendations', 'interactions']),
  format: z.enum(['csv', 'json']).optional().default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/intelligence/export
 * 
 * Export intelligence data
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
    const queryParams = exportQuerySchema.safeParse({
      dataType: searchParams.get('dataType'),
      format: searchParams.get('format'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { dataType, format, startDate, endDate } = queryParams.data;

    // Parse dates
    const dateRangeStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateRangeEnd = endDate ? new Date(endDate) : new Date();

    // Use MLDatasetService to export data
    const mlService = new MLDatasetService();
    let exportedData: string;

    switch (dataType) {
      case 'predictions':
        exportedData = await mlService.exportPricePredictionDataset(
          dateRangeStart,
          dateRangeEnd,
          format
        );
        break;

      case 'recommendations':
        exportedData = await mlService.exportRecommendationDataset(
          dateRangeStart,
          dateRangeEnd,
          format
        );
        break;

      case 'interactions':
        // For now, return a placeholder
        exportedData = format === 'json' 
          ? JSON.stringify({ message: 'Interactions export not yet implemented' })
          : 'message\nInteractions export not yet implemented';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid data type' },
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
      actionType: 'intelligence_data_exported',
      entityType: 'dataset',
      entityId: dataType,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        dataType,
        format,
        dateRange: { start: dateRangeStart, end: dateRangeEnd },
      },
    });

    // Return data with appropriate content type
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `${dataType}_${Date.now()}.${format}`;

    return new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[Intelligence Export API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
