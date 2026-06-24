import { ReportFilters } from '../types';
import { ReportService } from '../services/report.service';

function splitParam(value: string | null): string[] | undefined {
  const items = value?.split(',').map((part) => part.trim()).filter(Boolean);
  return items && items.length > 0 ? items : undefined;
}

export function parseReportFiltersFromSearchParams(
  searchParams: URLSearchParams,
  options?: { validateDates?: boolean }
): ReportFilters {
  const startRaw = searchParams.get('startDate');
  const endRaw = searchParams.get('endDate');

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (options?.validateDates) {
    const { start, end } = ReportService.validateDateRange(startRaw, endRaw);
    startDate = start.toISOString();
    endDate = end.toISOString();
  } else if (startRaw && endRaw) {
    startDate = startRaw;
    endDate = endRaw;
  }

  return {
    startDate,
    endDate,
    assetTypes: splitParam(searchParams.get('assetTypes')),
    regions: splitParam(searchParams.get('regions')),
    branches: splitParam(searchParams.get('branches')),
    brokers: splitParam(searchParams.get('brokers')),
    status: splitParam(searchParams.get('status')),
    userIds: splitParam(searchParams.get('userIds')),
    vendorIds: splitParam(searchParams.get('vendorIds')),
    groupBy: searchParams.get('groupBy') || undefined,
  };
}
