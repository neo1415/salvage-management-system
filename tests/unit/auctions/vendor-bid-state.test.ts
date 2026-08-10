import { describe, expect, it } from 'vitest';
import { getVendorCurrentBid } from '@/features/auctions/services/vendor-bid-state';

describe('getVendorCurrentBid', () => {
  it('uses the authoritative current bid when history has an older vendor bid', () => {
    expect(getVendorCurrentBid({
      bids: [{ vendorId: 'vendor-1', amount: '80000' }],
      currentBid: '325000',
      currentBidder: 'vendor-1',
    }, 'vendor-1')).toBe(325000);
  });

  it('uses the highest recorded vendor bid after another vendor takes the lead', () => {
    expect(getVendorCurrentBid({
      bids: [
        { vendorId: 'vendor-1', amount: '80000' },
        { vendorId: 'vendor-1', amount: '120000' },
        { vendorId: 'vendor-2', amount: '325000' },
      ],
      currentBid: '325000',
      currentBidder: 'vendor-2',
    }, 'vendor-1')).toBe(120000);
  });

  it('returns null when the vendor has never bid', () => {
    expect(getVendorCurrentBid({
      bids: [],
      currentBid: '325000',
      currentBidder: 'vendor-2',
    }, 'vendor-1')).toBeNull();
  });
});
