import { cache } from '@/lib/redis/client';

const AUCTION_DETAILS_CACHE_VERSION = 'v2';

export function getAuctionDetailsCacheKey(
  auctionId: string,
  viewer: 'public' | 'staff'
): string {
  return `auction:details:${AUCTION_DETAILS_CACHE_VERSION}:${auctionId}:${viewer}`;
}

export function getAuctionDetailsCacheKeys(auctionId: string): string[] {
  return [
    getAuctionDetailsCacheKey(auctionId, 'public'),
    getAuctionDetailsCacheKey(auctionId, 'staff'),
    `auction:details:${auctionId}`,
  ];
}

export async function invalidateAuctionDetailsCache(auctionId: string): Promise<void> {
  await Promise.all(getAuctionDetailsCacheKeys(auctionId).map((key) => cache.del(key)));
}
