/**
 * Cache Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '@/features/cache/services/cache.service';
import * as indexeddb from '@/lib/db/indexeddb';

// Mock IndexedDB functions
vi.mock('@/lib/db/indexeddb', () => ({
  cacheAuction: vi.fn(),
  getCachedAuction: vi.fn(),
  getAllCachedAuctions: vi.fn(),
  cacheDocument: vi.fn(),
  getCachedDocument: vi.fn(),
  getCachedDocumentsByAuction: vi.fn(),
  cacheWallet: vi.fn(),
  getCachedWallet: vi.fn(),
  clearExpiredCache: vi.fn(),
  getCacheStorageUsage: vi.fn(),
}));

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auction Caching', () => {
    it('should cache auction data', async () => {
      const auction = { id: 'auction-1', title: 'Test Auction' };
      vi.mocked(indexeddb.cacheAuction).mockResolvedValue();

      await CacheService.cacheAuction(auction);

      expect(indexeddb.cacheAuction).toHaveBeenCalledWith(
        auction,
        expect.any(Number)
      );
    });

    it('should get cached auction', async () => {
      const mockCached = {
        data: { id: 'auction-1', title: 'Test Auction' },
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        size: 100,
      };

      vi.mocked(indexeddb.getCachedAuction).mockResolvedValue(mockCached);

      const result = await CacheService.getCachedAuction('auction-1');

      expect(result).toEqual(mockCached);
    });

    it('should return null when auction not cached', async () => {
      vi.mocked(indexeddb.getCachedAuction).mockResolvedValue(undefined);

      const result = await CacheService.getCachedAuction('auction-999');

      expect(result).toBeNull();
    });

    it('should get all cached auctions', async () => {
      const mockCached = [
        {
          data: { id: 'auction-1' },
          cachedAt: new Date(),
          expiresAt: new Date(),
          size: 100,
        },
        {
          data: { id: 'auction-2' },
          cachedAt: new Date(),
          expiresAt: new Date(),
          size: 150,
        },
      ];

      vi.mocked(indexeddb.getAllCachedAuctions).mockResolvedValue(mockCached);

      const result = await CacheService.getCachedAuctions();

      expect(result).toHaveLength(2);
      expect(result[0].data.id).toBe('auction-1');
    });
  });

  describe('Document Caching', () => {
    it('should cache document data', async () => {
      const document = { id: 'doc-1', name: 'Test Document' };
      const auctionId = 'auction-1';
      vi.mocked(indexeddb.cacheDocument).mockResolvedValue();

      await CacheService.cacheDocument(document, auctionId);

      expect(indexeddb.cacheDocument).toHaveBeenCalledWith(
        document,
        auctionId,
        expect.any(Number)
      );
    });

    it('should get cached document', async () => {
      const mockCached = {
        data: { id: 'doc-1', name: 'Test Document' },
        auctionId: 'auction-1',
        cachedAt: new Date(),
        expiresAt: new Date(),
        size: 200,
      };

      vi.mocked(indexeddb.getCachedDocument).mockResolvedValue(mockCached);

      const result = await CacheService.getCachedDocument('doc-1');

      expect(result).toEqual({
        data: mockCached.data,
        cachedAt: mockCached.cachedAt,
        expiresAt: mockCached.expiresAt,
        size: mockCached.size,
      });
    });

    it('should get cached documents by auction', async () => {
      const mockCached = [
        {
          data: { id: 'doc-1' },
          auctionId: 'auction-1',
          cachedAt: new Date(),
          expiresAt: new Date(),
          size: 100,
        },
      ];

      vi.mocked(indexeddb.getCachedDocumentsByAuction).mockResolvedValue(mockCached);

      const result = await CacheService.getCachedDocuments('auction-1');

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('doc-1');
    });
  });

  describe('Wallet Caching', () => {
    it('should cache wallet data', async () => {
      const userId = 'user-1';
      const balance = 10000;
      const transactions = [{ id: 'tx-1', amount: 5000 }];
      vi.mocked(indexeddb.cacheWallet).mockResolvedValue();

      await CacheService.cacheWallet(userId, balance, transactions);

      expect(indexeddb.cacheWallet).toHaveBeenCalledWith(
        userId,
        balance,
        transactions,
        expect.any(Number)
      );
    });

    it('should get cached wallet', async () => {
      const mockCached = {
        balance: 10000,
        transactions: [{ id: 'tx-1', amount: 5000 }],
        cachedAt: new Date(),
        expiresAt: new Date(),
        size: 300,
      };

      vi.mocked(indexeddb.getCachedWallet).mockResolvedValue(mockCached);

      const result = await CacheService.getCachedWallet('user-1');

      expect(result).toEqual({
        data: {
          balance: mockCached.balance,
          transactions: mockCached.transactions,
        },
        cachedAt: mockCached.cachedAt,
        expiresAt: mockCached.expiresAt,
        size: mockCached.size,
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear expired cache', async () => {
      vi.mocked(indexeddb.clearExpiredCache).mockResolvedValue(5);

      const result = await CacheService.clearExpired();

      expect(result).toBe(5);
      expect(indexeddb.clearExpiredCache).toHaveBeenCalled();
    });

    it('should get storage usage', async () => {
      const mockUsage = {
        auctions: { count: 10, size: 1000 },
        documents: { count: 20, size: 2000 },
        wallet: { count: 1, size: 500 },
        total: 3500,
      };

      vi.mocked(indexeddb.getCacheStorageUsage).mockResolvedValue(mockUsage);

      const result = await CacheService.getStorageUsage();

      expect(result).toBe(3500);
    });

    it('should check if within size limit', async () => {
      const mockUsage = {
        auctions: { count: 10, size: 1000 },
        documents: { count: 20, size: 2000 },
        wallet: { count: 1, size: 500 },
        total: 3500,
      };

      vi.mocked(indexeddb.getCacheStorageUsage).mockResolvedValue(mockUsage);

      const result = await CacheService.isWithinSizeLimit();

      expect(result).toBe(true);
    });

    it('should detect when over size limit', async () => {
      const mockUsage = {
        auctions: { count: 100, size: 60000000 },
        documents: { count: 200, size: 20000000 },
        wallet: { count: 1, size: 500 },
        total: 80000500, // Over 50MB limit
      };

      vi.mocked(indexeddb.getCacheStorageUsage).mockResolvedValue(mockUsage);

      const result = await CacheService.isWithinSizeLimit();

      expect(result).toBe(false);
    });
  });
});
