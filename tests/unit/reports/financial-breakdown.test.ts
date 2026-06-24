import { describe, expect, it } from 'vitest';
import { mapRevenueToFinancialDetail } from '@/features/reports/utils/financial-breakdown';

describe('mapRevenueToFinancialDetail', () => {
  it('includes policy and broker/agency channel label', () => {
    const row = mapRevenueToFinancialDetail({
      claimReference: 'HON-2000',
      policyNumber: 'POL-99',
      branchName: 'Lagos',
      brokerName: 'Leadway',
      agencyName: null,
      assetType: 'vehicle',
      marketValue: '500000',
      salvageRecovery: '250000',
      netLoss: 250000,
      recoveryRate: 50,
      createdAt: new Date('2026-06-01'),
    });

    expect(row.policyNumber).toBe('POL-99');
    expect(row.channelLabel).toContain('Broker');
    expect(row.channelLabel).toContain('Leadway');
  });
});
