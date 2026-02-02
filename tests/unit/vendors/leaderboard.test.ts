import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/vendors/leaderboard/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => {
  const mockSelect = vi.fn();
  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock('@/lib/redis/client', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Vendor Leaderboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/vendors/leaderboard', () => {
    it('should return cached leaderboard if available', async () => {
      const { cache } = await import('@/lib/redis/client');
      const mockLeaderboard = {
        leaderboard: [
          {
            rank: 1,
            vendorId: 'vendor-1',
            vendorName: 'John Doe',
            businessName: 'Doe Enterprises',
            tier: 'tier2_full',
            totalBids: 50,
            wins: 25,
            totalSpent: '5000000.00',
            onTimePickupRate: 95,
            rating: '4.8',
          },
        ],
        lastUpdated: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      vi.mocked(cache.get).mockResolvedValue(mockLeaderboard);

      const request = new NextRequest('http://localhost:3000/api/vendors/leaderboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leaderboard).toBeDefined();
      expect(data.leaderboard).toHaveLength(1);
      expect(data.leaderboard[0].rank).toBe(1);
      expect(cache.get).toHaveBeenCalledWith('leaderboard:monthly');
    });

    it('should return error on database failure', async () => {
      const { cache } = await import('@/lib/redis/client');
      const { db } = await import('@/lib/db/drizzle');

      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/vendors/leaderboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch leaderboard');
    });
  });

  describe('Cache Management', () => {
    it('should include lastUpdated and nextUpdate timestamps', async () => {
      const { cache } = await import('@/lib/redis/client');

      const mockLeaderboard = {
        leaderboard: [],
        lastUpdated: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      vi.mocked(cache.get).mockResolvedValue(mockLeaderboard);

      const request = new NextRequest('http://localhost:3000/api/vendors/leaderboard');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('lastUpdated');
      expect(data).toHaveProperty('nextUpdate');
      expect(new Date(data.lastUpdated)).toBeInstanceOf(Date);
      expect(new Date(data.nextUpdate)).toBeInstanceOf(Date);
    });
  });
});
