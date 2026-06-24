import { describe, expect, it } from 'vitest';
import {
  bidHistoryBadgeClassName,
  resolveBidHistoryBadge,
  resolveBidHistoryPaymentLabel,
} from '@/lib/auctions/bid-history-display';

describe('resolveBidHistoryPaymentLabel', () => {
  it('maps verified payment to Payment Completed', () => {
    expect(resolveBidHistoryPaymentLabel({ status: 'verified' })).toBe('Payment Completed');
  });

  it('falls back to pending when case is sold without payment row', () => {
    expect(resolveBidHistoryPaymentLabel(null, 'sold')).toBe('Payment Pending');
  });
});

describe('resolveBidHistoryBadge', () => {
  it('shows payment completed when payment is verified even if auction is awaiting_payment', () => {
    const badge = resolveBidHistoryBadge({
      auctionStatus: 'awaiting_payment',
      payment: { status: 'verified' },
      caseStatus: 'sold',
    });
    expect(badge.label).toBe('Payment completed');
    expect(badge.tone).toBe('closed');
  });

  it('shows awaiting payment when auction status is awaiting_payment and payment pending', () => {
    const badge = resolveBidHistoryBadge({
      auctionStatus: 'awaiting_payment',
      payment: { status: 'pending' },
    });
    expect(badge.label).toBe('Awaiting payment');
    expect(badge.tone).toBe('payment');
  });
});

describe('bidHistoryBadgeClassName', () => {
  it('returns tone-specific classes', () => {
    expect(bidHistoryBadgeClassName('payment')).toContain('amber');
  });
});
