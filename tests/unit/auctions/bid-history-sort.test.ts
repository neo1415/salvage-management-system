import { describe, expect, it } from 'vitest';
import {
  getBidHistoryAuctionSortTimestamp,
  sortBidHistoryItems,
} from '@/lib/auctions/bid-history-sort';

function item(
  endTime: string,
  createdAt: string,
  updatedAt?: string
) {
  return {
    auction: {
      endTime,
      createdAt,
      updatedAt,
    },
  };
}

describe('sortBidHistoryItems', () => {
  it('sorts completed auctions by latest activity first (updatedAt wins)', () => {
    const sorted = sortBidHistoryItems(
      [
        item('2026-01-01T10:00:00Z', '2026-01-01T08:00:00Z', '2026-01-02T08:00:00Z'),
        item('2026-01-05T10:00:00Z', '2026-01-05T08:00:00Z', '2026-01-05T09:00:00Z'),
        item('2026-01-03T10:00:00Z', '2026-01-03T08:00:00Z', '2026-01-04T08:00:00Z'),
      ],
      'completed'
    );

    expect(sorted.map((entry) => entry.auction.endTime)).toEqual([
      '2026-01-05T10:00:00Z',
      '2026-01-03T10:00:00Z',
      '2026-01-01T10:00:00Z',
    ]);
  });

  it('sorts active auctions by end time ascending (ending soonest first)', () => {
    const sorted = sortBidHistoryItems(
      [
        item('2026-01-03T10:00:00Z', '2026-01-03T08:00:00Z'),
        item('2026-01-01T10:00:00Z', '2026-01-01T08:00:00Z'),
        item('2026-01-02T10:00:00Z', '2026-01-02T08:00:00Z'),
      ],
      'active'
    );

    expect(sorted.map((entry) => entry.auction.endTime)).toEqual([
      '2026-01-01T10:00:00Z',
      '2026-01-02T10:00:00Z',
      '2026-01-03T10:00:00Z',
    ]);
  });
});

describe('getBidHistoryAuctionSortTimestamp', () => {
  it('prefers updatedAt over scheduled endTime', () => {
    const timestamp = getBidHistoryAuctionSortTimestamp({
      endTime: '2026-01-01T10:00:00Z',
      createdAt: '2026-01-01T08:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
    });

    expect(timestamp).toBe(new Date('2026-01-10T10:00:00Z').getTime());
  });
});
