/**
 * Individual Scheduled Report Management API
 * 
 * GET /api/reports/schedule/[id] - Get scheduled report details
 * PATCH /api/reports/schedule/[id] - Update scheduled report
 * DELETE /api/reports/schedule/[id] - Cancel scheduled report
 * 
 * Task 29: Report Scheduling System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportSchedulerService, ScheduleConfig } from '@/features/reports/scheduling/services/report-scheduler.service';
import { z } from 'zod';

// Validation schema for updates
const updateSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
  scheduleConfig: z.object({
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: z.string(),
  }).optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    assetTypes: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    vendorIds: z.array(z.string()).optional(),
  }).optional(),
  format: z.enum(['pdf', 'excel', 'csv', 'json']).optional(),
  action: z.enum(['pause', 'resume']).optional(),
});

/**
 * GET - Get scheduled report details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const scheduleId = params.id;

    // Get scheduled report
    const schedule = await ReportSchedulerService.getScheduledReport(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Scheduled report not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Check ownership
    if (schedule.userId !== session.user.id && session.user.role !== 'system_admin') {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this scheduled report',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: schedule,
    });
  } catch (error) {
    console.error('Get scheduled report error:', error);
    
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
 * PATCH - Update scheduled report or pause/resume
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const scheduleId = params.id;

    // Get scheduled report to check ownership
    const schedule = await ReportSchedulerService.getScheduledReport(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Scheduled report not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Check ownership
    if (schedule.userId !== session.user.id && session.user.role !== 'system_admin') {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to modify this scheduled report',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateSchema.safeParse(body);

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

    const updates = validation.data;

    // Handle pause/resume actions
    if (updates.action === 'pause') {
      await ReportSchedulerService.pauseSchedule(scheduleId);
      return NextResponse.json({
        status: 'success',
        message: 'Scheduled report paused successfully',
      });
    }

    if (updates.action === 'resume') {
      await ReportSchedulerService.resumeSchedule(scheduleId);
      return NextResponse.json({
        status: 'success',
        message: 'Scheduled report resumed successfully',
      });
    }

    // Update schedule
    const updated = await ReportSchedulerService.updateSchedule(scheduleId, updates as Partial<ScheduleConfig>);

    return NextResponse.json({
      status: 'success',
      data: updated,
      message: 'Scheduled report updated successfully',
    });
  } catch (error) {
    console.error('Update scheduled report error:', error);
    
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
 * DELETE - Cancel scheduled report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const scheduleId = params.id;

    // Get scheduled report to check ownership
    const schedule = await ReportSchedulerService.getScheduledReport(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Scheduled report not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Check ownership
    if (schedule.userId !== session.user.id && session.user.role !== 'system_admin') {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete this scheduled report',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // Cancel schedule
    await ReportSchedulerService.cancelSchedule(scheduleId);

    return NextResponse.json({
      status: 'success',
      message: 'Scheduled report cancelled successfully',
    });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    
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
