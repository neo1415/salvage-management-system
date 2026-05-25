import { describe, it, expect } from 'vitest';
import { splitFullNameForBvn } from '@/lib/utils/bvn-name-match';

describe('splitFullNameForBvn', () => {
  it('tries swapped order for two-word names (surname-first registration)', () => {
    const { attempts } = splitFullNameForBvn('oyeniyi Daniel');
    expect(attempts[0]).toEqual({ firstName: 'oyeniyi', lastName: 'Daniel' });
    expect(attempts[1]).toEqual({ firstName: 'Daniel', lastName: 'oyeniyi' });
  });

  it('tries surname-last for three-word names', () => {
    const { attempts } = splitFullNameForBvn('Daniel Ademola Oyeniyi');
    expect(attempts).toContainEqual({ firstName: 'Daniel', lastName: 'Ademola Oyeniyi' });
    expect(attempts).toContainEqual({ firstName: 'Daniel Ademola', lastName: 'Oyeniyi' });
  });
});
