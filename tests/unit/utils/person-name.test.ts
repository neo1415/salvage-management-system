import { describe, it, expect } from 'vitest';
import { parseFullNameBvnOrder } from '@/lib/utils/person-name';

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
});
