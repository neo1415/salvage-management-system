import { describe, expect, it } from 'vitest';
import { formatVendorDisplayName } from '@/lib/utils/vendor-display-name';

describe('formatVendorDisplayName', () => {
  it('prefers business name when present', () => {
    expect(
      formatVendorDisplayName({ businessName: 'ABC Motors', fullName: 'John Doe' })
    ).toBe('ABC Motors');
  });

  it('falls back to full name when business name is missing', () => {
    expect(formatVendorDisplayName({ businessName: null, fullName: 'John Doe' })).toBe('John Doe');
  });

  it('falls back to email then default', () => {
    expect(formatVendorDisplayName({ email: 'vendor@example.com' })).toBe('vendor@example.com');
    expect(formatVendorDisplayName({})).toBe('Individual vendor');
  });
});
