import { describe, expect, it } from 'vitest';
import {
  mapAuctionListToBreakdownRow,
  mapAuctionToBreakdownRow,
} from '@/features/reports/utils/auction-breakdown';
import { formatCaseChannelDisplay } from '@/features/reports/utils/case-channel-label';

describe('mapAuctionToBreakdownRow', () => {
  it('includes policy, branch, and broker/agency columns', () => {
    const row = mapAuctionToBreakdownRow({
      claimReference: 'HON-2000',
      policyNumber: 'POL-456',
      branchName: 'Abuja',
      brokerName: 'Leadway Brokers',
      agencyName: null,
      assetType: 'vehicle',
      status: 'sold',
      bidCount: 5,
      uniqueBidders: 3,
      winningBid: '750000',
      reservePrice: '500000',
      durationHours: 24,
      pickupStatus: 'staff_confirmed',
      pickupVendorName: 'Vendor B',
      pickedUpAt: new Date('2026-06-10'),
      startTime: new Date('2026-06-01'),
    });

    expect(row.policyNumber).toBe('POL-456');
    expect(row.branchName).toBe('Abuja');
    expect(row.channelLabel).toBe(
      formatCaseChannelDisplay({ type: 'broker', label: 'Leadway Brokers' })
    );
    expect(row.isSuccessful).toBe(true);
    expect(row.winningBid).toBe(750000);
  });
});

describe('mapAuctionListToBreakdownRow', () => {
  it('maps API auction list items for detail tables', () => {
    const row = mapAuctionListToBreakdownRow({
      claimReference: 'HON-3000',
      policyNumber: 'POL-789',
      channelLabel: 'ABC Agency',
      branchName: 'Lagos',
      assetType: 'vehicle',
      status: 'awaiting_payment',
      bidCount: 2,
      uniqueBidders: 2,
      winningBid: null,
      reservePrice: 400000,
      durationHours: 12,
      isSuccessful: false,
      pickupStatus: 'not_ready',
      pickupVendorName: null,
      pickedUpAt: null,
      startTime: '2026-06-15T10:00:00.000Z',
    });

    expect(row.policyNumber).toBe('POL-789');
    expect(row.channelLabel).toBe('ABC Agency');
    expect(row.winningBid).toBeNull();
  });
});
