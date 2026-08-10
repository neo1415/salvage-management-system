import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteCacheKey } = vi.hoisted(() => ({
  deleteCacheKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/redis/client', () => ({
  cache: { del: deleteCacheKey },
}));

import {
  getAuctionDetailsCacheKey,
  getAuctionDetailsCacheKeys,
  invalidateAuctionDetailsCache,
} from '@/features/auctions/services/auction-details-cache';

describe('auction details cache keys', () => {
  beforeEach(() => {
    deleteCacheKey.mockClear();
  });

  it('uses the same versioned keys for readers and invalidation', () => {
    expect(getAuctionDetailsCacheKey('auction-1', 'public')).toBe(
      'auction:details:v2:auction-1:public'
    );
    expect(getAuctionDetailsCacheKey('auction-1', 'staff')).toBe(
      'auction:details:v2:auction-1:staff'
    );
    expect(getAuctionDetailsCacheKeys('auction-1')).toEqual([
      'auction:details:v2:auction-1:public',
      'auction:details:v2:auction-1:staff',
      'auction:details:auction-1',
    ]);
  });

  it('invalidates public, staff, and legacy auction detail entries', async () => {
    await invalidateAuctionDetailsCache('auction-1');

    expect(deleteCacheKey).toHaveBeenCalledTimes(3);
    expect(deleteCacheKey).toHaveBeenCalledWith('auction:details:v2:auction-1:public');
    expect(deleteCacheKey).toHaveBeenCalledWith('auction:details:v2:auction-1:staff');
    expect(deleteCacheKey).toHaveBeenCalledWith('auction:details:auction-1');
  });
});
