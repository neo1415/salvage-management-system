/**
 * Shared default date bounds for report queries.
 * Avoids scanning full history when callers omit start/end.
 */

export const DEFAULT_REPORT_LOOKBACK_DAYS = 90;

export function defaultReportDateRange(): { start: Date; end: Date } {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - DEFAULT_REPORT_LOOKBACK_DAYS);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export function resolveReportDateRange(
  startDate?: string | Date | null,
  endDate?: string | Date | null
): { start: Date; end: Date } {
  const defaults = defaultReportDateRange();
  const start = startDate ? new Date(startDate) : defaults.start;
  const end = endDate ? new Date(endDate) : defaults.end;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use ISO date strings');
  }

  if (start > end) {
    throw new Error('startDate must be before endDate');
  }

  return { start, end };
}

export function resolveReportIsoDateRange(
  startDate?: string | Date | null,
  endDate?: string | Date | null
): { startDate: string; endDate: string } {
  const { start, end } = resolveReportDateRange(startDate, endDate);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

/** Client-side default filters for report pages (matches server defaults). */
export function defaultReportFilters(): { startDate: Date; endDate: Date } {
  const { start, end } = defaultReportDateRange();
  return { startDate: start, endDate: end };
}
