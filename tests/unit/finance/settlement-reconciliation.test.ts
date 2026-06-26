import { describe, expect, it } from 'vitest';
import {
  buildPaymentSettlementFields,
  describePaidVsSettledDelta,
} from '@/lib/finance/settlement-reconciliation';

describe('buildPaymentSettlementFields', () => {
  it('returns no settlement when auction has no adjustment', () => {
    const result = buildPaymentSettlementFields('500000', {
      finalSettledAmount: null,
      currentBid: '500000',
    });
    expect(result.settlement).toBeNull();
    expect(result.effectiveSaleAmount).toBe('500000.00');
  });

  it('returns settlement info when final settled amount is set', () => {
    const result = buildPaymentSettlementFields('500000', {
      finalSettledAmount: '450000',
      currentBid: '500000',
      originalWinningBid: '500000',
    });
    expect(result.settlement?.hasPriceAdjustment).toBe(true);
    expect(result.settlement?.paidAmount).toBe('500000.00');
    expect(result.settlement?.settledAmount).toBe('450000.00');
    expect(result.settlement?.paidVsSettledDelta).toBe('50000.00');
  });
});

describe('describePaidVsSettledDelta', () => {
  it('explains positive delta in plain language', () => {
    const text = describePaidVsSettledDelta(50000);
    expect(text).toContain('more was collected');
    expect(text).toContain('recovery reports');
  });
});
