import { describe, expect, it } from 'vitest';
import { resolveCaseDisplayStatus } from '@/lib/metrics/case-display-status';

describe('resolveCaseDisplayStatus', () => {
  it('keeps sold reserved for confirmed pickup release', () => {
    expect(
      resolveCaseDisplayStatus({
        caseStatus: 'active_auction',
        auctionStatus: 'awaiting_payment',
        paymentId: 'payment-1',
        paymentStatus: 'verified',
      })
    ).toBe('awaiting_pickup');
  });

  it('returns sold only when the case itself has been released as sold', () => {
    expect(
      resolveCaseDisplayStatus({
        caseStatus: 'sold',
        auctionStatus: 'closed',
        paymentId: 'payment-1',
        paymentStatus: 'verified',
      })
    ).toBe('sold');
  });
});
