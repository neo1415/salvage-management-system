import { describe, expect, it } from 'vitest';
import { calculateAuctionPaymentProgress } from '@/features/auction-deposit/services/payment-progress';

describe('calculateAuctionPaymentProgress', () => {
  it('reports a single complete payment', () => {
    expect(calculateAuctionPaymentProgress(355_000, [355_000])).toEqual({
      requiredAmount: 355_000,
      confirmedAmount: 355_000,
      outstandingAmount: 0,
      isComplete: true,
    });
  });

  it('keeps a provider-confirmed partial charge incomplete', () => {
    expect(calculateAuctionPaymentProgress(355_000, [255_000])).toEqual({
      requiredAmount: 355_000,
      confirmedAmount: 255_000,
      outstandingAmount: 100_000,
      isComplete: false,
    });
  });

  it('completes after cumulative supplemental payments cover the bid', () => {
    expect(calculateAuctionPaymentProgress(355_000, [255_000, 100_000])).toEqual({
      requiredAmount: 355_000,
      confirmedAmount: 355_000,
      outstandingAmount: 0,
      isComplete: true,
    });
  });

  it('ignores invalid and negative confirmed amounts', () => {
    expect(calculateAuctionPaymentProgress(100_000, [Number.NaN, -10, 25_000])).toEqual({
      requiredAmount: 100_000,
      confirmedAmount: 25_000,
      outstandingAmount: 75_000,
      isComplete: false,
    });
  });

  it('treats overpayment as complete without a negative balance', () => {
    expect(calculateAuctionPaymentProgress(100_000, [120_000])).toEqual({
      requiredAmount: 100_000,
      confirmedAmount: 120_000,
      outstandingAmount: 0,
      isComplete: true,
    });
  });

  it('does not mark an invalid or zero obligation as paid', () => {
    expect(calculateAuctionPaymentProgress(Number.NaN, [10_000]).isComplete).toBe(false);
    expect(calculateAuctionPaymentProgress(0, [10_000]).isComplete).toBe(false);
  });
});
