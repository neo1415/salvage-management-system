import { describe, expect, it } from 'vitest';
import {
  calculateAuctionPaymentAllocation,
  calculateWalletSettlementBalances,
} from '@/features/auction-deposit/services/payment-allocation';

describe('calculateAuctionPaymentAllocation', () => {
  it('returns surplus when the frozen deposit exceeds the winning bid', () => {
    expect(calculateAuctionPaymentAllocation(55_000, 100_000)).toEqual({
      finalBid: 55_000,
      depositHeld: 100_000,
      depositApplied: 55_000,
      depositSurplus: 45_000,
      remainingAmount: 0,
    });
  });

  it('uses the full deposit when it is below the winning bid', () => {
    expect(calculateAuctionPaymentAllocation(250_000, 100_000)).toEqual({
      finalBid: 250_000,
      depositHeld: 100_000,
      depositApplied: 100_000,
      depositSurplus: 0,
      remainingAmount: 150_000,
    });
  });

  it('handles an exact deposit without a balance or surplus', () => {
    const allocation = calculateAuctionPaymentAllocation(100_000, 100_000);

    expect(allocation.remainingAmount).toBe(0);
    expect(allocation.depositSurplus).toBe(0);
  });

  it('does not apply deposits to legacy auctions', () => {
    expect(
      calculateAuctionPaymentAllocation(55_000, 100_000, { applyDeposit: false })
    ).toMatchObject({
      depositApplied: 0,
      depositSurplus: 0,
      remainingAmount: 55_000,
    });
  });

  it.each([
    [Number.NaN, 100_000],
    [55_000, Number.POSITIVE_INFINITY],
    [-1, 100_000],
    [55_000, -1],
  ])('rejects invalid financial inputs', (finalBid, deposit) => {
    expect(() => calculateAuctionPaymentAllocation(finalBid, deposit)).toThrow();
  });
});

describe('calculateWalletSettlementBalances', () => {
  it('debits only the winning bid and returns the excess frozen deposit', () => {
    expect(
      calculateWalletSettlementBalances({
        balance: 100_000,
        availableBalance: 0,
        frozenAmount: 100_000,
        forfeitedAmount: 0,
        availableCharge: 0,
        frozenAmountToClose: 100_000,
        frozenSurplusToReturn: 45_000,
        totalDebit: 55_000,
      })
    ).toEqual({
      balance: 45_000,
      availableBalance: 45_000,
      frozenAmount: 0,
    });
  });

  it('preserves unrelated available and frozen wallet funds', () => {
    expect(
      calculateWalletSettlementBalances({
        balance: 500_000,
        availableBalance: 300_000,
        frozenAmount: 200_000,
        forfeitedAmount: 0,
        availableCharge: 0,
        frozenAmountToClose: 100_000,
        frozenSurplusToReturn: 45_000,
        totalDebit: 55_000,
      })
    ).toEqual({
      balance: 445_000,
      availableBalance: 345_000,
      frozenAmount: 100_000,
    });
  });

  it('rejects an allocation that would debit more than the purchase requires', () => {
    expect(() =>
      calculateWalletSettlementBalances({
        balance: 100_000,
        availableBalance: 0,
        frozenAmount: 100_000,
        forfeitedAmount: 0,
        availableCharge: 0,
        frozenAmountToClose: 100_000,
        frozenSurplusToReturn: 0,
        totalDebit: 55_000,
      })
    ).toThrow('allocation');
  });
});
