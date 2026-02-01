/**
 * Unit Tests: Auction Watching Count Tracking
 * 
 * Tests the watching service functionality including:
 * - Tracking vendor views
 * - Incrementing/decrementing watching counts
 * - Anonymizing vendor names
 * - Broadcasting updates via Socket.io
 * 
 * Requirements: 20
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as watchingService from '@/features/auctions/services/watching.service';
import * as socketServer from '@/lib/socket/server';
import * as auditLogger from '@/lib/utils/audit-logger';

// Mock dependencies
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    scard: vi.fn(),
    smembers: vi.fn(),
    sismember: vi.fn(),
    expire: vi.fn(),
  },
}));
vi.mock('@/lib/socket/server');
vi.mock('@/lib/utils/audit-logger');

// Import kv after mocking
import { kv } from '@vercel/kv';

describe('Auction Watching Service', () => {
  const mockAuctionId = 'auction-123';
  const mockVendorId = 'vendor-456';
  const mockUserId = 'user-789';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackAuctionView', () => {
    it('should store timestamp when vendor starts viewing', async () => {
      vi.mocked(kv.get).mockResolvedValue(null);
      vi.mocked(kv.set).mockResolvedValue('OK');
      vi.mocked(kv.scard).mockResolvedValue(0);

      await watchingService.trackAuctionView(mockAuctionId, mockVendorId, mockUserId);

      expect(kv.set).toHaveBeenCalledWith(
        `auction:viewer:${mockAuctionId}:${mockVendorId}`,
        expect.any(Number),
        { ex: 300 }
      );
    });

    it('should not store duplicate timestamp if already tracking', async () => {
      const existingTimestamp = Date.now() - 5000;
      vi.mocked(kv.get).mockResolvedValue(existingTimestamp);
      vi.mocked(kv.scard).mockResolvedValue(1);

      await watchingService.trackAuctionView(mockAuctionId, mockVendorId, mockUserId);

      expect(kv.set).not.toHaveBeenCalled();
    });

    it('should return current watching count', async () => {
      vi.mocked(kv.get).mockResolvedValue(null);
      vi.mocked(kv.set).mockResolvedValue('OK');
      vi.mocked(kv.scard).mockResolvedValue(5);

      const count = await watchingService.trackAuctionView(mockAuctionId, mockVendorId, mockUserId);

      expect(count).toBe(5);
    });
  });

  describe('incrementWatchingCount', () => {
    it('should increment count after 10 seconds of viewing', async () => {
      const viewStartTime = Date.now() - 11000; // 11 seconds ago
      vi.mocked(kv.get).mockResolvedValue(viewStartTime);
      vi.mocked(kv.sadd).mockResolvedValue(1);
      vi.mocked(kv.expire).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({
          emit: vi.fn(),
        }),
      } as any);

      const count = await watchingService.incrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(kv.sadd).toHaveBeenCalledWith(
        `auction:watching:${mockAuctionId}`,
        mockVendorId
      );
      expect(count).toBe(1);
    });

    it('should not increment if viewing duration < 10 seconds', async () => {
      const viewStartTime = Date.now() - 5000; // 5 seconds ago
      vi.mocked(kv.get).mockResolvedValue(viewStartTime);
      vi.mocked(kv.scard).mockResolvedValue(0);

      await watchingService.incrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(kv.sadd).not.toHaveBeenCalled();
    });

    it('should broadcast updated count via Socket.io', async () => {
      const viewStartTime = Date.now() - 11000;
      const mockEmit = vi.fn();
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

      vi.mocked(kv.get).mockResolvedValue(viewStartTime);
      vi.mocked(kv.sadd).mockResolvedValue(1);
      vi.mocked(kv.expire).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(3);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: mockTo,
      } as any);

      await watchingService.incrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(mockTo).toHaveBeenCalledWith(`auction:${mockAuctionId}`);
      expect(mockEmit).toHaveBeenCalledWith('auction:watching-count', {
        auctionId: mockAuctionId,
        count: 3,
      });
    });

    it('should log action to audit trail', async () => {
      const viewStartTime = Date.now() - 11000;
      vi.mocked(kv.get).mockResolvedValue(viewStartTime);
      vi.mocked(kv.sadd).mockResolvedValue(1);
      vi.mocked(kv.expire).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      await watchingService.incrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(auditLogger.logAction).toHaveBeenCalledWith({
        userId: mockUserId,
        actionType: 'auction_created',
        entityType: 'auction',
        entityId: mockAuctionId,
        ipAddress: 'system',
        deviceType: 'desktop',
        userAgent: 'system',
        afterState: {
          vendorId: mockVendorId,
          watchingCount: 1,
          action: 'watching_incremented',
        },
      });
    });
  });

  describe('decrementWatchingCount', () => {
    it('should remove vendor from watching set', async () => {
      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(2);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      await watchingService.decrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(kv.srem).toHaveBeenCalledWith(
        `auction:watching:${mockAuctionId}`,
        mockVendorId
      );
      expect(kv.del).toHaveBeenCalledWith(
        `auction:viewer:${mockAuctionId}:${mockVendorId}`
      );
    });

    it('should broadcast updated count', async () => {
      const mockEmit = vi.fn();
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: mockTo,
      } as any);

      await watchingService.decrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(mockTo).toHaveBeenCalledWith(`auction:${mockAuctionId}`);
      expect(mockEmit).toHaveBeenCalledWith('auction:watching-count', {
        auctionId: mockAuctionId,
        count: 1,
      });
    });

    it('should log action to audit trail', async () => {
      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(0);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      await watchingService.decrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(auditLogger.logAction).toHaveBeenCalledWith({
        userId: mockUserId,
        actionType: 'auction_created',
        entityType: 'auction',
        entityId: mockAuctionId,
        ipAddress: 'system',
        deviceType: 'desktop',
        userAgent: 'system',
        afterState: {
          vendorId: mockVendorId,
          watchingCount: 0,
          action: 'watching_decremented',
        },
      });
    });
  });

  describe('getWatchingCount', () => {
    it('should return count from Redis', async () => {
      vi.mocked(kv.scard).mockResolvedValue(7);

      const count = await watchingService.getWatchingCount(mockAuctionId);

      expect(count).toBe(7);
      expect(kv.scard).toHaveBeenCalledWith(`auction:watching:${mockAuctionId}`);
    });

    it('should return 0 if no watchers', async () => {
      vi.mocked(kv.scard).mockResolvedValue(0);

      const count = await watchingService.getWatchingCount(mockAuctionId);

      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      vi.mocked(kv.scard).mockRejectedValue(new Error('Redis error'));

      const count = await watchingService.getWatchingCount(mockAuctionId);

      expect(count).toBe(0);
    });
  });

  describe('getAnonymizedWatchers', () => {
    it('should return anonymized vendor identifiers', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([
        'vendor-1',
        'vendor-2',
        'vendor-3',
      ]);

      const watchers = await watchingService.getAnonymizedWatchers(mockAuctionId);

      expect(watchers).toEqual(['Vendor A', 'Vendor B', 'Vendor C']);
    });

    it('should return empty array if no watchers', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([]);

      const watchers = await watchingService.getAnonymizedWatchers(mockAuctionId);

      expect(watchers).toEqual([]);
    });

    it('should handle null response from Redis', async () => {
      vi.mocked(kv.smembers).mockResolvedValue(null as any);

      const watchers = await watchingService.getAnonymizedWatchers(mockAuctionId);

      expect(watchers).toEqual([]);
    });
  });

  describe('isVendorWatching', () => {
    it('should return true if vendor is watching', async () => {
      vi.mocked(kv.sismember).mockResolvedValue(1);

      const isWatching = await watchingService.isVendorWatching(
        mockAuctionId,
        mockVendorId
      );

      expect(isWatching).toBe(true);
    });

    it('should return false if vendor is not watching', async () => {
      vi.mocked(kv.sismember).mockResolvedValue(0);

      const isWatching = await watchingService.isVendorWatching(
        mockAuctionId,
        mockVendorId
      );

      expect(isWatching).toBe(false);
    });

    it('should return false on error', async () => {
      vi.mocked(kv.sismember).mockRejectedValue(new Error('Redis error'));

      const isWatching = await watchingService.isVendorWatching(
        mockAuctionId,
        mockVendorId
      );

      expect(isWatching).toBe(false);
    });
  });

  describe('resetWatchingCount', () => {
    it('should delete all viewer tracking and watching set', async () => {
      vi.mocked(kv.smembers).mockResolvedValue(['vendor-1', 'vendor-2']);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      await watchingService.resetWatchingCount(mockAuctionId);

      expect(kv.del).toHaveBeenCalledWith(`auction:viewer:${mockAuctionId}:vendor-1`);
      expect(kv.del).toHaveBeenCalledWith(`auction:viewer:${mockAuctionId}:vendor-2`);
      expect(kv.del).toHaveBeenCalledWith(`auction:watching:${mockAuctionId}`);
    });

    it('should broadcast zero count', async () => {
      const mockEmit = vi.fn();
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

      vi.mocked(kv.smembers).mockResolvedValue([]);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: mockTo,
      } as any);

      await watchingService.resetWatchingCount(mockAuctionId);

      expect(mockEmit).toHaveBeenCalledWith('auction:watching-count', {
        auctionId: mockAuctionId,
        count: 0,
      });
    });
  });

  describe('cleanupExpiredViewers', () => {
    it('should remove vendors with expired viewer tracking', async () => {
      vi.mocked(kv.smembers).mockResolvedValue(['vendor-1', 'vendor-2', 'vendor-3']);
      vi.mocked(kv.get)
        .mockResolvedValueOnce(Date.now()) // vendor-1 still active
        .mockResolvedValueOnce(null) // vendor-2 expired
        .mockResolvedValueOnce(Date.now()); // vendor-3 still active
      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(2);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      await watchingService.cleanupExpiredViewers(mockAuctionId);

      expect(kv.srem).toHaveBeenCalledWith(
        `auction:watching:${mockAuctionId}`,
        'vendor-2'
      );
      expect(kv.srem).toHaveBeenCalledTimes(1);
    });

    it('should broadcast updated count after cleanup', async () => {
      const mockEmit = vi.fn();
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

      vi.mocked(kv.smembers).mockResolvedValue(['vendor-1']);
      vi.mocked(kv.get).mockResolvedValue(null);
      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(0);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: mockTo,
      } as any);

      await watchingService.cleanupExpiredViewers(mockAuctionId);

      expect(mockEmit).toHaveBeenCalledWith('auction:watching-count', {
        auctionId: mockAuctionId,
        count: 0,
      });
    });
  });

  describe('Requirement 20: Vendors Watching Count', () => {
    it('should track vendor viewing auction >10 seconds', async () => {
      const viewStartTime = Date.now() - 11000;
      vi.mocked(kv.get).mockResolvedValue(viewStartTime);
      vi.mocked(kv.sadd).mockResolvedValue(1);
      vi.mocked(kv.expire).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(1);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      } as any);

      const count = await watchingService.incrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(count).toBeGreaterThan(0);
    });

    it('should update watching count in real-time via WebSocket', async () => {
      const mockEmit = vi.fn();
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

      vi.mocked(kv.srem).mockResolvedValue(1);
      vi.mocked(kv.del).mockResolvedValue(1);
      vi.mocked(kv.scard).mockResolvedValue(5);
      vi.mocked(socketServer.getSocketServer).mockReturnValue({
        to: mockTo,
      } as any);

      await watchingService.decrementWatchingCount(
        mockAuctionId,
        mockVendorId,
        mockUserId
      );

      expect(mockEmit).toHaveBeenCalledWith('auction:watching-count', {
        auctionId: mockAuctionId,
        count: 5,
      });
    });

    it('should anonymize vendor names', async () => {
      vi.mocked(kv.smembers).mockResolvedValue([
        'vendor-abc-123',
        'vendor-def-456',
        'vendor-ghi-789',
      ]);

      const watchers = await watchingService.getAnonymizedWatchers(mockAuctionId);

      expect(watchers).toEqual(['Vendor A', 'Vendor B', 'Vendor C']);
      expect(watchers).not.toContain('vendor-abc-123');
    });

    it('should create FOMO effect with watching count display', async () => {
      vi.mocked(kv.scard).mockResolvedValue(15);

      const count = await watchingService.getWatchingCount(mockAuctionId);

      expect(count).toBe(15);
      expect(count).toBeGreaterThan(10); // High demand indicator
    });
  });
});
