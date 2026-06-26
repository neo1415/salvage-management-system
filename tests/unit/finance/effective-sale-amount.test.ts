import { describe, expect, it } from 'vitest';
import {
  getEffectiveSaleAmount,
  getOriginalWinningAmount,
  hasPriceAdjustment,
  effectiveSaleAmountSqlFragment,
} from '@/lib/finance/effective-sale-amount';

describe('getEffectiveSaleAmount', () => {
  it('uses final_settled_amount when present', () => {
    expect(
      getEffectiveSaleAmount(
        { finalSettledAmount: '450000', currentBid: '500000' },
        { amount: '500000' }
      )
    ).toBe(450000);
  });

  it('falls back to payment amount when no final settled amount', () => {
    expect(
      getEffectiveSaleAmount(
        { finalSettledAmount: null, currentBid: '500000' },
        { amount: '480000' }
      )
    ).toBe(480000);
  });

  it('falls back to current bid when payment missing', () => {
    expect(
      getEffectiveSaleAmount({ finalSettledAmount: null, currentBid: '500000' }, null)
    ).toBe(500000);
  });

  it('returns 0 when no amounts available', () => {
    expect(getEffectiveSaleAmount({ finalSettledAmount: null, currentBid: null }, null)).toBe(0);
  });

  it('handles numeric inputs', () => {
    expect(
      getEffectiveSaleAmount({ finalSettledAmount: 125000.5, currentBid: 200000 }, { amount: 200000 })
    ).toBe(125000.5);
  });
});

describe('getOriginalWinningAmount', () => {
  it('returns original_winning_bid when set', () => {
    expect(
      getOriginalWinningAmount(
        { finalSettledAmount: '400000', originalWinningBid: '500000', currentBid: '500000' },
        { amount: '500000' }
      )
    ).toBe(500000);
  });
});

describe('hasPriceAdjustment', () => {
  it('detects adjusted auctions', () => {
    expect(hasPriceAdjustment({ finalSettledAmount: '100' })).toBe(true);
    expect(hasPriceAdjustment({ finalSettledAmount: null })).toBe(false);
  });
});

describe('effectiveSaleAmountSqlFragment', () => {
  it('builds COALESCE SQL with aliases', () => {
    expect(effectiveSaleAmountSqlFragment('a', 'p')).toBe(
      'COALESCE(a.final_settled_amount::numeric, p.amount::numeric, a.current_bid::numeric, 0)'
    );
  });
});
