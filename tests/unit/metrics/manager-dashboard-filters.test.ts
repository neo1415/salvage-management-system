import { describe, expect, it } from 'vitest';
import {
  buildManagerDashboardCacheKey,
  parseManagerDashboardFilters,
} from '@/lib/metrics/manager-dashboard-filters';

describe('parseManagerDashboardFilters', () => {
  it('parses preset day range', () => {
    const filters = parseManagerDashboardFilters(new URLSearchParams('dateRange=30&assetType=vehicle'));
    expect(filters.assetType).toBe('vehicle');
    expect(filters.startDate).toBeInstanceOf(Date);
    expect(filters.endDate).toBeNull();
  });

  it('parses all-time range', () => {
    const filters = parseManagerDashboardFilters(new URLSearchParams('dateRange=all'));
    expect(filters.startDate).toBeNull();
    expect(filters.endDate).toBeNull();
  });

  it('parses custom date range and branch/broker', () => {
    const params = new URLSearchParams({
      dateRange: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      branchName: 'Akure',
      brokerQuery: 'City Covenant',
    });
    const filters = parseManagerDashboardFilters(params);
    expect(filters.branchName).toBe('Akure');
    expect(filters.brokerQuery).toBe('City Covenant');
    expect(filters.startDate?.getFullYear()).toBe(2026);
    expect(filters.startDate?.getMonth()).toBe(0);
    expect(filters.startDate?.getDate()).toBe(1);
    expect(filters.endDate).toBeInstanceOf(Date);
  });

  it('ignores invalid asset types', () => {
    const filters = parseManagerDashboardFilters(new URLSearchParams('assetType=invalid_type'));
    expect(filters.assetType).toBeNull();
  });
});

describe('buildManagerDashboardCacheKey', () => {
  it('includes filter dimensions', () => {
    const filters = parseManagerDashboardFilters(
      new URLSearchParams('dateRange=7&assetType=electronics&branchName=Akure&brokerQuery=Broker')
    );
    const key = buildManagerDashboardCacheKey(filters, '7');
    expect(key).toContain('electronics');
    expect(key).toContain('Akure');
    expect(key).toContain('Broker');
  });
});
