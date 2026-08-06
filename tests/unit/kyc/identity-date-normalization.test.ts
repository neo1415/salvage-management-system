import { describe, expect, it } from 'vitest';
import { normalizeIdentityDate } from '@/features/kyc/utils/validation';

describe('identity date normalization', () => {
  it.each([
    ['1998-12-14', '1998-12-14'],
    ['1998/12/14', '1998-12-14'],
    ['14-12-1998', '1998-12-14'],
    ['14/12/1998', '1998-12-14'],
    ['14 December 1998', '1998-12-14'],
    ['1998-12-14T00:00:00.000Z', '1998-12-14'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIdentityDate(input)).toBe(expected);
  });

  it('rejects impossible and empty dates', () => {
    expect(normalizeIdentityDate('31-02-1998')).toBeNull();
    expect(normalizeIdentityDate('')).toBeNull();
  });
});
