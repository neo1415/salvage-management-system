import { describe, it, expect } from 'vitest';
import { parseFullNameBvnOrder, resolveUserLegalNamesForBvn } from '@/lib/utils/person-name';

describe('parseFullNameBvnOrder', () => {
  it('splits three-part BVN-order names', () => {
    expect(parseFullNameBvnOrder('Daniel Ademola Oyeniyi')).toEqual({
      firstName: 'Daniel',
      middleName: 'Ademola',
      lastName: 'Oyeniyi',
    });
  });

  it('splits two-part names', () => {
    expect(parseFullNameBvnOrder('Daniel Oyeniyi')).toEqual({
      firstName: 'Daniel',
      lastName: 'Oyeniyi',
    });
  });

  it('tries a complete first-middle-surname arrangement for surname-first names', () => {
    const { alternateAttempts } = resolveUserLegalNamesForBvn({
      fullName: 'Oyeniyi Daniel Ademola',
    });

    expect(alternateAttempts).toContainEqual({
      firstName: 'Daniel',
      middleName: 'Ademola',
      lastName: 'Oyeniyi',
    });
  });

  it('keeps legal-name attempts unique', () => {
    const { primary, alternateAttempts } = resolveUserLegalNamesForBvn({
      fullName: 'Daniel Ademola Oyeniyi',
    });
    const attempts = [primary, ...alternateAttempts];
    const keys = attempts.map(
      (attempt) =>
        `${attempt.firstName}|${attempt.middleName ?? ''}|${attempt.lastName}`.toLowerCase()
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
