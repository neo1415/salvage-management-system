import { describe, expect, it } from 'vitest';
import { getTelephoneHref } from '@/lib/utils/phone-link';

describe('getTelephoneHref', () => {
  it.each([
    ['0803 123 4567', 'tel:+2348031234567'],
    ['+234 (803) 123-4567', 'tel:+2348031234567'],
    ['8031234567', 'tel:+2348031234567'],
    ['+44 20 7946 0958', 'tel:+442079460958'],
  ])('normalizes callable numbers', (input, expected) => {
    expect(getTelephoneHref(input)).toBe(expected);
  });

  it.each([null, undefined, '', '   ', '12345', 'support@example.com', 'CALL-US-NOW'])('rejects non-callable values', (input) => {
    expect(getTelephoneHref(input)).toBeNull();
  });
});
