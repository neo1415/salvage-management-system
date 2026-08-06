import { describe, expect, it } from 'vitest';
import { matchDojahBVNDetails } from '@/features/vendors/services/bvn-verification.service';

describe('Dojah BVN field matching', () => {
  it('accepts explicit provider matches when confidence values are omitted', () => {
    const result = matchDojahBVNDetails({
      bvnValid: true,
      firstNameStatus: true,
      lastNameStatus: true,
      dobValid: true,
      hasMiddleNameInput: false,
      hasMiddleNameResult: false,
    });

    expect(result).toEqual({
      verified: true,
      matchScore: 100,
      mismatches: [],
    });
  });

  it('does not reject an explicit provider match because of an inconsistent low confidence value', () => {
    const result = matchDojahBVNDetails({
      bvnValid: true,
      firstNameStatus: true,
      lastNameStatus: true,
      firstNameConfidence: 0,
      lastNameConfidence: 0,
      dobValid: true,
      hasMiddleNameInput: true,
      hasMiddleNameResult: false,
    });

    expect(result.verified).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.matchScore).toBeGreaterThanOrEqual(75);
  });

  it('still rejects an explicit provider name mismatch', () => {
    const result = matchDojahBVNDetails({
      bvnValid: true,
      firstNameStatus: false,
      lastNameStatus: true,
      firstNameConfidence: 95,
      lastNameConfidence: 100,
      dobValid: true,
      hasMiddleNameInput: false,
      hasMiddleNameResult: false,
    });

    expect(result.verified).toBe(false);
    expect(result.mismatches).toContain('Registered name did not match BVN records');
  });
});
