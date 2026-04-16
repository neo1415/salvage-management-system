/**
 * Scheduled Reports Management API
 * 
 * GET /api/reports/schedule - List user's scheduled reports
 * POST /api/reports/schedule - Create new scheduled report
 * 
 * Task 29: Report Scheduling System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportSchedulerService, ScheduleConfig } from '@/features/reports/scheduling/services/report-scheduler.service';
import { ReportService } from '@/features/reports/services/report.service';
import { z } from 'zod';

// Validation schema
const scheduleSchema = z.object({
  reportType: z.string(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  scheduleConfig: z.object({
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
    timezone: z.string().default('Africa/Lagos'),
  }),
  recipients: z.array(z.string().email()).min(1),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    assetTypes: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    vendorIds: z.array(z.string()).optional(),
  }).optional(),
  format: z.enum(['pdf', 'excel', 'csv', 'json']).default('pdf'),
});

/**
 * GET - List user's scheduled reports
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Get user's scheduled reports
    const schedules = await ReportSchedulerService.getScheduledReports(session.user.id);

    return NextResponse.json({
      status: 'success',
      data: schedules,
      metadata: {
        count: schedules.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('List scheduled reports error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new scheduled report
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.errors,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const config = validation.data as ScheduleConfig;

    // Check if user has permission to schedule this report type
    if (!ReportService.hasPermission(session.user.role, config.reportType as any)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to schedule this report type',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // Create scheduled report
    const schedule = await ReportSchedulerService.scheduleReport(session.user.id, config);

    return NextResponse.json({
      status: 'success',
      data: schedule,
      message: 'Report scheduled successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Create scheduled report error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
