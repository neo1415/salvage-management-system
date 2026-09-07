import { describe, expect, it } from 'vitest';
import { parseValuationNumber, salvageDisplayValue } from '@/features/valuations/services/valuation-display';
describe('missing valuation display', () => {
  it.each([null, undefined, '', ' ', 'Pending', '₦', NaN, Infinity])('keeps %s unavailable', value => {
    expect(parseValuationNumber(value)).toBeUndefined();
  });
  it('preserves explicit zero and formatted amounts', () => {
    expect(parseValuationNumber('0')).toBe(0);
    expect(parseValuationNumber(0)).toBe(0);
    expect(parseValuationNumber('₦31,350,000')).toBe(31_350_000);
  });
  it.each(['', null, '0', 0, '18232500'])('hides stale or coerced pending salvage %s', value => {
    expect(salvageDisplayValue(value, 'repair_pricing_pending')).toBeUndefined();
  });
});
