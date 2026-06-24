import { describe, expect, it } from 'vitest';
import {
  formatCaseChannelDisplay,
  resolveCaseChannelLabel,
} from '@/features/reports/utils/case-channel-label';
import { mapCaseToBreakdownRow } from '@/features/reports/utils/case-breakdown';

describe('resolveCaseChannelLabel', () => {
  it('prefers broker over agency', () => {
    expect(resolveCaseChannelLabel('ABC Brokers', 'XYZ Agency')).toEqual({
      type: 'broker',
      label: 'ABC Brokers',
    });
  });

  it('uses agency when broker is empty', () => {
    expect(resolveCaseChannelLabel(null, 'XYZ Agency')).toEqual({
      type: 'agency',
      label: 'XYZ Agency',
    });
  });
});

describe('mapCaseToBreakdownRow', () => {
  it('includes policy, branch, and channel columns', () => {
    const row = mapCaseToBreakdownRow({
      claimReference: 'HON-2000',
      policyNumber: 'POL-123',
      branchName: 'Lagos',
      brokerName: 'Leadway Brokers',
      agencyName: null,
      status: 'sold',
      marketValue: '500000',
      estimatedSalvageValue: '250000',
      processingTimeHours: 48,
      possessingVendorName: 'Vendor A',
      pickedUpAt: new Date('2026-06-01'),
      createdAt: new Date('2026-05-01'),
    });

    expect(row.policyNumber).toBe('POL-123');
    expect(row.branchName).toBe('Lagos');
    expect(row.channelLabel).toBe(formatCaseChannelDisplay({ type: 'broker', label: 'Leadway Brokers' }));
  });
});
