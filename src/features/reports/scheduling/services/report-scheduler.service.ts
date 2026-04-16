/**
 * Report Scheduler Service
 * 
 * Manages automated report scheduling and execution
 * Task 29: Report Scheduling System
 */

import { db } from '@/lib/db/drizzle';
import { scheduledReports } from '@/lib/db/schema/reports';
import { eq, and, lte } from 'drizzle-orm';
import { ReportFilters, ReportType, ExportFormat } from '../../types';

export interface ScheduleConfig {
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  scheduleConfig: {
    dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:MM format (24-hour)
    timezone: string; // e.g., 'Africa/Lagos'
  };
  recipients: string[]; // Email addresses
  filters: ReportFilters;
  format: ExportFormat;
}

export interface ScheduledReport {
  id: string;
  userId: string;
  reportType: ReportType;
  frequency: string;
  scheduleConfig: any;
  recipients: string[];
  filters: ReportFilters;
  format: ExportFormat;
  lastRun?: Date;
  nextRun?: Date;
  status: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportSchedulerService {
  /**
   * Create a new scheduled report
   */
  static async scheduleReport(
    userId: string,
    config: ScheduleConfig
  ): Promise<ScheduledReport> {
    // Calculate next run time
    const nextRun = this.calculateNextRun(config.frequency, config.scheduleConfig);

    const [scheduled] = await db
      .insert(scheduledReports)
      .values({
        userId,
        reportType: config.reportType,
        frequency: config.frequency,
        scheduleConfig: config.scheduleConfig,
        recipients: config.recipients,
        filters: config.filters || {},
        format: config.format,
        nextRun,
        status: 'active',
      })
      .returning();

    return this.mapToScheduledReport(scheduled);
  }

  /**
   * Get all scheduled reports for a user
   */
  static async getScheduledReports(userId: string): Promise<ScheduledReport[]> {
    const reports = await db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.userId, userId))
      .orderBy(scheduledReports.nextRun);

    return reports.map(this.mapToScheduledReport);
  }

  /**
   * Get a specific scheduled report
   */
  static async getScheduledReport(scheduleId: string): Promise<ScheduledReport | null> {
    const [report] = await db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.id, scheduleId))
      .limit(1);

    return report ? this.mapToScheduledReport(report) : null;
  }

  /**
   * Update a scheduled report
   */
  static async updateSchedule(
    scheduleId: string,
    updates: Partial<ScheduleConfig>
  ): Promise<ScheduledReport> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.frequency || updates.scheduleConfig) {
      const frequency = updates.frequency;
      const scheduleConfig = updates.scheduleConfig;
      if (frequency && scheduleConfig) {
        updateData.nextRun = this.calculateNextRun(frequency, scheduleConfig);
        updateData.frequency = frequency;
        updateData.scheduleConfig = scheduleConfig;
      }
    }

    if (updates.recipients) updateData.recipients = updates.recipients;
    if (updates.filters) updateData.filters = updates.filters;
    if (updates.format) updateData.format = updates.format;

    const [updated] = await db
      .update(scheduledReports)
      .set(updateData)
      .where(eq(scheduledReports.id, scheduleId))
      .returning();

    return this.mapToScheduledReport(updated);
  }

  /**
   * Pause a scheduled report
   */
  static async pauseSchedule(scheduleId: string): Promise<void> {
    await db
      .update(scheduledReports)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(scheduledReports.id, scheduleId));
  }

  /**
   * Resume a paused scheduled report
   */
  static async resumeSchedule(scheduleId: string): Promise<void> {
    const [report] = await db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.id, scheduleId))
      .limit(1);

    if (!report) throw new Error('Schedule not found');

    const nextRun = this.calculateNextRun(
      report.frequency as any,
      report.scheduleConfig as any
    );

    await db
      .update(scheduledReports)
      .set({
        status: 'active',
        nextRun,
        updatedAt: new Date(),
      })
      .where(eq(scheduledReports.id, scheduleId));
  }

  /**
   * Delete a scheduled report
   */
  static async cancelSchedule(scheduleId: string): Promise<void> {
    await db
      .delete(scheduledReports)
      .where(eq(scheduledReports.id, scheduleId));
  }

  /**
   * Get reports that are due to run
   */
  static async getDueReports(): Promise<ScheduledReport[]> {
    const now = new Date();

    const reports = await db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.status, 'active'),
          lte(scheduledReports.nextRun, now)
        )
      );

    return reports.map(this.mapToScheduledReport);
  }

  /**
   * Mark a report as executed and calculate next run
   */
  static async markAsExecuted(
    scheduleId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const [report] = await db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.id, scheduleId))
      .limit(1);

    if (!report) return;

    const nextRun = this.calculateNextRun(
      report.frequency as any,
      report.scheduleConfig as any
    );

    await db
      .update(scheduledReports)
      .set({
        lastRun: new Date(),
        nextRun,
        status: success ? 'active' : 'failed',
        errorMessage: errorMessage || null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledReports.id, scheduleId));
  }

  /**
   * Calculate next run time based on frequency and schedule config
   */
  private static calculateNextRun(
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly',
    config: ScheduleConfig['scheduleConfig']
  ): Date {
    const now = new Date();
    const [hours, minutes] = config.time.split(':').map(Number);

    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, move to next occurrence
    if (nextRun <= now) {
      switch (frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          // Move to next occurrence of the specified day of week
          const targetDay = config.dayOfWeek || 1; // Default to Monday
          const currentDay = nextRun.getDay();
          const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
          nextRun.setDate(nextRun.getDate() + daysUntilTarget);
          break;
        case 'monthly':
          // Move to next occurrence of the specified day of month
          const targetDate = config.dayOfMonth || 1;
          nextRun.setDate(targetDate);
          if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
          }
          break;
        case 'quarterly':
          // Move to next quarter
          const currentMonth = nextRun.getMonth();
          const nextQuarterMonth = Math.ceil((currentMonth + 1) / 3) * 3;
          nextRun.setMonth(nextQuarterMonth);
          nextRun.setDate(config.dayOfMonth || 1);
          if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 3);
          }
          break;
      }
    }

    return nextRun;
  }

  /**
   * Map database record to ScheduledReport type
   */
  private static mapToScheduledReport(record: any): ScheduledReport {
    return {
      id: record.id,
      userId: record.userId,
      reportType: record.reportType,
      frequency: record.frequency,
      scheduleConfig: record.scheduleConfig,
      recipients: record.recipients,
      filters: record.filters || {},
      format: record.format,
      lastRun: record.lastRun,
      nextRun: record.nextRun,
      status: record.status,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
