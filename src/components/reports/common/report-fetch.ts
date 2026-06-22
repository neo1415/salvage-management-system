'use client';

import type { ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters } from '@/features/reports/utils/report-date-range';
import {
  buildReportCacheKey,
  fetchReportWithClientCache,
} from '@/hooks/use-report-client-cache';

export { defaultReportFilters };

export async function loadReportFromApi(
  apiPath: string,
  filters: ReportFilters,
  options?: { force?: boolean; extraParams?: Record<string, string> }
): Promise<{ status?: string; data?: unknown; success?: boolean; [key: string]: unknown }> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
  if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
  const extraParams = options?.extraParams || {};
  if (filters.assetTypes?.length && !extraParams.assetTypes) params.append('assetTypes', filters.assetTypes.join(','));
  if (filters.regions?.length && !extraParams.regions) params.append('regions', filters.regions.join(','));
  if (filters.branches?.length && !extraParams.branches) params.append('branches', filters.branches.join(','));
  if (filters.status?.length && !extraParams.status) params.append('status', filters.status.join(','));
  if (filters.groupBy && !extraParams.groupBy) params.append('groupBy', filters.groupBy);
  if (options?.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value) params.append(key, value);
    }
  }

  const cacheKey = buildReportCacheKey(apiPath, params);
  const { data } = await fetchReportWithClientCache(
    cacheKey,
    async () => {
      const response = await fetch(`${apiPath}?${params}`);
      if (!response.ok) {
        throw new Error(`Report request failed (${response.status})`);
      }
      return response.json();
    },
    options
  );

  return data as { status?: string; data?: unknown; success?: boolean };
}
