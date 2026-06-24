import { asc, desc, inArray } from 'drizzle-orm';
import { auctions } from '@/lib/db/schema/auctions';

export type BidHistoryTab = 'active' | 'completed';

export const COMPLETED_BID_HISTORY_STATUSES = [
  'closed',
  'cancelled',
  'awaiting_payment',
  'forfeited',
] as const;

export const ACTIVE_BID_HISTORY_STATUSES = ['scheduled', 'active', 'extended'] as const;

export function bidHistoryStatusFilter(tab: BidHistoryTab) {
  return tab === 'completed'
    ? inArray(auctions.status, [...COMPLETED_BID_HISTORY_STATUSES])
    : inArray(auctions.status, [...ACTIVE_BID_HISTORY_STATUSES]);
}

export function bidHistoryAuctionOrder(tab: BidHistoryTab) {
  if (tab === 'completed') {
    return [desc(auctions.updatedAt), desc(auctions.endTime), desc(auctions.createdAt)];
  }

  return [asc(auctions.endTime), desc(auctions.createdAt)];
}

type AuctionSortFields = {
  endTime: string | Date;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
};

export function getBidHistoryAuctionSortTimestamp(auction: AuctionSortFields): number {
  const timestamps = [
    auction.updatedAt ? new Date(auction.updatedAt).getTime() : 0,
    new Date(auction.endTime).getTime(),
    new Date(auction.createdAt).getTime(),
  ].filter((value) => Number.isFinite(value) && value > 0);

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

type AuctionSortable = {
  auction: AuctionSortFields;
};

export function sortBidHistoryItems<T extends AuctionSortable>(items: T[], tab: BidHistoryTab): T[] {
  if (tab === 'completed') {
    return [...items].sort((a, b) => {
      const aTime = getBidHistoryAuctionSortTimestamp(a.auction);
      const bTime = getBidHistoryAuctionSortTimestamp(b.auction);
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.auction.createdAt).getTime() - new Date(a.auction.createdAt).getTime();
    });
  }

  return [...items].sort((a, b) => {
    const aEnd = new Date(a.auction.endTime).getTime();
    const bEnd = new Date(b.auction.endTime).getTime();
    if (aEnd !== bEnd) return aEnd - bEnd;
    return new Date(b.auction.createdAt).getTime() - new Date(a.auction.createdAt).getTime();
  });
}
